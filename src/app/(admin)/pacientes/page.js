/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { db, storage } from '../../../lib/firebase'; // Ajusta la ruta si es necesario
import { collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot, deleteDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import CartillaView from '../../../components/pacientes/CartillaView';
import HistorialView from '../../../components/pacientes/HistorialView';
import FotoSection from '../../../components/pacientes/FotoSection';

export default function PacientesPage() {
  const [vista, setVista] = useState('lista'); 
  const [pacientes, setPacientes] = useState([]);
  const [clientes, setClientes] = useState([]); // Nuevo: Lista de clientes para seleccionar
  const [busqueda, setBusqueda] = useState('');
  const [pacienteActivo, setPacienteActivo] = useState(null); 
  const [guardando, setGuardando] = useState(false); 
  const [mostrarArchivados, setMostrarArchivados] = useState(false);
  
  // Estado para el buscador de clientes en el formulario
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [sugerenciasClientes, setSugerenciasClientes] = useState([]);

  const [formData, setFormData] = useState({
    nombre: '', especie: 'perro', raza: '', edad: '', 
    clienteId: '', dueño: '', telefono: '', // clienteId es la clave ahora
    notas: '', foto: null 
  });
  
  const [fotoFile, setFotoFile] = useState(null); 
  const [fotoPreview, setFotoPreview] = useState(null); 

  // 1. CARGA DE DATOS (Pacientes y Clientes)
  useEffect(() => {
    // Cargar Pacientes
    const qPacientes = query(collection(db, "pacientes"), orderBy("nombre", "asc"));
    const unsubPacientes = onSnapshot(qPacientes, (snapshot) => {
        setPacientes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Cargar Clientes (Para el selector)
    const qClientes = query(collection(db, "clientes"), orderBy("nombre", "asc"));
    const unsubClientes = onSnapshot(qClientes, (snapshot) => {
        setClientes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubPacientes(); unsubClientes(); };
  }, []);

  // Filtrar sugerencias de clientes cuando el usuario escribe en el form
  useEffect(() => {
    if (busquedaCliente.length > 1) {
        const matches = clientes.filter(c => 
            c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()) || 
            c.telefono.includes(busquedaCliente)
        );
        setSugerenciasClientes(matches);
    } else {
        setSugerenciasClientes([]);
    }
  }, [busquedaCliente, clientes]);

  // NAVEGACIÓN
  useEffect(() => {
    const handleBack = () => { 
        if (vista === 'cartilla' || vista === 'historial') setVista('detalle'); 
        else if (vista !== 'lista') { setVista('lista'); setPacienteActivo(null); }
    };
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, [vista]);

  const irA = (nuevaVista, hash) => {
      window.history.pushState({ view: nuevaVista }, '', hash);
      setVista(nuevaVista);
  };

  const cerrarVista = () => window.history.back();

  const handleInput = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // Seleccionar un cliente de la lista sugerida
  const seleccionarCliente = (cliente) => {
      setFormData({
          ...formData,
          clienteId: cliente.id,
          dueño: cliente.nombre,
          telefono: cliente.telefono
      });
      setBusquedaCliente('');
      setSugerenciasClientes([]);
  };

  const onFotoChange = (file, url) => { setFotoFile(file); setFotoPreview(url); };
  const onFotoDelete = () => { setFotoPreview(null); setFotoFile(null); setFormData({ ...formData, foto: null }); };

  const guardarPaciente = async () => {
    if (!formData.nombre || !formData.clienteId) return alert("Nombre y Dueño (Cliente registrado) son obligatorios");
    setGuardando(true); 

    try {
        let urlFinal = formData.foto; 

        // Gestión de Foto (Igual que antes)
        if (pacienteActivo && pacienteActivo.foto && ((fotoFile !== null) || (!formData.foto && !fotoFile))) {
            try { await deleteObject(ref(storage, pacienteActivo.foto)); } catch (err) { console.warn("Error borrando foto vieja"); }
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

  const editarPaciente = (paciente, e) => {
      e.stopPropagation(); 
      setPacienteActivo(paciente);
      setFormData({
          nombre: paciente.nombre, especie: paciente.especie, raza: paciente.raza,
          edad: paciente.edad, dueño: paciente.dueño, clienteId: paciente.clienteId || '',
          telefono: paciente.telefono, notas: paciente.notas, foto: paciente.foto 
      });
      setFotoPreview(paciente.foto); 
      setFotoFile(null); 
      irA('formulario', '#formulario'); 
  };

  const crearNuevo = () => { resetForm(); irA('formulario', '#formulario'); }

  const resetForm = () => {
      setFormData({ nombre: '', especie: 'perro', raza: '', edad: '', clienteId: '', dueño: '', telefono: '', notas: '', foto: null });
      setFotoPreview(null); setFotoFile(null); setPacienteActivo(null);
  };

  const inputClass = "w-full p-3 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all";
  const pacienteVisualizado = pacientes.find(p => p.id === pacienteActivo?.id) || pacienteActivo;

  const pacientesVisibles = pacientes.filter(p => {
      const matchBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.dueño.toLowerCase().includes(busqueda.toLowerCase());
      const esArchivado = p.activo === false;
      return mostrarArchivados ? (matchBusqueda && esArchivado) : (matchBusqueda && p.activo !== false);
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
                        <div key={p.id} onClick={() => { setPacienteActivo(p); irA('detalle', '#detalle'); }} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm flex items-center gap-4 border-l-4 border-purple-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors relative">
                            <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                                {p.foto ? <img src={p.foto} alt={p.nombre} className="w-full h-full object-cover" /> : <span>{p.especie === 'perro' ? '🐶' : p.especie === 'gato' ? '🐱' : '🐰'}</span>}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 dark:text-white">{p.nombre}</h3>
                                <p className="text-xs text-gray-500 dark:text-slate-400">{p.raza || 'Sin raza'} • {p.dueño}</p>
                            </div>
                            <button onClick={(e) => editarPaciente(p, e)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 transition-colors z-10">✎</button>
                        </div>
                    ))}
                    {pacientesVisibles.length === 0 && <div className="text-center py-10 opacity-50"><p className="text-gray-400 text-sm">{mostrarArchivados ? "No hay pacientes archivados" : "No se encontraron pacientes"}</p></div>}
                </div>

                <div className="mt-8 text-center pb-4">
                    <button onClick={() => setMostrarArchivados(!mostrarArchivados)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline transition-colors p-2">
                        {mostrarArchivados ? "← Volver a lista activa" : "Ver expedientes archivados 📂"}
                    </button>
                </div>
                <div className="h-24"></div>
            </main>
            {!mostrarArchivados && <button onClick={crearNuevo} className="absolute bottom-8 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl font-bold hover:scale-110 active:scale-95 transition-transform z-50">+</button>}
        </>
      )}

      {/* VISTA 2: FORMULARIO */}
      {vista === 'formulario' && (
          <main className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-slate-900 relative">
            <div className="flex justify-between items-center -mt-14 mb-6 -mx-4 sticky -top-5 bg-gray-100 dark:bg-slate-900 z-20 py-2 border-b border-gray-200 dark:border-slate-800 shadow-sm px-4">
                <button onClick={cerrarVista} className="text-gray-500 dark:text-gray-400 font-medium px-2 py-1">Cancelar</button>
                <h2 className="font-bold text-gray-700 dark:text-white">{pacienteActivo ? 'Editar' : 'Nuevo'}</h2>
                <button onClick={guardarPaciente} disabled={guardando} className={`font-bold text-lg px-2 py-1 ${guardando ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'}`}>{guardando ? 'Subiendo...' : 'Guardar'}</button>
            </div>

            <div className="max-w-md mx-auto space-y-6 relative z-10 mt-12">
                <FotoSection fotoPreview={fotoPreview} onFotoChange={onFotoChange} onFotoDelete={onFotoDelete} />

                {/* SECCIÓN DE DATOS VETERINARIOS */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-2">Datos Paciente</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <input name="nombre" placeholder="Nombre Mascota" value={formData.nombre} onChange={handleInput} className={inputClass} />
                        <select name="especie" value={formData.especie} onChange={handleInput} className={inputClass}>
                            <option value="perro">Perro 🐶</option>
                            <option value="gato">Gato 🐱</option>
                            <option value="otro">Otro 🐾</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <input name="raza" placeholder="Raza" value={formData.raza} onChange={handleInput} className={`${inputClass} text-sm`} />
                         <input name="edad" placeholder="Edad" value={formData.edad} onChange={handleInput} className={`${inputClass} text-sm`} />
                    </div>
                    <textarea name="notas" placeholder="Alergias, notas médicas..." value={formData.notas} onChange={handleInput} className={`${inputClass} h-20 text-sm`} />
                </div>

                {/* SECCIÓN DE DUEÑO (VINCULACIÓN) */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3 border-l-4 border-orange-500">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-2 flex justify-between">
                        Datos Dueño
                        {formData.clienteId && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Vinculado ✓</span>}
                    </h3>
                    
                    {/* Buscador de clientes */}
                    <div className="relative">
                        <label className="text-xs text-gray-400 font-bold uppercase">Buscar Cliente Existente</label>
                        <input 
                            type="text" 
                            placeholder="Escribe nombre o teléfono..." 
                            value={busquedaCliente}
                            onChange={(e) => setBusquedaCliente(e.target.value)}
                            className={`${inputClass} bg-orange-50 dark:bg-slate-900 border-orange-200`}
                        />
                        {/* Dropdown de sugerencias */}
                        {sugerenciasClientes.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-700 shadow-xl rounded-lg mt-1 border border-gray-100 dark:border-slate-600 max-h-40 overflow-y-auto z-50">
                                {sugerenciasClientes.map(c => (
                                    <div 
                                        key={c.id} 
                                        onClick={() => seleccionarCliente(c)}
                                        className="p-3 border-b border-gray-100 dark:border-slate-600 hover:bg-orange-50 dark:hover:bg-slate-600 cursor-pointer"
                                    >
                                        <p className="font-bold text-gray-800 dark:text-white text-sm">{c.nombre}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-300">{c.telefono}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Datos fijos (Solo lectura o editables si no hay vínculo) */}
                    <div className="grid grid-cols-1 gap-2 opacity-80">
                        <input disabled name="dueño" placeholder="Nombre Dueño" value={formData.dueño} className={`${inputClass} bg-gray-100`} />
                        <input disabled name="telefono" placeholder="Teléfono" value={formData.telefono} className={`${inputClass} bg-gray-100`} />
                        {!formData.clienteId && <p className="text-xs text-red-400 mt-1">* Selecciona un cliente del buscador para guardar.</p>}
                    </div>
                </div>

                {/* BOTONES DE GESTIÓN (ARCHIVAR/RESTAURAR/BORRAR) - IGUAL QUE ANTES */}
                {pacienteActivo && (
                    <div className="mt-8 flex flex-col gap-3">
                        {pacienteActivo.activo === false ? (
                            <>
                                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg text-center text-xs text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 mb-2">
                                    Archivado el: <b>{new Date(pacienteActivo.archivadoEl).toLocaleDateString()}</b>
                                </div>
                                <button onClick={async () => { if(confirm("¿Restaurar?")) { await updateDoc(doc(db, "pacientes", pacienteActivo.id), { activo: true, archivadoEl: null }); cerrarVista(); }}} className="w-full bg-green-50 text-green-600 py-3 rounded-lg font-bold border border-green-200 hover:bg-green-100">♻️ Restaurar</button>
                                <button onClick={async () => { if(confirm("¿BORRAR DEFINITIVAMENTE?")) { try { if (pacienteActivo.foto) await deleteObject(ref(storage, pacienteActivo.foto)); } catch (e) {} await deleteDoc(doc(db, "pacientes", pacienteActivo.id)); cerrarVista(); }}} className="w-full text-red-500 text-xs py-3 hover:underline">Eliminar Definitivamente</button>
                            </>
                        ) : (
                            <button onClick={async () => { if(confirm("¿Archivar?")) { await updateDoc(doc(db, "pacientes", pacienteActivo.id), { activo: false, archivadoEl: new Date().toISOString() }); cerrarVista(); }}} className="w-full text-gray-400 text-sm py-4 hover:text-red-500">📁 Archivar Expediente</button>
                        )}
                    </div>
                )}
                <div className="h-20"></div>
            </div>
          </main>
      )}

      {/* VISTA 3: MENÚ DETALLE (Igual que antes) */}
      {vista === 'detalle' && pacienteVisualizado && (
          <main className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-900 relative flex flex-col">
             <div className="flex flex-col items-center mt-8 mb-10">
                <div className="w-28 h-28 rounded-full bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center overflow-hidden border-4 border-white dark:border-slate-700 mb-4">
                    {pacienteVisualizado.foto ? <img src={pacienteVisualizado.foto} alt={pacienteVisualizado.nombre} className="w-full h-full object-cover" /> : <span className="text-5xl">{pacienteVisualizado.especie === 'perro' ? '🐶' : pacienteVisualizado.especie === 'gato' ? '🐱' : '🐰'}</span>}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{pacienteVisualizado.nombre}</h2>
                <p className="text-gray-500 dark:text-gray-400">{pacienteVisualizado.raza} • {pacienteVisualizado.edad}</p>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-slate-800 px-3 py-1 rounded-full">👤 {pacienteVisualizado.dueño}</div>
             </div>

             <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto w-full">
                 <button onClick={() => irA('historial', '#historial')} className="flex items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-slate-700 group">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📋</div>
                    <div className="text-left"><h3 className="font-bold text-gray-800 dark:text-white text-lg">Historial Clínico</h3><p className="text-xs text-gray-500 dark:text-gray-400">Consultas, diagnósticos y notas</p></div>
                 </button>
                 <button onClick={() => irA('cartilla', '#cartilla')} className="flex items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-slate-700 group">
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">💉</div>
                    <div className="text-left"><h3 className="font-bold text-gray-800 dark:text-white text-lg">Cartilla de Vacunación</h3><p className="text-xs text-gray-500 dark:text-gray-400">Registro de vacunas y desparasitación</p></div>
                 </button>
             </div>

             <div className="mt-auto mb-20 text-center">
                 <button onClick={cerrarVista} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium py-3 px-6 rounded-lg">← Volver a la lista</button>
             </div>
          </main>
      )}

      {/* VISTA 4 y 5 (Cartilla e Historial) */}
      {vista === 'cartilla' && pacienteVisualizado && <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900"><CartillaView paciente={pacienteVisualizado} onBack={cerrarVista} /></main>}
      {vista === 'historial' && pacienteVisualizado && <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900"><HistorialView paciente={pacienteVisualizado} onBack={cerrarVista} /></main>}
    </div>
  );
}