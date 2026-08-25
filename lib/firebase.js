
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// The real (production) project's config stays as the default, so
// deploys keep working exactly as before with zero extra setup. To test
// locally against a SEPARATE database (so nothing you click on localhost
// touches the live site), create a second Firebase project and put its
// config in .env.local (gitignored, never deployed) — see
// .env.local.example for the variable names. Once that file exists,
// `npm run dev` picks it up automatically and localhost talks to your
// test project instead of the real one.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCj7bwfSx0m5TisItr-Zau3CksIkO5t9oY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "omtatva-portal.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "omtatva-portal",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "omtatva-portal.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "466511386296",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:466511386296:web:d8a98ee98fe3b7d176064d",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
