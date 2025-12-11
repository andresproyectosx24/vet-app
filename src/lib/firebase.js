// src/lib/firebase.js

// 1. Importamos las funciones que necesitamos
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Base de datos
import { getAuth } from "firebase/auth";           // Usuarios

// 2. Aquí pegas TU configuración (La que dejaste abierta en la pestaña de Chrome)
// REEMPLAZA ESTE OBJETO con el que te dio Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD-9pijoF0zfFfD-kzbuJWDtI0l29U1Ao0",
  authDomain: "veterinario-306b2.firebaseapp.com",
  projectId: "veterinario-306b2",
  storageBucket: "veterinario-306b2.firebasestorage.app",
  messagingSenderId: "784971952466",
  appId: "1:784971952466:web:ad62a7d3d5de2ba5d6ca8b",
  measurementId: "G-WTLETBTGFW"
};

// 3. Inicializamos la conexión
const app = initializeApp(firebaseConfig);

// 4. Exportamos las herramientas para usarlas en la app
export const db = getFirestore(app);
export const auth = getAuth(app);