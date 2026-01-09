'use client'; // Necesario para hooks y eventos en App Router

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signInWithCustomToken,
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { Loader2, AlertCircle, Stethoscope, ArrowRight } from 'lucide-react';

// --- 1. CONFIGURACIÓN FIREBASE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function LoginPage() {

  const router = useRouter(); 
  
  // Estados
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Efecto para Auth inicial
  useEffect(() => {
    const initAuth = async () => {
      // Si ya hay un token en la sesión (props del servidor), úsalo
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      }
    };
    initAuth();
  }, []);

  // --- 2. FUNCIÓN DE LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // A. Autenticar con Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log("Usuario autenticado:", user.uid);

      // B. Buscar "A qué veterinaria pertenece este usuario"
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default';
      
      // NOTA: Ajusta esta ruta a tu estructura real en Firestore
      // Ruta recomendada para SaaS: artifacts/{appId}/public/data/global_users/{uid}
      
      const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'global_users', user.uid);
      const userDoc = await getDoc(userDocRef);

      let destinoVeterinaria = '';

      if (userDoc.exists()) {
        const userData = userDoc.data();
        destinoVeterinaria = userData.veterinaria_id; // Ejemplo: "vet-patitas"
      } else {
        // Fallback temporal si no has creado el usuario en la BD aún
        // En producción podrías redirigir a una página de "Completa tu perfil"
        console.warn("Usuario no encontrado en BD, usando fallback temporal.");
        destinoVeterinaria = 'veterinaria-demo'; 
      }

      // C. Redirigir a la ruta dinámica correcta
      if (destinoVeterinaria) {
        // --- INICIO: CAMBIO PARA PREVISUALIZACIÓN --- 
        router.push(`/${destinoVeterinaria}/inicio`);
        window.location.href = `/${destinoVeterinaria}/inicio`;
        
        // --- FIN: CAMBIO PARA PREVISUALIZACIÓN ---
      } else {
        setError("Error: Este usuario no tiene una veterinaria asignada.");
        setLoading(false);
      }

    } catch (err) {
      console.error("Error Login:", err);
      setLoading(false);
      
      // Manejo de errores comunes de Firebase en español
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("Correo o contraseña incorrectos.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Demasiados intentos fallidos. Intenta más tarde.");
      } else {
        setError("Error al iniciar sesión. Verifica tu conexión.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      
      {/* Tarjeta Principal */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Cabecera */}
        <div className="bg-slate-900 p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4 shadow-lg shadow-blue-900/50">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">VetManager</h1>
          <p className="text-slate-400 mt-2 text-sm">Acceso al Portal Clínico</p>
        </div>

        {/* Formulario */}
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* Mensaje de Error */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Input Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Correo Electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                placeholder="doctor@ejemplo.com"
              />
            </div>

            {/* Input Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                placeholder="••••••••"
              />
            </div>

            {/* Botón Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-blue-600/20 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  Ingresar a mi Clínica <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              ¿Olvidaste tu contraseña? Contacta al administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}