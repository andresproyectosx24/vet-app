'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
// Usamos ruta relativa para asegurar compatibilidad (src/app/login -> ../../lib)
import { auth } from '../../lib/firebase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsuscribe = onAuthStateChanged(auth, (usuario) => {
      if (usuario) {
        router.replace('/dashboard');
      }
    });
    return () => unsuscribe();
  }, [router]);

  const iniciarSesion = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err) {
      setError("Correo o contraseña incorrectos");
    }
  };

  return (
    // 1. Contenedor principal: 
    // Quitamos "bg-gray-100". Ahora es transparente y hereda el fondo de globals.css (Claro/Oscuro).
    <div className="h-[100dvh] flex items-center justify-center p-4">
      
      {/* 2. Tarjeta: Se adapta a blanco o gris oscuro según el modo */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg w-full max-w-sm transition-colors duration-300">
        <h1 className="text-2xl font-bold text-center mb-6 text-slate-800 dark:text-white">Acceso Veterinario</h1>
        
        <form onSubmit={iniciarSesion} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Correo</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              // Inputs adaptables
              className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              placeholder="admin@vet.com"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              placeholder="******"
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}

          {/* Botón: En modo oscuro usamos un verde para resaltar, o mantenemos el slate oscuro si prefieres sobriedad */}
          <button className="w-full bg-slate-900 dark:bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-green-700 transition-colors">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}