
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCj7bwfSx0m5TisItr-Zau3CksIkO5t9oY",
  authDomain: "omtatva-portal.firebaseapp.com",
  projectId: "omtatva-portal",
  storageBucket: "omtatva-portal.firebasestorage.app",
  messagingSenderId: "466511386296",
  appId: "1:466511386296:web:d8a98ee98fe3b7d176064d"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);