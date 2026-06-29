import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

admin.initializeApp();
const db = admin.firestore();

// Helpers to read config
const cfg = functions.config();
const PAYMOB = {
  API_KEY: cfg.paymob?.api_key as string,
  HMAC_SECRET: cfg.paymob?.hmac_secret as string,
  INTEGRATION_ID: cfg.paymob?.integration_id as string,
  // Backward compatible: prefer iframe_id; fallback to merchant_id if you previously set it
  IFRAME_ID: (cfg.paymob?.iframe_id as string) || (cfg.paymob?.merchant_id as string),
};
const APP = {
  RETURN_URL: cfg.app?.return_url as string,
  DOMAIN: cfg.app?.domain as string,
};
const PERIOD = {
  MONTH_DAYS: Number(cfg.subs?.month_days || 30),
  YEAR_DAYS: Number(cfg.subs?.year_days || 365),
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function computeExpiry(plan: "monthly" | "annual"): Date {
  const now = new Date();
  return plan === "annual" ? addDays(now, PERIOD.YEAR_DAYS) : addDays(now, PERIOD.MONTH_DAYS);
}

// Create Paymob payment link/session
export const subscriptions_start = functions.region("us-central1").https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }
  const uid = context.auth.uid;
  const plan = (data?.plan as string) === "annual" ? "annual" : "monthly";

  if (!PAYMOB.API_KEY || !PAYMOB.INTEGRATION_ID) {
    throw new functions.https.HttpsError("failed-precondition", "Paymob not configured");
  }

  // 1) Authenticate to Paymob (get auth token)
  const authRes = await axios.post("https://accept.paymob.com/api/auth/tokens", {
    api_key: PAYMOB.API_KEY,
  });
  const token = authRes.data?.token;
  if (!token) throw new functions.https.HttpsError("internal", "Paymob auth failed");

  // 2) Create order
  const amountCents = plan === "annual" ? 4999_00 : 499_00; // example prices, replace with yours
  const orderRes = await axios.post("https://accept.paymob.com/api/ecommerce/orders", {
    auth_token: token,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: "EGP",
    merchant_order_id: `${uid}-${Date.now()}`,
    items: [],
  });
  const orderId = orderRes.data?.id;
  if (!orderId) throw new functions.https.HttpsError("internal", "Order creation failed");

  // 3) Payment key
  const paymentKeyRes = await axios.post("https://accept.paymob.com/api/acceptance/payment_keys", {
    auth_token: token,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: orderId,
    billing_data: {
      apartment: "NA",
      email: context.auth.token?.email || "user@example.com",
      floor: "NA",
      first_name: context.auth.token?.name || "Dietin",
      street: "NA",
      building: "NA",
      phone_number: "NA",
      shipping_method: "NA",
      postal_code: "NA",
      city: "NA",
      country: "EG",
      last_name: "User",
      state: "NA",
    },
    currency: "EGP",
    integration_id: Number(PAYMOB.INTEGRATION_ID),
    lock_order_when_paid: true,
  });
  const paymentKey = paymentKeyRes.data?.token;
  if (!paymentKey) throw new functions.https.HttpsError("internal", "Payment key failed");

  // 4) iFrame/URL (hosted payment page)
  if (!PAYMOB.IFRAME_ID) {
    throw new functions.https.HttpsError("failed-precondition", "Paymob iFrame ID not configured");
  }
  const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB.IFRAME_ID}?payment_token=${paymentKey}`;
  console.log('Paymob iframe URL:', iframeUrl);

  // store a pending record
  await db.collection("subscriptions").add({
    uid,
    plan,
    status: "pending",
    provider: "paymob",
    providerOrderId: orderId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { url: iframeUrl };
});

// Webhook: verify HMAC and set entitlement
export const webhooks_paymob = functions.region("us-central1").https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Per Paymob docs, compute HMAC over specific fields
    const providedHmac = (req.query?.hmac as string) || (req.headers["hmac"] as string) || "";
    if (!providedHmac || !PAYMOB.HMAC_SECRET) {
      res.status(400).send("Missing HMAC");
      return;
    }

    // Build the concatenated string in the correct field order as per Paymob docs
    const obj = req.body?.obj || {};
    const dataStr = [
      obj?.amount_cents,
      obj?.created_at,
      obj?.currency,
      obj?.error_occured,
      obj?.has_parent_transaction,
      obj?.id,
      obj?.integration_id,
      obj?.is_3d_secure,
      obj?.is_auth,
      obj?.is_capture,
      obj?.is_refunded,
      obj?.is_standalone_payment,
      obj?.is_voided,
      obj?.order?.id,
      obj?.owner,
      obj?.pending,
      obj?.source_data?.pan,
      obj?.source_data?.sub_type,
      obj?.source_data?.type,
      obj?.success,
    ].join("");

    const crypto = await import("node:crypto");
    const calc = crypto.createHmac("sha512", PAYMOB.HMAC_SECRET).update(dataStr).digest("hex");
    if (calc !== providedHmac) {
      res.status(403).send("Invalid HMAC");
      return;
    }

    const success = Boolean(obj?.success);
    const orderId = obj?.order?.id;

    // Find pending subscription by providerOrderId
    const snap = await db.collection("subscriptions").where("providerOrderId", "==", orderId).limit(1).get();
    if (snap.empty) {
      res.status(200).send("No pending subscription");
      return;
    }
    const docRef = snap.docs[0].ref;
    const sub = snap.docs[0].data() as any;

    if (!success) {
      await docRef.update({ status: "failed", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      res.status(200).send("Marked failed");
      return;
    }

    // Activate: compute expiry with server time
    const expiresAt = computeExpiry(sub.plan);
    await docRef.update({
      status: "active",
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    });

    // Materialize entitlement on users/{uid}
    await db.collection("users").doc(sub.uid).set({
      isPro: true,
      proExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      plan: sub.plan,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(200).send("OK");
  } catch (e) {
    console.error(e);
    res.status(500).send("Server error");
  }
});

// Entitlement: server-evaluated
export const get_entitlement = functions.region("us-central1").https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }
  const uid = context.auth.uid;
  const userDoc = await db.collection("users").doc(uid).get();
  const u = userDoc.data() || {} as any;
  const now = admin.firestore.Timestamp.now();
  const isPro = Boolean(u.isPro) && u.proExpiresAt && u.proExpiresAt.toMillis() > now.toMillis();
  return {
    isPro,
    proExpiresAt: u.proExpiresAt || null,
    plan: u.plan || null,
  };
});

// --- GEMINI SECURITY FIX ---

const GEMINI_API_KEY = "AIzaSyDxwvUw4C1EgJtCXNDzOXVECiC31-Mf_Ys";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const MEAL_LIMIT = 3;
const IMAGE_LIMIT = 1;

async function checkQuota(uid: string, type: "meal" | "image") {
  const userRef = db.collection("users").doc(uid);
  return db.runTransaction(async (t) => {
    const doc = await t.get(userRef);
    const data = doc.data() || {};

    const now = admin.firestore.Timestamp.now();
    const isPro = Boolean(data.isPro) && data.proExpiresAt && data.proExpiresAt.toMillis() > now.toMillis();

    if (isPro) return;

    const today = new Date().toISOString().split("T")[0];
    const prefix = type === "meal" ? "dailyMeal" : "dailyImage";
    const dateField = `${prefix}AnalysisDate`;
    const countField = `${prefix}AnalysisCount`;

    const lastDate = data[dateField];
    let count = data[countField] || 0;

    if (lastDate !== today) {
      count = 0;
    }

    const limit = type === "meal" ? MEAL_LIMIT : IMAGE_LIMIT;
    if (count >= limit) {
      throw new functions.https.HttpsError("resource-exhausted", `Daily ${type} analysis limit reached. Upgrade to Pro.`);
    }

    t.set(userRef, {
      [dateField]: today,
      [countField]: count + 1
    }, { merge: true });
  });
}

export const analyze_food = functions.region("us-central1").https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const description = data.description;
  if (!description) throw new functions.https.HttpsError("invalid-argument", "Description required");

  await checkQuota(context.auth.uid, "meal");

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const validationPrompt = `Please validate if this user input is a food/drink/human consumable item.'
Analyze this input: "${description}"

