'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase'; // Ajusta si tu alias @ funciona, si no usa ../../lib/firebase
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';

export default function HistorialView({ paciente: pacienteInicial, onBack }) {
  const [pacienteEnVivo, setPacienteEnVivo] = useState(pacienteInicial);
  const [registroEditando, setRegistroEditando] = useState(null); // Si no es null, muestra el formulario de edición
  const [guardando, setGuardando] = useState(false);

  // Formulario temporal para la edición
  const [formEdicion, setFormEdicion] = useState({
    motivo: '',
    diagnostico: '',
    tratamiento: '',
    notas: ''
  });

  // 1. Escuchar cambios en vivo (Igual que en Cartilla)
  useEffect(() => {
    if (!pacienteInicial?.id) return;
    const docRef = doc(db, "pacientes", pacienteInicial.id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            setPacienteEnVivo({ id: docSnap.id, ...docSnap.data() });
        }
    });
    return () => unsubscribe();
  }, [pacienteInicial?.id]);

  // Ordenar historial: Lo más reciente arriba
  const historial = (pacienteEnVivo.historial || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // 2. Manejo de Edición
  const abrirEdicion = (registro) => {
    setRegistroEditando(registro);
    setFormEdicion({
        motivo: registro.motivo || '',
        diagnostico: registro.diagnostico || '',
        tratamiento: registro.tratamiento || '',
        notas: registro.notas || ''
    });
  };

  const cancelarEdicion = () => {
    setRegistroEditando(null);
    setFormEdicion({ motivo: '', diagnostico: '', tratamiento: '', notas: '' });
  };

  const handleInput = (e) => {
      setFormEdicion({ ...formEdicion, [e.target.name]: e.target.value });
  };

  const guardarCambios = async () => {
      setGuardando(true);
      try {
          // Copiamos el historial actual
          const nuevoHistorial = [...(pacienteEnVivo.historial || [])];
          
          // Buscamos el índice del registro que estamos editando
          const index = nuevoHistorial.findIndex(item => item.fecha === registroEditando.fecha); // Usamos fecha como ID temporal si no hay ID único
          
          if (index !== -1) {
              // Actualizamos solo los campos permitidos
              nuevoHistorial[index] = {
                  ...nuevoHistorial[index],
                  motivo: formEdicion.motivo,
                  diagnostico: formEdicion.diagnostico,
                  tratamiento: formEdicion.tratamiento,
                  notas: formEdicion.notas,
                  editadoEl: new Date().toISOString() // Marca de auditoría
              };

              // Guardamos en Firebase (Sobreescribimos el array completo con la modificación)
              await updateDoc(doc(db, "pacientes", pacienteEnVivo.id), {
                  historial: nuevoHistorial
              });
              
              cancelarEdicion();
          }
      } catch (error) {
          console.error(error);
          alert("Error al actualizar el historial");
      } finally {
          setGuardando(false);
      }
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900 relative">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-20 shadow-sm">
        <button onClick={onBack} className="text-2xl text-gray-500 dark:text-gray-400">←</button>
        <div>
            <h2 className="font-bold text-lg text-gray-800 dark:text-white">Historial Clínico</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Paciente: {pacienteEnVivo.nombre}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        
        {/* MODO EDICIÓN (Overlay o Inline) */}
        {registroEditando ? (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-blue-500 animate-in fade-in zoom-in duration-200 mb-6">
                <div className="flex justify-between items-center mb-4 border-b dark:border-slate-700 pb-2">
                    <h3 className="font-bold text-blue-600 dark:text-blue-400">Editando Consulta</h3>
                    <span className="text-xs text-gray-400">{new Date(registroEditando.fecha).toLocaleDateString()}</span>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Motivo Consulta</label>
                        <input name="motivo" value={formEdicion.motivo} onChange={handleInput} className="w-full p-2 border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-600 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Diagnóstico</label>
                        <textarea name="diagnostico" value={formEdicion.diagnostico} onChange={handleInput} rows="2" className="w-full p-2 border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-600 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tratamiento / Receta</label>
                        <textarea name="tratamiento" value={formEdicion.tratamiento} onChange={handleInput} rows="3" className="w-full p-2 border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-600 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Notas Internas</label>
                        <textarea name="notas" value={formEdicion.notas} onChange={handleInput} rows="2" className="w-full p-2 border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-600 text-gray-900 dark:text-white text-sm" />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={cancelarEdicion} className="flex-1 py-3 text-gray-500 font-bold bg-gray-100 dark:bg-slate-700 rounded-lg">Cancelar</button>
                    <button onClick={guardarCambios} disabled={guardando} className="flex-1 py-3 text-white font-bold bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg">
                        {guardando ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        ) : null}

        {/* LISTA CRONOLÓGICA (Solo Lectura con botón editar) */}
        <div className="space-y-6 relative">
            {/* Línea de tiempo */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-slate-700 z-0"></div>

            {historial.map((registro, index) => (
                <div key={index} className="relative pl-10 z-10 group">
                    {/* Punto Cronológico */}
                    <div className="absolute left-[12px] top-5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"></div>

                    {/* Tarjeta de Historial */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                        
                        {/* Cabecera Tarjeta */}
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-xs text-blue-500 font-bold uppercase tracking-wider">
                                    {new Date(registro.fecha).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                                <h3 className="font-bold text-gray-900 dark:text-white text-lg mt-1">
                                    {registro.motivo || 'Consulta General'}
                                </h3>
                            </div>
                            <button 
                                onClick={() => abrirEdicion(registro)}
                                className="text-gray-400 hover:text-blue-500 p-2"
                            >
                                ✎
                            </button>
                        </div>

                        {/* Contenido Médico */}
                        <div className="space-y-2 text-sm">
                            {registro.diagnostico && (
                                <div className="bg-gray-50 dark:bg-slate-700/30 p-2 rounded border-l-2 border-orange-400">
                                    <span className="font-bold text-gray-700 dark:text-gray-300 block text-xs">Diagnóstico:</span>
                                    <p className="text-gray-600 dark:text-gray-400">{registro.diagnostico}</p>
                                </div>
                            )}
                            
                            {registro.tratamiento && (
                                <div className="bg-gray-50 dark:bg-slate-700/30 p-2 rounded border-l-2 border-green-400">
                                    <span className="font-bold text-gray-700 dark:text-gray-300 block text-xs">Tratamiento:</span>
                                    <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{registro.tratamiento}</p>
                                </div>
                            )}

                            {registro.notas && (
                                <p className="text-xs text-gray-400 italic pt-2 border-t dark:border-slate-700 mt-2">
                                    Nota: {registro.notas}
                                </p>
                            )}
                        </div>

                    </div>
                </div>
            ))}

            {historial.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <span className="text-4xl mb-2">📂</span>
                    <p className="text-gray-500 dark:text-gray-400 text-center text-sm">
                        No hay historial previo.<br/>
                        Las consultas aparecerán aquí cuando atiendas al paciente.
                    </p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}