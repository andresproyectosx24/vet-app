import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage"; // <--- NUEVO IMPORT

const firebaseConfig = {
    apiKey: "AIzaSyD-9pijoF0zfFfD-kzbuJWDtI0l29U1Ao0",
  authDomain: "veterinario-306b2.firebaseapp.com",
  projectId: "veterinario-306b2",
  storageBucket: "veterinario-306b2.firebasestorage.app",
  messagingSenderId: "784971952466",
  appId: "1:784971952466:web:ad62a7d3d5de2ba5d6ca8b",
  measurementId: "G-WTLETBTGFW"
};

// Singleton para evitar reinicializar en Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // <--- EXPORTAMOS STORAGE