Rules:
1. Accept ANY language (English, Franco-Arabic like "ma7shi/ta3miya", Arabic, French, Chinese, etc.)
2. Ignore ALL spelling mistakes completely
3. Accept common food nicknames and slang
4. Accept numeric character substitutions (like 7 for ح, 3 for ع, etc.)
5. Accept any measurement units (kg, g, lbs, pieces, etc.)
6. Accept both formal and informal food descriptions
7. REJECT if portions are unrealistic (e.g. "1000kg rice", "50kg meat", anything over 10kg)
8. REJECT haram, illegal foods like:
   - Pork
   - Alcohol
   -etc. 
9. ACCEPT all regular soft drinks and beverages (like Pepsi, Coca-Cola, etc.) as they are halal
10. REJECT if the description contains non-food items
11. REJECT if the description is nonsensical or inappropriate

Is this describing consumable food/drink with realistic portions?
Answer ONLY with "yes" or "no" followed by "|" and the reason if "no".`;

    const valResult = await model.generateContent(validationPrompt);
    const valText = (await valResult.response).text().toLowerCase();

    if (!valText.includes("yes")) {
      const reason = valText.split("|")[1] || "Invalid food item";
      // Throw formatted error so client can show toast
      return { error: reason, isError: true };
    }

    const prompt = `Please analyze the nutrition facts of this food/meal:
    Calories, Protein, Carbs, Fat, Health Score (Health score based on healthiness of the food preciesly between 0 and 100)
