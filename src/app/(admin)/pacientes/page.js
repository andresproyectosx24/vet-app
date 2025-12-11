'use client';

import { useState, useEffect } from 'react';
// Ruta relativa correcta
import { db } from '../../../lib/firebase'; 
import { collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot, deleteDoc } from 'firebase/firestore';

export default function PacientesPage() {
  const [vista, setVista] = useState('lista'); // 'lista' | 'formulario'
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [pacienteActivo, setPacienteActivo] = useState(null); 
  
  // Datos del Formulario
  const [formData, setFormData] = useState({
    nombre: '', especie: 'perro', raza: '', edad: '', peso: '',
    dueño: '', telefono: '', notas: '', fotoPreview: null
  });
  const [vacunas, setVacunas] = useState([]); 

  // 1. CARGA DE DATOS
  useEffect(() => {
    const q = query(collection(db, "pacientes"), orderBy("nombre", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setPacientes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  // 2. MANEJO DE INPUTS
  const handleInput = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        setFormData({ ...formData, fotoPreview: url });
    }
  };

  // 3. LÓGICA VACUNAS
  const agregarVacuna = () => setVacunas([...vacunas, { nombre: '', fecha: '', proxima: '' }]);
  
  const updateVacuna = (index, campo, valor) => {
    const nuevas = [...vacunas];
    nuevas[index][campo] = valor;
    setVacunas(nuevas);
  };

  const borrarVacuna = (index) => setVacunas(vacunas.filter((_, i) => i !== index));

  // 4. GUARDAR / EDITAR
  const guardarPaciente = async () => {
    if (!formData.nombre || !formData.dueño) return alert("Nombre y Dueño obligatorios");

    const payload = {
        ...formData,
        fotoPreview: null, // Placeholder: requiere Storage real para guardar imagen
        vacunas: vacunas,
        updatedAt: new Date()
    };

    try {
        if (pacienteActivo) {
            await updateDoc(doc(db, "pacientes", pacienteActivo.id), payload);
        } else {
            await addDoc(collection(db, "pacientes"), { ...payload, createdAt: new Date() });
        }
        setVista('lista');
        setPacienteActivo(null);
        resetForm();
    } catch (e) {
        console.error(e);
        alert("Error al guardar");
    }
  };

  const editarPaciente = (paciente) => {
      setPacienteActivo(paciente);
      setFormData({
          nombre: paciente.nombre, especie: paciente.especie, raza: paciente.raza,
          edad: paciente.edad, peso: paciente.peso, dueño: paciente.dueño,
          telefono: paciente.telefono, notas: paciente.notas, fotoPreview: null
      });
      setVacunas(paciente.vacunas || []);
      setVista('formulario');
  };

  const resetForm = () => {
      setFormData({ nombre: '', especie: 'perro', raza: '', edad: '', peso: '', dueño: '', telefono: '', notas: '', fotoPreview: null });
      setVacunas([]);
  };

  // Estilos
  const inputClass = "w-full p-3 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all";

  return (
    // Contenedor principal sin Header (Layout lo maneja)
    <div className="h-full flex flex-col relative bg-gray-50 dark:bg-slate-900 transition-colors">
      
      {/* VISTA 1: LISTA DE PACIENTES */}
      {vista === 'lista' && (
        <>
            <main className="flex-1 overflow-y-auto p-4">
                {/* Buscador */}
                <div className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-900 pb-2 pt-1">
                    <input 
                        type="text" 
                        placeholder="🔍 Buscar paciente..." 
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border-none shadow-sm text-gray-900 dark:text-white placeholder-gray-400"
                    />
                </div>

                <div className="space-y-3 mt-2">
                    {pacientes
                        .filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.dueño.toLowerCase().includes(busqueda.toLowerCase()))
                        .map(p => (
                        <div key={p.id} onClick={() => editarPaciente(p)} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm flex items-center gap-4 border-l-4 border-purple-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors relative">
                            {/* Avatar */}
                            <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-2xl">
                            {p.especie === 'perro' ? '🐶' : p.especie === 'gato' ? '🐱' : '🐰'}
                            </div>
                            
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 dark:text-white">{p.nombre}</h3>
                                <p className="text-xs text-gray-500 dark:text-slate-400">{p.raza || 'Sin raza'} • {p.dueño}</p>
                            </div>
                            <span className="text-gray-300 dark:text-slate-600 text-xl">›</span>
                        </div>
                    ))}
                </div>
                
                {/* Espacio final para scroll */}
                <div className="h-24"></div>
            </main>

            {/* BOTÓN FLOTANTE (FAB) */}
            <button 
                onClick={() => { setPacienteActivo(null); resetForm(); setVista('formulario'); }}
                className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl font-bold hover:scale-110 active:scale-95 transition-transform z-30"
            >
                +
            </button>
        </>
      )}

      {/* VISTA 2: FORMULARIO */}
      {vista === 'formulario' && (
          <main className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-slate-900 relative">
            
            {/* Barra de Acciones del Formulario (SIMPLIFICADA) */}
            {/* Quitamos margins negativos y paddings extraños. Simplemente sticky con un fondo sólido */}
            <div className="flex justify-between items-center -mt-14 mb-6 -mx-4 sticky -top-5 bg-gray-100 dark:bg-slate-900 z-20 py-2 border-b border-gray-200 dark:border-slate-800 shadow-sm">
                <button onClick={() => setVista('lista')} className="text-gray-500 dark:text-gray-400 font-medium px-2 py-1">Cancelar</button>
                <h2 className="font-bold text-gray-700 dark:text-white">{pacienteActivo ? 'Editar' : 'Nuevo'}</h2>
                <button onClick={guardarPaciente} className="text-blue-600 dark:text-blue-400 font-bold text-lg px-2 py-1">Guardar</button>
            </div>

            <div className="max-w-md mx-auto space-y-6 relative z-10">
                
                {/* FOTO (Cámara / Galería) - ESTRUCTURA CORREGIDA */}
                <div className="flex flex-col items-center justify-center gap-3">
                    {/* Contenedor RELATIVO solo para posicionamiento */}
                    <div className="relative w-32 h-32">
                        {/* 1. EL CÍRCULO (CON overflow-hidden) */}
                        <div className="w-full h-full rounded-full bg-gray-200 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-lg flex items-center justify-center overflow-hidden">
                            {formData.fotoPreview ? (
                                <img src={formData.fotoPreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-5xl opacity-30">🐾</span>
                            )}
                        </div>

                        {/* 2. EL BOTÓN CÁMARA (FUERA del overflow, posicionado absolutamente) */}
                        <label className="absolute bottom-0 right-0 bg-blue-600 text-white w-9 h-9 rounded-full cursor-pointer hover:bg-blue-700 transition shadow-md z-10 flex items-center justify-center">
                              <span className="text-sm">📷</span>
                             <input type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
                        </label>
                    </div>

                    {/* Opciones de Carga */}
                    <div className="flex gap-4 text-sm font-medium">
                        <label className="flex items-center gap-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition">
                            <span>📁 Galería</span>
                            <input type="file" accept="image/*" onChange={handleFoto} className="hidden" />
                        </label>
                        
                        {formData.fotoPreview && (
                            <button onClick={() => setFormData({...formData, fotoPreview: null})} className="text-red-500 px-2">
                                Eliminar
                            </button>
                        )}
                    </div>
                </div>

                {/* INFO BÁSICA */}
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
                         <input name="peso" placeholder="Kg" type="number" value={formData.peso} onChange={handleInput} className={`${inputClass} text-sm`} />
                    </div>
                    <textarea name="notas" placeholder="Alergias, notas médicas..." value={formData.notas} onChange={handleInput} className={`${inputClass} h-20 text-sm`} />
                </div>

                {/* DUEÑO */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-2">Datos Dueño</h3>
                    <input name="dueño" placeholder="Nombre Dueño" value={formData.dueño} onChange={handleInput} className={inputClass} />
                    <input name="telefono" type="tel" placeholder="Teléfono" value={formData.telefono} onChange={handleInput} className={inputClass} />
                </div>

                {/* VACUNAS */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b dark:border-slate-700 pb-2">
                        <h3 className="font-bold text-gray-700 dark:text-gray-200">💉 Vacunas</h3>
                        <button onClick={agregarVacuna} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full font-bold">+ Agregar</button>
                    </div>
                    
                    {vacunas.length === 0 && <p className="text-gray-400 text-sm italic text-center py-2">Sin registro de vacunas</p>}

                    {vacunas.map((vacuna, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-slate-700/30 p-3 rounded-lg flex flex-col gap-2 relative border border-gray-100 dark:border-slate-700">
                            <button onClick={() => borrarVacuna(index)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 font-bold text-xs p-1">✕</button>
                            
                            <input 
                                placeholder="Nombre Vacuna (Ej. Rabia)" 
                                value={vacuna.nombre} 
                                onChange={(e) => updateVacuna(index, 'nombre', e.target.value)}
                                className="bg-transparent border-b border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white text-sm outline-none pb-1 w-[90%]"
                            />
                            <div className="grid grid-cols-2 gap-3 text-xs mt-1">
                                <div>
                                    <label className="text-gray-500 block mb-1">Aplicada</label>
                                    <input type="date" value={vacuna.fecha} onChange={(e) => updateVacuna(index, 'fecha', e.target.value)} className="bg-transparent text-gray-700 dark:text-gray-300 w-full" />
                                </div>
                                <div>
                                    <label className="text-blue-500 block mb-1">Próxima</label>
                                    <input type="date" value={vacuna.proxima} onChange={(e) => updateVacuna(index, 'proxima', e.target.value)} className="bg-transparent text-gray-700 dark:text-gray-300 w-full font-medium" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* BORRAR PACIENTE */}
                {pacienteActivo && (
                    <button 
                        onClick={async () => {
                            if(confirm("¿Estás seguro de borrar este expediente completo?")) {
                                await deleteDoc(doc(db, "pacientes", pacienteActivo.id));
                                setVista('lista');
                            }
                        }} 
                        className="w-full text-red-500 dark:text-red-400 text-sm py-4 hover:underline"
                    >
                        Eliminar Expediente Permanentemente
                    </button>
                )}
                
                <div className="h-20"></div>
            </div>
          </main>
      )}
    </div>
  );
}