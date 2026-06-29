import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence, disableNetwork, enableNetwork, waitForPendingWrites } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

console.log('Initializing Firebase...');

// Initialize Firebase
let app, auth, db, functions, storage;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase initialization successful');
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app, "us-central1"); // Ensure region matches backend
  storage = getStorage(app);

  console.log('Firebase services initialization successful');
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw error;
}

// Export the initialized services
export { app, auth, db, functions, storage };

// Network connectivity management functions
export const tryReconnect = async () => {
  console.log("Attempting to reconnect to Firestore...");
  try {
    await enableNetwork(db);
    console.log("Firestore network connection restored");
    return true;
  } catch (error) {
    console.error("Failed to reconnect to Firestore:", error);
    return false;
  }
};

export const syncPendingWrites = async () => {
  try {
    console.log("Syncing pending Firestore write operations...");
    await waitForPendingWrites(db);
    console.log("Pending Firestore writes completed");
    return true;
  } catch (error) {
    console.error("Error syncing pending writes:", error);
    return false;
  }
};

// Enable offline persistence with retries and better error handling
const enablePersistence = async () => {
  let retries = 5; // Increased retries
  const retryDelay = 1500; // Longer delay between retries

  while (retries > 0) {
    try {
      await enableIndexedDbPersistence(db, {
        forceOwnership: false
      });
      console.log('Persistence enabled successfully');
      break;
    } catch (err: any) {
      retries--;
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time
        console.warn('Multiple tabs open, persistence can only be enabled in one tab');
        return; // Return early as this isn't a critical error
      } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the
        // features required to enable persistence
        console.warn('Browser does not support persistence');
        return; // Return early as this isn't a critical error
      } else {
        console.error('Persistence error (retrying):', err.code, err.message);
        if (retries === 0) {
          console.error('Max retries reached, operating without persistence');
          return;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay * (6 - retries))); // Exponential backoff
      }
    }
  }
};

// Check network connectivity and handle offline operations
const handleConnectivity = async () => {
  // Add network status event listeners
  window.addEventListener('online', () => {
    console.log("App is online - enabling Firestore network");
    enableNetwork(db)
      .then(() => console.log("Firestore network enabled"))
      .catch(err => console.error("Error enabling Firestore network:", err));
  });

  window.addEventListener('offline', () => {
    console.log("App is offline - disabling Firestore network");
    disableNetwork(db)
      .then(() => console.log("Firestore network disabled"))
      .catch(err => console.error("Error disabling Firestore network:", err));
  });

  // Initial state check
  if (!navigator.onLine) {
    console.log("App starting offline - persistence mode only");
    try {
      await disableNetwork(db);
      console.log("Firestore network disabled due to offline state");
    } catch (err) {
      console.error("Failed to set initial network state:", err);
    }
  }
};

// Try to enable persistence but don't wait for it - allow the app to proceed
enablePersistence().then(() => {
  return handleConnectivity();
}).catch(error => {
  console.error('Firebase initialization error chain:', error);
});

// Export a promise that resolves when Firestore is ready
export const dbPromise = Promise.resolve(db); 