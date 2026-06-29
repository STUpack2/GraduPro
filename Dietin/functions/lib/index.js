"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_entitlement = exports.webhooks_paymob = exports.subscriptions_start = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
admin.initializeApp();
const db = admin.firestore();
// Helpers to read config
const cfg = functions.config();
const PAYMOB = {
    API_KEY: cfg.paymob?.api_key,
    HMAC_SECRET: cfg.paymob?.hmac_secret,
    INTEGRATION_ID: cfg.paymob?.integration_id,
    MERCHANT_ID: cfg.paymob?.merchant_id,
};
const APP = {
    RETURN_URL: cfg.app?.return_url,
    DOMAIN: cfg.app?.domain,
};
const PERIOD = {
    MONTH_DAYS: Number(cfg.subs?.month_days || 30),
    YEAR_DAYS: Number(cfg.subs?.year_days || 365),
};
function addDays(date, days) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}
function computeExpiry(plan) {
    const now = new Date();
    return plan === "annual" ? addDays(now, PERIOD.YEAR_DAYS) : addDays(now, PERIOD.MONTH_DAYS);
}
// Create Paymob payment link/session
exports.subscriptions_start = functions.region("us-central1").https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const plan = data?.plan === "annual" ? "annual" : "monthly";
    if (!PAYMOB.API_KEY || !PAYMOB.INTEGRATION_ID) {
        throw new functions.https.HttpsError("failed-precondition", "Paymob not configured");
    }
    // 1) Authenticate to Paymob (get auth token)
    const authRes = await axios_1.default.post("https://accept.paymob.com/api/auth/tokens", {
        api_key: PAYMOB.API_KEY,
    });
    const token = authRes.data?.token;
    if (!token)
        throw new functions.https.HttpsError("internal", "Paymob auth failed");
    // 2) Create order
    const amountCents = plan === "annual" ? 499900 : 49900; // example prices, replace with yours
    const orderRes = await axios_1.default.post("https://accept.paymob.com/api/ecommerce/orders", {
        auth_token: token,
        delivery_needed: false,
        amount_cents: amountCents,
        currency: "EGP",
        merchant_order_id: `${uid}-${Date.now()}`,
        items: [],
    });
    const orderId = orderRes.data?.id;
    if (!orderId)
        throw new functions.https.HttpsError("internal", "Order creation failed");
    // 3) Payment key
    const paymentKeyRes = await axios_1.default.post("https://accept.paymob.com/api/acceptance/payment_keys", {
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
    if (!paymentKey)
        throw new functions.https.HttpsError("internal", "Payment key failed");
    // 4) iFrame/URL (hosted payment page)
    const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/\${PAYMOB.MERCHANT_ID}?payment_token=\${paymentKey}`;
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
exports.webhooks_paymob = functions.region("us-central1").https.onRequest(async (req, res) => {
    try {
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }
        // Per Paymob docs, compute HMAC over specific fields
        const providedHmac = req.query?.hmac || req.headers["hmac"] || "";
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
        const crypto = await Promise.resolve().then(() => __importStar(require("node:crypto")));
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
        const sub = snap.docs[0].data();
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
    }
    catch (e) {
        console.error(e);
        res.status(500).send("Server error");
    }
});
// Entitlement: server-evaluated
exports.get_entitlement = functions.region("us-central1").https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const userDoc = await db.collection("users").doc(uid).get();
    const u = userDoc.data() || {};
    const now = admin.firestore.Timestamp.now();
    const isPro = Boolean(u.isPro) && u.proExpiresAt && u.proExpiresAt.toMillis() > now.toMillis();
    return {
        isPro,
        proExpiresAt: u.proExpiresAt || null,
        plan: u.plan || null,
    };
});
