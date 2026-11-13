import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Everything is created lazily so nothing touches the browser-only
// Firebase APIs while Next.js pre-renders pages on the server.
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let firestore: Firestore | undefined;

// Set NEXT_PUBLIC_USE_EMULATORS=true to develop against the local Firebase
// emulators (`npm run emulators`) instead of the real project.
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

function firebaseApp(): FirebaseApp {
  app ??= getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function auth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(firebaseApp());
    if (useEmulators) {
      connectAuthEmulator(authInstance, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
    }
  }
  return authInstance;
}

export function db(): Firestore {
  if (!firestore) {
    try {
      // Cache data in IndexedDB so the guest list still loads (and searches
      // stay instant) if the venue network drops for a moment.
      firestore = initializeFirestore(firebaseApp(), {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
      if (useEmulators) connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
    } catch {
      // Already initialised, e.g. after a hot reload.
      firestore = getFirestore(firebaseApp());
    }
  }
  return firestore;
}
