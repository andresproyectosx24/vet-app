/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { db, storage } from '../../../lib/firebase'; 
import { collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import CartillaView from '../../../components/pacientes/CartillaView';
import HistorialView from '../../../components/pacientes/HistorialView';

// ==========================================
// 1. UTILIDADES Y COMPONENTES INTERNOS
// ==========================================

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

function FotoSection({ fotoPreview, onFotoChange, onFotoDelete }) {
  const procesarArchivo = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const archivoComprimido = await comprimirImagen(file);
        const url = URL.createObjectURL(archivoComprimido);
        onFotoChange(archivoComprimido, url);
      } catch (error) {
        console.error("Error:", error);
        alert("No se pudo procesar la imagen");
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative w-32 h-32">
        <div className="w-full h-full rounded-full bg-gray-200 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-lg flex items-center justify-center overflow-hidden">
          {fotoPreview ? (
            <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-5xl opacity-30">🐾</span>
          )}
        </div>

        <label className="absolute bottom-0 right-0 bg-blue-600 text-white w-9 h-9 rounded-full cursor-pointer hover:bg-blue-700 transition shadow-md z-10 flex items-center justify-center">
          <span className="text-sm">📷</span>
          <input type="file" accept="image/*" capture="environment" onChange={procesarArchivo} className="hidden" />
        </label>
      </div>

      <div className="flex gap-4 text-sm font-medium">
        <label className="flex items-center gap-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition">
          <span>📁 Galería</span>
          <input type="file" accept="image/*" onChange={procesarArchivo} className="hidden" />
        </label>
        
        {fotoPreview && (
          <button onClick={onFotoDelete} className="text-red-500 px-2">
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}


// ==========================================
// 2. PÁGINA PRINCIPAL
// ==========================================

export default function PacientesPage() {
  const [vista, setVista] = useState('lista'); 
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [pacienteActivo, setPacienteActivo] = useState(null); 
  const [guardando, setGuardando] = useState(false); 
  
  // NUEVO: Estado para alternar vista de archivados
  const [mostrarArchivados, setMostrarArchivados] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '', especie: 'perro', raza: '', edad: '', 
    dueño: '', telefono: '', notas: '', foto: null 
  });
  
  const [fotoFile, setFotoFile] = useState(null); 
  const [fotoPreview, setFotoPreview] = useState(null); 

  // 1. CARGA DE DATOS (EN VIVO)
  useEffect(() => {
    const q = query(collection(db, "pacientes"), orderBy("nombre", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setPacientes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  // 2. NAVEGACIÓN
  useEffect(() => {
    const handleBack = () => { 
        if (vista === 'cartilla' || vista === 'historial') {
            setVista('detalle'); 
        } else if (vista !== 'lista') {
            setVista('lista'); 
            setPacienteActivo(null);
        }
    };
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, [vista]);

  const irA = (nuevaVista, hash) => {
      window.history.pushState({ view: nuevaVista }, '', hash);
      setVista(nuevaVista);
  };

  const cerrarVista = () => {
      window.history.back();
  };

  const bloquearSwipe = (e) => {
    e.stopPropagation();
  };

  // --- LOGICA DEL FORMULARIO ---
  const handleInput = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const onFotoChange = (file, url) => {
      setFotoFile(file);
      setFotoPreview(url);
  };

  const onFotoDelete = () => {
      setFotoPreview(null);
      setFotoFile(null);
      setFormData({ ...formData, foto: null });
  };

  const guardarPaciente = async () => {
    if (!formData.nombre || !formData.dueño) return alert("Nombre y Dueño obligatorios");
    setGuardando(true); 

    try {
        let urlFinal = formData.foto; 

        if (pacienteActivo && pacienteActivo.foto) {
            if ((fotoFile !== null) || (!formData.foto && !fotoFile)) {
                try {
                    await deleteObject(ref(storage, pacienteActivo.foto));
                } catch (err) { console.warn("Foto antigua no encontrada"); }
            }
        }

        if (fotoFile) {
            const storageRef = ref(storage, `pacientes/${Date.now()}_${fotoFile.name}`);
            const snapshot = await uploadBytes(storageRef, fotoFile);
            urlFinal = await getDownloadURL(snapshot.ref);
        }

        const payload = { ...formData, foto: urlFinal, updatedAt: new Date() };

        if (pacienteActivo) {
            await updateDoc(doc(db, "pacientes", pacienteActivo.id), payload);
        } else {
            // NUEVO: Al crear, marcamos como activo explícitamente
            await addDoc(collection(db, "pacientes"), { ...payload, activo: true, createdAt: new Date() });
        }
        
        cerrarVista(); 
        resetForm();
    } catch (e) {
        console.error(e);
        alert("Error al guardar");
    } finally {
        setGuardando(false);
    }
  };

  const verDetalle = (paciente) => {
      setPacienteActivo(paciente);
      irA('detalle', '#detalle');
  };

  const editarPaciente = (paciente, e) => {
      e.stopPropagation(); 
      setPacienteActivo(paciente);
      setFormData({
          nombre: paciente.nombre, especie: paciente.especie, raza: paciente.raza,
          edad: paciente.edad, dueño: paciente.dueño, 
          telefono: paciente.telefono, notas: paciente.notas, foto: paciente.foto 
      });
      setFotoPreview(paciente.foto); 
      setFotoFile(null); 
      irA('formulario', '#formulario'); 
  };

  const crearNuevo = () => {
      resetForm();
      irA('formulario', '#formulario');
  }

  const resetForm = () => {
      setFormData({ nombre: '', especie: 'perro', raza: '', edad: '', dueño: '', telefono: '', notas: '', foto: null });
      setFotoPreview(null); setFotoFile(null); setPacienteActivo(null);
  };

  const inputClass = "w-full p-3 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all";

  // Datos en vivo para subvistas
  const pacienteVisualizado = pacientes.find(p => p.id === pacienteActivo?.id) || pacienteActivo;

  // FILTRO: Mostrar Activos o Archivados según el estado
  const pacientesVisibles = pacientes.filter(p => {
      const matchBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.dueño.toLowerCase().includes(busqueda.toLowerCase());
      const esArchivado = p.activo === false;
      
      if (mostrarArchivados) {
          return matchBusqueda && esArchivado;
      }
      // Por defecto mostramos los activos (o los que no tienen el campo activo definido aun)
      return matchBusqueda && p.activo !== false;
  });

  return (
    <div className="w-full h-full flex flex-col relative bg-gray-50 dark:bg-slate-900 transition-colors">
      
      {/* VISTA 1: LISTA */}
      {vista === 'lista' && (
        <>
            <main className="flex-1 overflow-y-auto p-4">
                <div className="top-0 z-10 bg-gray-50 dark:bg-slate-900 pb-2 pt-1">
                    <input 
                        type="text" 
                        placeholder={mostrarArchivados ? "🔍 Buscar en archivados..." : "🔍 Buscar paciente..."}
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className={`w-full p-3 rounded-xl border-none shadow-sm text-gray-900 dark:text-white placeholder-gray-400 transition-colors ${
                            mostrarArchivados ? 'bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-800' : 'bg-white dark:bg-slate-800'
                        }`}
                    />
                </div>

                {mostrarArchivados && (
                    <div className="text-center py-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg mb-2">
                        <p className="text-xs text-orange-600 dark:text-orange-400 font-bold">📂 Viendo Expedientes Archivados</p>
                    </div>
                )}

                <div className="space-y-3 mt-2">
                    {pacientesVisibles.map(p => (
                        <div key={p.id} onClick={() => verDetalle(p)} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm flex items-center gap-4 border-l-4 border-purple-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors relative">
                            <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                                {p.foto ? <img src={p.foto} alt={p.nombre} className="w-full h-full object-cover" /> : <span>{p.especie === 'perro' ? '🐶' : p.especie === 'gato' ? '🐱' : '🐰'}</span>}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 dark:text-white">{p.nombre}</h3>
                                <p className="text-xs text-gray-500 dark:text-slate-400">{p.raza || 'Sin raza'} • {p.dueño}</p>
                            </div>
                            
                            <button 
                                onClick={(e) => editarPaciente(p, e)}
                                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 transition-colors z-10"
                            >
                                ✎
                            </button>
                        </div>
                    ))}
                    {pacientesVisibles.length === 0 && (
                        <div className="text-center py-10 opacity-50">
                            <p className="text-gray-400 text-sm">
                                {mostrarArchivados ? "No hay pacientes archivados" : "No se encontraron pacientes"}
                            </p>
                        </div>
                    )}
                </div>

                {/* BOTÓN DISCRETO PARA VER HISTORIAL ARCHIVADO */}
                <div className="mt-8 text-center pb-4">
                    <button 
                        onClick={() => setMostrarArchivados(!mostrarArchivados)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline transition-colors p-2"
                    >
                        {mostrarArchivados ? "← Volver a lista activa" : "Ver expedientes archivados 📂"}
                    </button>
                </div>

                <div className="h-24"></div>
            </main>

            {!mostrarArchivados && (
                <button onClick={crearNuevo} className="absolute bottom-8 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl font-bold hover:scale-110 active:scale-95 transition-transform z-50">+</button>
            )}
        </>
      )}

      {/* VISTA 2: FORMULARIO */}
      {vista === 'formulario' && (
          <main 
            className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-slate-900 relative"
            onTouchStart={bloquearSwipe} onTouchMove={bloquearSwipe} onTouchEnd={bloquearSwipe}
          >
            <div className="flex justify-between items-center -mt-14 mb-6 -mx-4 sticky -top-5 bg-gray-100 dark:bg-slate-900 z-20 py-2 border-b border-gray-200 dark:border-slate-800 shadow-sm">
                <button onClick={cerrarVista} className="text-gray-500 dark:text-gray-400 font-medium px-2 py-1">Cancelar</button>
                <h2 className="font-bold text-gray-700 dark:text-white">{pacienteActivo ? 'Editar' : 'Nuevo'}</h2>
                <button onClick={guardarPaciente} disabled={guardando} className={`font-bold text-lg px-2 py-1 ${guardando ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {guardando ? 'Subiendo...' : 'Guardar'}
                </button>
            </div>

            <div className="max-w-md mx-auto space-y-6 relative z-10 mt-12">
                <FotoSection fotoPreview={fotoPreview} onFotoChange={onFotoChange} onFotoDelete={onFotoDelete} />

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-2">Datos Paciente</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <input name="nombre" placeholder="Nombre" value={formData.nombre} onChange={handleInput} className={inputClass} />
                        <select name="especie" value={formData.especie} onChange={handleInput} className={inputClass}>
                            <option value="perro">Perro 🐶</option>
                            <option value="gato">Gato 🐱</option>
                            <option value="otro">Otro 🐾</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                         <input name="raza" placeholder="Raza" value={formData.raza} onChange={handleInput} className={`${inputClass} text-sm`} />
                         <input name="edad" placeholder="Edad" value={formData.edad} onChange={handleInput} className={`${inputClass} text-sm`} />
                    </div>
                    <textarea name="notas" placeholder="Alergias, notas médicas..." value={formData.notas} onChange={handleInput} className={`${inputClass} h-20 text-sm`} />
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-2">Datos Dueño</h3>
                    <input name="dueño" placeholder="Nombre Dueño" value={formData.dueño} onChange={handleInput} className={inputClass} />
                    <input name="telefono" type="tel" placeholder="Teléfono" value={formData.telefono} onChange={handleInput} className={inputClass} />
                </div>

                {/* BOTONES DE GESTIÓN (ARCHIVAR/RESTAURAR/BORRAR) */}
                {pacienteActivo && (
                    <div className="mt-8 flex flex-col gap-3">
                        {pacienteActivo.activo === false ? (
                            // MODO ARCHIVADO: Restaurar o Borrar Definitivo
                            <>
                                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg text-center text-xs text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 mb-2">
                                    Este expediente está archivado desde: <br/> 
                                    <b>{new Date(pacienteActivo.archivadoEl).toLocaleDateString()}</b>
                                </div>
                                
                                <button 
                                    onClick={async () => {
                                        if(confirm("¿Restaurar este expediente a la lista activa?")) {
                                            await updateDoc(doc(db, "pacientes", pacienteActivo.id), { activo: true, archivadoEl: null });
                                            cerrarVista();
                                        }
                                    }} 
                                    className="w-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 py-3 rounded-lg font-bold border border-green-200 dark:border-green-800 hover:bg-green-100 transition-colors"
                                >
                                    ♻️ Restaurar Expediente
                                </button>

                                <button 
                                    onClick={async () => {
                                        if(confirm("⚠ ¿ESTÁS SEGURO? Se borrará permanentemente y NO se podrá recuperar.")) {
                                            try { if (pacienteActivo.foto) await deleteObject(ref(storage, pacienteActivo.foto)); } catch (e) {}
                                            await deleteDoc(doc(db, "pacientes", pacienteActivo.id));
                                            cerrarVista();
                                        }
                                    }} 
                                    className="w-full text-red-500 text-xs py-3 hover:underline"
                                >
                                    Eliminar Definitivamente (Irreversible)
                                </button>
                            </>
                        ) : (
                            // MODO ACTIVO: Archivar
                            <button 
                                onClick={async () => {
                                    if(confirm("¿Archivar este expediente? Desaparecerá de la lista principal pero podrás consultarlo después.")) {
                                        await updateDoc(doc(db, "pacientes", pacienteActivo.id), { 
                                            activo: false, 
                                            archivadoEl: new Date().toISOString() 
                                        });
                                        cerrarVista();
                                    }
                                }} 
                                className="w-full text-gray-400 dark:text-gray-500 text-sm py-4 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            >
                                📁 Archivar Expediente
                            </button>
                        )}
                    </div>
                )}
                
                <div className="h-20"></div>
            </div>
          </main>
      )}

      {/* VISTA 3: MENÚ DE DETALLES */}
      {vista === 'detalle' && pacienteVisualizado && (
          <main 
            className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-900 relative flex flex-col"
            onTouchStart={bloquearSwipe} onTouchMove={bloquearSwipe} onTouchEnd={bloquearSwipe}
          >
             <div className="flex flex-col items-center mt-8 mb-10">
                <div className="w-28 h-28 rounded-full bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center overflow-hidden border-4 border-white dark:border-slate-700 mb-4">
                    {pacienteVisualizado.foto ? <img src={pacienteVisualizado.foto} alt={pacienteVisualizado.nombre} className="w-full h-full object-cover" /> : <span className="text-5xl">{pacienteVisualizado.especie === 'perro' ? '🐶' : pacienteVisualizado.especie === 'gato' ? '🐱' : '🐰'}</span>}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{pacienteVisualizado.nombre}</h2>
                <p className="text-gray-500 dark:text-gray-400">{pacienteVisualizado.raza} • {pacienteVisualizado.edad}</p>
                {pacienteVisualizado.activo === false && (
                    <span className="mt-2 bg-orange-100 text-orange-700 text-xs px-3 py-1 rounded-full font-bold">ARCHIVADO</span>
                )}
             </div>

             <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto w-full">
                 <button onClick={() => irA('historial', '#historial')} className="flex items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-slate-700 group">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📋</div>
                    <div className="text-left"><h3 className="font-bold text-gray-800 dark:text-white text-lg">Historial Clínico</h3><p className="text-xs text-gray-500 dark:text-gray-400">Consultas, diagnósticos y notas</p></div>
                 </button>

                 <button 
                    onClick={() => irA('cartilla', '#cartilla')} 
                    className="flex items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-slate-700 group"
                 >
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">💉</div>
                    <div className="text-left"><h3 className="font-bold text-gray-800 dark:text-white text-lg">Cartilla de Vacunación</h3><p className="text-xs text-gray-500 dark:text-gray-400">Registro de vacunas y desparasitación</p></div>
                 </button>
             </div>

             <div className="mt-auto mb-20 text-center">
                 <button onClick={cerrarVista} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium py-3 px-6 rounded-lg">← Volver a la lista</button>
             </div>
          </main>
      )}

      {/* VISTA 4: CARTILLA */}
      {vista === 'cartilla' && pacienteVisualizado && (
          <main 
            className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900 relative flex flex-col"
            onTouchStart={bloquearSwipe} onTouchMove={bloquearSwipe} onTouchEnd={bloquearSwipe}
          >
              <CartillaView paciente={pacienteVisualizado} onBack={cerrarVista} />
          </main>
      )}

      {/* VISTA 5: HISTORIAL */}
      {vista === 'historial' && pacienteVisualizado && (
          <main 
            className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900 relative flex flex-col"
            onTouchStart={bloquearSwipe} onTouchMove={bloquearSwipe} onTouchEnd={bloquearSwipe}
          >
              <HistorialView paciente={pacienteVisualizado} onBack={cerrarVista} />
          </main>
      )}
    </div>
  );
}