The Meal description is: "${description}"
Return ONLY a JSON object in this exact format (no explanation, no other text):
{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "healthScore": number
}`;

    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error("Failed to parse JSON");
    }

    return {
      calories: Number(parsed.calories) || 0,
      protein: Number(parsed.protein) || 0,
      carbs: Number(parsed.carbs) || 0,
      fat: Number(parsed.fat) || 0,
      healthScore: Number(parsed.healthScore) || 0
    };

  } catch (e) {
    console.error("AI Error:", e);
    throw new functions.https.HttpsError("internal", "AI analysis failed");
  }
});

export const analyze_image_food = functions.region("us-central1").https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const { imageBase64, mimeType } = data;
  if (!imageBase64) throw new functions.https.HttpsError("invalid-argument", "Image required");

  await checkQuota(context.auth.uid, "image");

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Basic validation helper
    const isFoodResult = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: 'Is this an image of food or a meal? Answer only with "yes" or "no".' },
          { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } }
        ]
      }]
    });
    if (!(await isFoodResult.response).text().toLowerCase().includes("yes")) {
      return { error: "Not a food image", isError: true };
    }

    const analysisPrompt = `Describe the food/drink in this image with precise details.ONLY IF IT IS CONSUMABLE ITEM Include:
1. Each distinct item/component
BE SUPER FUCKING DETAILED AND SPECIFIC AS POSSIBLE AND DONT INCLUDE USELESS WORDS OR EXPRESSIONS LIKE 'THE PLATE SHOWS' ONLHY THE CONMTENT AS BULLETS
2. Exact or estimated portion sizes (in oz, grams, or standard measures)
3. Preparation methods (if visible)
4. Any visible sauces, seasonings, or toppings
5. Arrangement on the plate
6. Don't include any italics, bolds, commas, fullstops, or any other formatting keep it simple and clear in lines include all the details.
7. DONT INCLUDE ANYTHING ELSE LIKE THE 'THE PLATE CONTINAINS' NO ONLY THE INGREDEIENTS AS BULLETS NO EXTRA WORDS OR PHRASES BRIEF ANSER IN YOUR ANSWER LIEK DONT INCLUDE TITLE LIKE ' OH I GOT IT' THEN THE ANSWER NO ONLY THE ANSWER
Format as a clear, detailed description focused ONLY on the food content.`;

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: analysisPrompt },
          { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } }
        ]
      }]
    });

    const description = (await result.response).text()
      .trim()
      .replace(/^(The image shows|I see|This is|In this image)/i, '')
      .trim();

    return { description };

  } catch (e) {
    console.error("AI Image Error:", e);
    throw new functions.https.HttpsError("internal", "Image analysis failed");
  }
});
