/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react'; 
import { db, storage } from '../../lib/firebase'; 
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// --- FUNCIÓN DE COMPRESIÓN ---
const comprimirImagen = (archivo) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(archivo);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Error al comprimir'));
          resolve(new File([blob], archivo.name, { type: 'image/jpeg', lastModified: Date.now() }));
        }, 'image/jpeg', 0.7); 
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

export default function CartillaView({ paciente: pacienteInicial, onBack }) {
  const [pacienteEnVivo, setPacienteEnVivo] = useState(pacienteInicial);
  
  const [agregando, setAgregando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [expandirOpcionales, setExpandirOpcionales] = useState(false);

  const [form, setForm] = useState({
    vacuna: '',
    fecha: new Date().toISOString().split('T')[0],
    proxima: '',
    observaciones: '',
    foto: null
  });
  
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoFile, setFotoFile] = useState(null);

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

  const handleInput = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFoto = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const comprimido = await comprimirImagen(file);
        setFotoFile(comprimido); 
        setFotoPreview(URL.createObjectURL(comprimido));
        setExpandirOpcionales(true); 
      } catch (err) {
        console.error(err);
        alert("Error al procesar imagen");
      }
    }
  };

  const guardarVacuna = async () => {
    if (!form.vacuna || !form.fecha) return alert("Nombre de vacuna y fecha son obligatorios");
    
    setGuardando(true);
    try {
      let urlFoto = null;

      if (fotoFile) {
        const storageRef = ref(storage, `pacientes/${pacienteInicial.id}/vacunas/${Date.now()}_evidencia.jpg`);
        const snapshot = await uploadBytes(storageRef, fotoFile);
        urlFoto = await getDownloadURL(snapshot.ref);
      }

      const nuevaVacuna = {
        id: Date.now().toString(),
        nombre: form.vacuna,
        fecha: form.fecha,
        proxima: form.proxima || null,
        observaciones: form.observaciones || null,
        foto: urlFoto,
        creadoEl: new Date().toISOString()
      };

      const pacienteRef = doc(db, "pacientes", pacienteInicial.id);
      await updateDoc(pacienteRef, {
        vacunas: arrayUnion(nuevaVacuna)
      });

      setAgregando(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Error al guardar vacuna");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarVacuna = async (vacuna) => {
    if (!confirm("¿Borrar este registro de vacuna?")) return;
    try {
      if (vacuna.foto) {
        try {
            await deleteObject(ref(storage, vacuna.foto));
        } catch (e) { console.warn("Foto no encontrada en storage"); }
      }

      const pacienteRef = doc(db, "pacientes", pacienteInicial.id);
      await updateDoc(pacienteRef, {
        vacunas: arrayRemove(vacuna)
      });
    } catch (e) {
      alert("Error al eliminar");
    }
  };

  const resetForm = () => {
    setForm({ vacuna: '', fecha: new Date().toISOString().split('T')[0], proxima: '', observaciones: '', foto: null });
    setFotoFile(null);
    setFotoPreview(null);
    setExpandirOpcionales(false);
  };

  const listaVacunas = (pacienteEnVivo.vacunas || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900 relative">
      
      <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-20 shadow-sm">
        <button onClick={onBack} className="text-2xl text-gray-500 dark:text-gray-400">←</button>
        <div>
            <h2 className="font-bold text-lg text-gray-800 dark:text-white">Cartilla de Vacunación</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Paciente: {pacienteEnVivo.nombre}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        
        {agregando ? (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md mb-6 border border-blue-100 dark:border-blue-900 animate-in fade-in zoom-in duration-300">
                <h3 className="font-bold text-blue-600 dark:text-blue-400 mb-3">Nueva Aplicación</h3>
                
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Vacuna *</label>
                        <input 
                            name="vacuna" 
                            placeholder="Ej. Rabia, Sextuple..." 
                            value={form.vacuna} 
                            onChange={handleInput} 
                            className="w-full p-2 border-b border-gray-300 dark:border-slate-600 bg-transparent outline-none text-lg text-gray-900 dark:text-white placeholder-gray-300"
                            autoFocus
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Fecha Aplicación *</label>
                            <input type="date" name="fecha" value={form.fecha} onChange={handleInput} className="w-full p-2 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 text-gray-800 dark:text-white" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-blue-500 uppercase">Próxima Dosis</label>
                            <input type="date" name="proxima" value={form.proxima} onChange={handleInput} className="w-full p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800 text-gray-800 dark:text-white" />
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => setExpandirOpcionales(!expandirOpcionales)}
                    className="flex items-center gap-2 text-xs text-gray-400 font-bold mt-4 mb-2"
                >
                    {expandirOpcionales ? '▼ Ocultar Opcionales' : '▶ Agregar Evidencia / Notas (Opcional)'}
                </button>

                {expandirOpcionales && (
                    <div className="bg-gray-50 dark:bg-slate-700/30 p-3 rounded-lg space-y-3 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gray-200 dark:bg-slate-600 rounded-lg overflow-hidden flex-shrink-0 border border-gray-300 dark:border-slate-500 flex items-center justify-center">
                                {fotoPreview ? (
                                    <img src={fotoPreview} className="w-full h-full object-cover" alt="Etiqueta" />
                                ) : (
                                    <span className="text-2xl">📷</span>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="bg-blue-600 text-white text-xs px-3 py-2 rounded-lg font-bold cursor-pointer text-center shadow-sm active:scale-95 transition-transform">
                                    Tomar Foto Etiqueta
                                    <input type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
                                </label>
                                {fotoPreview && <button onClick={() => {setFotoFile(null); setFotoPreview(null)}} className="text-xs text-red-500 text-left">Eliminar foto</button>}
                            </div>
                        </div>

                        <textarea 
                            name="observaciones" 
                            placeholder="Lote, laboratorio, reacciones..." 
                            value={form.observaciones} 
                            onChange={handleInput} 
                            className="w-full p-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg outline-none text-gray-700 dark:text-gray-300"
                            rows="2"
                        />
                    </div>
                )}

                <div className="flex gap-3 mt-6">
                    {/* CAMBIO 1: Botón cancelar rojo */}
                    <button 
                        onClick={() => {setAgregando(false); resetForm();}} 
                        className="flex-1 py-3 text-red-600 dark:text-red-400 font-bold bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-900"
                    >
                        Cancelar
                    </button>
                    <button onClick={guardarVacuna} disabled={guardando} className="flex-1 py-3 text-white font-bold bg-green-600 hover:bg-green-700 rounded-lg shadow-lg">
                        {guardando ? 'Guardando...' : 'Registrar Vacuna'}
                    </button>
                </div>
            </div>
        ) : (
            <button 
                onClick={() => setAgregando(true)}
                className="w-full py-4 mb-6 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-400 dark:text-slate-500 font-bold hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-center gap-2"
            >
                <span className="text-xl">+</span> Registrar Nueva Vacuna
            </button>
        )}

        <div className="space-y-4 relative">
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-slate-700 z-0"></div>

            {listaVacunas.map((vacuna) => (
                <div key={vacuna.id} className="relative pl-10 z-10 group">
                    {/* CAMBIO 2: Alineación perfecta de la bolita (left-[12px]) */}
                    <div className="absolute left-[12px] top-4 w-2.5 h-2.5 bg-purple-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"></div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700/50">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-white text-lg">{vacuna.nombre}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">Aplicada: {vacuna.fecha}</p>
                            </div>
                            <button onClick={() => eliminarVacuna(vacuna)} className="text-gray-300 hover:text-red-400 p-1">🗑</button>
                        </div>

                        {vacuna.proxima && (
                            <div className="mt-3 inline-block bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded font-medium border border-blue-100 dark:border-blue-900/30">
                                📅 Próxima: {vacuna.proxima}
                            </div>
                        )}

                        {(vacuna.foto || vacuna.observaciones) && (
                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 text-sm">
                                {vacuna.observaciones && <p className="text-gray-600 dark:text-gray-300 italic mb-2">&ldquo;{vacuna.observaciones}&rdquo;</p>}
                                {vacuna.foto && (
                                    <div className="w-full h-32 bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden relative group/img">
                                        <img src={vacuna.foto} alt="Evidencia" className="w-full h-full object-cover" />
                                        <a href={vacuna.foto} target="_blank" className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md">Ver Full</a>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {listaVacunas.length === 0 && !agregando && (
                <div className="text-center py-10 text-gray-400 italic">
                    No hay vacunas registradas aún.
                </div>
            )}
        </div>
      </div>
    </div>
  );
}