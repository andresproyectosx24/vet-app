'use client';

import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase'; 
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';

// --- COMPONENTE DE GRÁFICA (SVG NATIVO) ---
const PesoChart = ({ historial }) => {
  // 1. Preparamos los datos
  const data = (historial || [])
    .filter(h => h.peso && !isNaN(parseFloat(h.peso)))
    .map(h => ({ 
        val: parseFloat(h.peso), 
        date: new Date(h.fecha),
        label: new Date(h.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
    }))
    .sort((a, b) => a.date - b.date);

  // Si no hay datos suficientes, mostramos mensaje
  if (data.length === 0) return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
          <span>⚖️</span>
          <p>No hay registros de peso aún.</p>
      </div>
  );

  // Configuración del SVG
  const height = 150; // Un poco más alto para el modal
  const width = 300; 
  const paddingX = 20;
  const paddingY = 20;

  const maxVal = Math.max(...data.map(d => d.val)) * 1.05;
  const minVal = Math.min(...data.map(d => d.val)) * 0.95;
  const range = maxVal - minVal || 1;

  const getX = (index) => {
      if (data.length === 1) return width / 2;
      return paddingX + (index / (data.length - 1)) * (width - 2 * paddingX);
  }
  const getY = (val) => height - paddingY - ((val - minVal) / range) * (height - 2 * paddingY);

  const points = data.map((d, i) => `${getX(i)},${getY(d.val)}`).join(' ');

  return (
     <div className="w-full relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
           <polyline 
             fill="none" 
             stroke="#3b82f6" 
             strokeWidth="2" 
             points={points} 
             strokeLinecap="round" 
             strokeLinejoin="round"
             className="drop-shadow-sm"
           />
           {data.map((d, i) => (
               <g key={i}>
                   <circle 
                     cx={getX(i)} 
                     cy={getY(d.val)} 
                     r="3" 
                     fill="#3b82f6" 
                     stroke="white" 
                     strokeWidth="1.5" 
                     className="dark:stroke-slate-800"
                   />
                   <text 
                     x={getX(i)} 
                     y={getY(d.val) - 8} 
                     textAnchor="middle" 
                     fontSize="9" 
                     fontWeight="bold" 
                     className="fill-gray-700 dark:fill-gray-200"
                   >
                       {d.val}
                   </text>
                    <text 
                     x={getX(i)} 
                     y={height} 
                     textAnchor="middle" 
                     fontSize="7" 
                     className="fill-gray-400"
                   >
                       {d.label}
                   </text>
               </g>
           ))}
        </svg>
     </div>
  );
};

export default function HistorialView({ paciente: pacienteInicial, onBack }) {
  const [pacienteEnVivo, setPacienteEnVivo] = useState(pacienteInicial);
  const [registroEditando, setRegistroEditando] = useState(null); 
  const [guardando, setGuardando] = useState(false);
  
  // NUEVO: Estado para mostrar/ocultar la gráfica flotante
  const [mostrarGrafica, setMostrarGrafica] = useState(false);

  const [formEdicion, setFormEdicion] = useState({
    motivo: '', diagnostico: '', tratamiento: '', notas: ''
  });

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

  const historial = [...(pacienteEnVivo.historial || [])].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const abrirEdicion = (registro) => {
    setRegistroEditando(registro);
    setFormEdicion({
        motivo: registro.motivo || '',
        diagnostico: registro.diagnostico || '',
        tratamiento: typeof registro.tratamiento === 'string' ? registro.tratamiento : 'Ver detalle en medicamentos',
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
          const nuevoHistorial = [...(pacienteEnVivo.historial || [])];
          const index = nuevoHistorial.findIndex(item => item.fecha === registroEditando.fecha);
          
          if (index !== -1) {
              nuevoHistorial[index] = {
                  ...nuevoHistorial[index],
                  motivo: formEdicion.motivo,
                  diagnostico: formEdicion.diagnostico,
                  tratamiento: formEdicion.tratamiento,
                  notas: formEdicion.notas,
                  editadoEl: new Date().toISOString()
              };

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

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900 relative">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-20 shadow-sm">
        <button onClick={onBack} className="text-2xl text-gray-500 dark:text-gray-400">←</button>
        <div className="flex-1">
            <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-gray-800 dark:text-white">Historial Clínico</h2>
                {/* BOTÓN PARA ABRIR GRÁFICA */}
                <button 
                    onClick={() => setMostrarGrafica(true)}
                    className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider hover:scale-105 transition-transform"
                >
                    ⚖️ Ver Peso
                </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Paciente: {pacienteEnVivo.nombre}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        
        {/* VENTANA FLOTANTE (MODAL) DE GRÁFICA */}
        {mostrarGrafica && (
            <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setMostrarGrafica(false)}
            >
                <div 
                    className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-sm relative"
                    onClick={(e) => e.stopPropagation()} // Evita cerrar si clickean dentro
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">Evolución de Peso</h3>
                        <button onClick={() => setMostrarGrafica(false)} className="text-gray-400 hover:text-red-500 text-xl">✕</button>
                    </div>
                    
                    <PesoChart historial={pacienteEnVivo.historial} />
                    
                    <div className="mt-4 text-center">
                         <span className="text-xs text-gray-400">Datos basados en consultas finalizadas</span>
                    </div>
                </div>
            </div>
        )}

        {/* MODO EDICIÓN */}
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

        {/* LISTA CRONOLÓGICA */}
        <div className="space-y-6 relative">
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-slate-700 z-0"></div>

            {historial.map((registro, index) => (
                <div key={index} className="relative pl-10 z-10 group">
                    <div className="absolute left-[12px] top-5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"></div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                        
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

                        <div className="space-y-2 text-sm">
                            {registro.peso && (
                                <div className="inline-block bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs font-bold px-2 py-1 rounded-full mb-1">
                                    ⚖️ {registro.peso} kg
                                </div>
                            )}

                            {registro.diagnostico && (
                                <div className="bg-gray-50 dark:bg-slate-700/30 p-2 rounded border-l-2 border-orange-400">
                                    <span className="font-bold text-gray-700 dark:text-gray-300 block text-xs">Diagnóstico:</span>
                                    <p className="text-gray-600 dark:text-gray-400">{registro.diagnostico}</p>
                                </div>
                            )}
                            
                            {registro.tratamiento && (
                                <div className="bg-gray-50 dark:bg-slate-700/30 p-2 rounded border-l-2 border-green-400">
                                    <span className="font-bold text-gray-700 dark:text-gray-300 block text-xs">Tratamiento:</span>
                                    <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                        {typeof registro.tratamiento === 'string' ? registro.tratamiento : 
                                            Array.isArray(registro.tratamiento) ? 
                                                registro.tratamiento.map(m => `• ${m.nombre} (${m.dosis} - ${m.frecuencia})`).join('\n') 
                                            : 'Ver detalles'}
                                    </p>
                                </div>
                            )}
                            
                            {registro.hallazgos && (
                                <div className="mt-2 text-gray-600 dark:text-gray-400 text-xs">
                                    <span className="font-bold">Hallazgos:</span> {registro.hallazgos}
                                </div>
                            )}

                            {registro.fotoHallazgos && (
                                <div className="mt-2 w-full h-32 bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden relative">
                                    <img src={registro.fotoHallazgos} alt="Hallazgos" className="w-full h-full object-cover" />
                                    <a href={registro.fotoHallazgos} target="_blank" className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md">Ver Foto</a>
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