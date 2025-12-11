'use client';

import { useState, useEffect } from 'react';
// Usamos ruta relativa para asegurar que encuentre el archivo sin errores de alias
import { db } from '../../../lib/firebase'; 
import { collection, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function DashboardVeterinario() {
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // 1. CARGA DE DATOS EN VIVO
  // Nota: La seguridad (login) ya la maneja el layout.js, así que aquí vamos directo a los datos.
  useEffect(() => {
    const q = query(collection(db, "citas"), orderBy("fecha", "asc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const listaCitas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        setCitas(listaCitas);
        setCargando(false);
    });

    return () => unsubscribe();
  }, []);

  const eliminarCita = async (id) => {
    if(!confirm("¿Cancelar esta cita permanentemente?")) return;
    try {
      await deleteDoc(doc(db, "citas", id));
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("No se pudo eliminar");
    }
  };

  const getIcono = (especie) => {
      if(especie === 'perro') return '🐶';
      if(especie === 'gato') return '🐱';
      return '🐾';
  }

  return (
    // "h-full" ocupa el espacio que le deja el Layout (entre el Header y el Menú)
    // "overflow-y-auto" permite scroll interno
    <main className="h-full overflow-y-auto p-4 relative bg-gray-50 dark:bg-slate-900 transition-colors">
        
        {/* CONTADOR DE CITAS (Estilo Píldora) */}
        <div className="flex justify-between items-center mb-4 px-1 sticky top-0 z-10 py-2 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-sm">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Próximas Citas</h2>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                citas.length > 0 
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-800'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700'
            }`}>
                {citas.length} {citas.length === 1 ? 'Pendiente' : 'Pendientes'}
            </span>
        </div>

        {/* ESTADO DE CARGA / VACÍO */}
        {!cargando && citas.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-20 opacity-50">
                <span className="text-4xl mb-2">☕</span>
                <p className="text-gray-500 dark:text-slate-400">Todo tranquilo por hoy</p>
            </div>
        )}

        {/* LISTA DE TARJETAS */}
        <div className="space-y-3">
            {citas.map((cita) => (
                <div key={cita.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 border-blue-500 relative transition-colors">
                    
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800 dark:text-white">
                                {getIcono(cita.especie)} {cita.mascota}
                                <span className="text-xs font-normal text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-900 px-2 py-0.5 rounded-full border border-gray-200 dark:border-slate-700">
                                    {cita.hora}
                                </span>
                            </h3>
                            <p className="text-green-600 dark:text-green-400 text-xs font-mono mt-1">
                                {cita.fecha?.seconds ? new Date(cita.fecha.seconds * 1000).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }) : ''}
                            </p>
                        </div>
                        
                        <button 
                            onClick={() => eliminarCita(cita.id)}
                            className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 dark:hover:text-red-300 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Detalles Médicos Resumidos */}
                    {(cita.raza || cita.edad) && (
                        <div className="bg-gray-50 dark:bg-slate-900/50 p-2 rounded text-xs grid grid-cols-2 gap-2 mb-2 border border-gray-100 dark:border-slate-700/50">
                            {cita.raza && <p className="text-gray-500 dark:text-slate-400">Raza: <span className="text-gray-700 dark:text-slate-300">{cita.raza}</span></p>}
                            {cita.edad && <p className="text-gray-500 dark:text-slate-400">Edad: <span className="text-gray-700 dark:text-slate-300">{cita.edad}</span></p>}
                        </div>
                    )}

                    {/* Datos Contacto */}
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-500 border-t border-gray-100 dark:border-slate-700 pt-2 mt-2">
                        <span className="flex items-center gap-1">👤 {cita.dueño}</span>
                        <a href={`tel:${cita.telefono}`} className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                            📞 {cita.telefono}
                        </a>
                    </div>
                </div>
            ))}
        </div>
        
        {/* Espacio extra al final para scroll cómodo */}
        <div className="h-10"></div>
    </main>
  );
}