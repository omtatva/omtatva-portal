
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAhc8Ul5OM65l4pcLDNkoeJfF5uf_RAQEE",
  authDomain: "timesheet-app-a9e01.firebaseapp.com",
  projectId: "timesheet-app-a9e01",
  storageBucket: "timesheet-app-a9e01.firebasestorage.app",
  messagingSenderId: "172969236188",
  appId: "1:172969236188:web:b3357334fafcf8a3e64619"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);