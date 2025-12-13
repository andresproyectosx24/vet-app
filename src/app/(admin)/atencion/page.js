'use client';

import { useState, useEffect } from 'react';
import { db, storage, auth } from '../../../lib/firebase'; 
import { collection, doc, query, orderBy, where, onSnapshot, updateDoc, arrayUnion, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- UTILIDAD: FECHA LOCAL ---
const getTodayStr = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

// ==========================================
// 1. SELECTOR INICIAL (Citas Hoy + Buscador)
// ==========================================
function SelectorInicial({ onSelect }) {
  const [citasHoy, setCitasHoy] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [creandoExpress, setCreandoExpress] = useState(false); // Para pacientes nuevos "al vuelo"

  // Cargar Citas de Hoy
  useEffect(() => {
    const hoy = getTodayStr();
    const q = query(collection(db, "citas"), where("fechaSolo", "==", hoy), orderBy("hora", "asc"));
    const unsub = onSnapshot(q, snap => {
        setCitasHoy(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.estado !== 'finalizada'));
    });
    return () => unsub();
  }, []);

  // Cargar Todos los Pacientes (para buscar)
  useEffect(() => {
    const q = query(collection(db, "pacientes"), orderBy("nombre", "asc"));
    const unsub = onSnapshot(q, snap => {
        setPacientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const pacientesFiltrados = pacientes.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.dueño.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Función rápida para crear paciente y atenderlo de inmediato
  const crearYAtender = async (nombre, dueno) => {
      if(!nombre || !dueno) return;
      const docRef = await addDoc(collection(db, "pacientes"), {
          nombre, dueño, especie: 'perro', fechaRegistro: new Date().toISOString(), vacunas: [], historial: []
      });
      onSelect({ id: docRef.id, nombre, dueño, vacunas: [], historial: [] }, null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900 p-4">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Sala de Espera</h1>

      {/* SECCIÓN 1: CITAS DE HOY */}
      {citasHoy.length > 0 && (
          <div className="mb-6">
              <h2 className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">📅 Agendados para hoy</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                  {citasHoy.map(cita => (
                      <div 
                        key={cita.id} 
                        onClick={() => {
                            // Buscamos el paciente real asociado a la cita para tener su ID y datos completos
                            const pacienteReal = pacientes.find(p => p.nombre === cita.mascota && p.dueño === cita.dueño);
                            if (pacienteReal) onSelect(pacienteReal, cita.id);
                            else alert("No se encontró el expediente de este paciente. Créalo abajo.");
                        }}
                        className="min-w-[160px] bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border-l-4 border-blue-500 cursor-pointer hover:scale-105 transition-transform snap-center"
                      >
                          <span className="text-xs font-bold bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">{cita.hora}</span>
                          <h3 className="font-bold text-gray-800 dark:text-white mt-1 truncate">{cita.mascota}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{cita.motivo}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* SECCIÓN 2: BUSCADOR GENERAL */}
      <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">🔍 Paciente sin cita / Walk-in</h2>
          <input 
            type="text" 
            placeholder="Buscar por nombre o dueño..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full p-4 rounded-xl bg-white dark:bg-slate-800 border-none shadow-sm text-lg mb-4 outline-none focus:ring-2 focus:ring-green-500"
          />
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {/* Opción de Crear Nuevo Rápido si no existe */}
            {busqueda && pacientesFiltrados.length === 0 && (
                <div 
                    onClick={() => crearYAtender(busqueda, "Dueño Genérico")} // Simplificado para demo
                    className="p-4 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-500 text-center cursor-pointer"
                >
                    No existe &quot;{busqueda}&quot;. <b>+ Crear y Atender</b>
                </div>
            )}

            {pacientesFiltrados.map(p => (
              <div key={p.id} onClick={() => onSelect(p, null)} className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{p.nombre}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{p.raza} • {p.dueño}</p>
                </div>
                <span className="text-xl text-gray-300">➜</span>
              </div>
            ))}
          </div>
      </div>
      <div className="h-20"></div>
    </div>
  );
}

// ==========================================
// 2. WORKSPACE DE ATENCIÓN (El Cerebro)
// ==========================================
function Workspace({ paciente, citaId, onExit }) {
  // Modos: 'consulta' (Completa) | 'vacuna' (Rápida)
  const [modo, setModo] = useState('consulta'); 
  const [avanzado, setAvanzado] = useState(false); // Toggle para medicación compleja
  const [guardando, setGuardando] = useState(false);

  // Estado Formulario General
  const [form, setForm] = useState({
    peso: paciente.peso || '',
    motivo: '',
    anamnesis: '', // Hallazgos
    diagnostico: '',
    tratamientoTexto: '', // Versión simple
    notas: ''
  });

  // Estado Formulario Vacuna
  const [vacunaForm, setVacunaForm] = useState({
      nombre: '',
      fecha: getTodayStr(),
      proxima: ''
  });

  // Estado Medicamentos Estructurados (Modo Avanzado)
  const [medicamentos, setMedicamentos] = useState([]);
  const [medTemp, setMedTemp] = useState({ nombre: '', dosis: '', frecuencia: '', duracion: '' });

  // Helpers
  const handleInput = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleVacuna = (e) => setVacunaForm({ ...vacunaForm, [e.target.name]: e.target.value });

  const agregarMedicamento = () => {
      if(!medTemp.nombre) return;
      setMedicamentos([...medicamentos, { ...medTemp, activo: true }]);
      setMedTemp({ nombre: '', dosis: '', frecuencia: '', duracion: '' });
  };

  const finalizarAtencion = async () => {
      // Validaciones mínimas según el modo
      if (modo === 'consulta' && !form.diagnostico) return alert("Falta el diagnóstico");
      if (modo === 'vacuna' && !vacunaForm.nombre) return alert("Falta nombre de vacuna");

      setGuardando(true);
      try {
          const batchUpdate = {};
          const timestamp = new Date().toISOString();
          
          // 1. PREPARAR OBJETO DE HISTORIAL (CONSULTA)
          if (modo === 'consulta') {
              const consultaData = {
                  fecha: timestamp,
                  tipo: 'Consulta',
                  peso: form.peso,
                  motivo: form.motivo || 'Revisión General',
                  hallazgos: form.anamnesis,
                  diagnostico: form.diagnostico,
                  tratamiento: avanzado ? medicamentos : form.tratamientoTexto,
                  notas: form.notas,
                  veterinario: auth.currentUser?.email
              };
              // Usamos arrayUnion para agregar al historial
              batchUpdate.historial = arrayUnion(consultaData);
          }

          // 2. PREPARAR OBJETO DE VACUNA (SI APLICA)
          // Esto inyecta directamente en la cartilla del paciente
          if (modo === 'vacuna' || (modo === 'consulta' && vacunaForm.nombre)) {
              const nuevaVacuna = {
                  id: Date.now().toString(),
                  nombre: vacunaForm.nombre,
                  fecha: vacunaForm.fecha,
                  proxima: vacunaForm.proxima,
                  creadoEl: timestamp
              };
              batchUpdate.vacunas = arrayUnion(nuevaVacuna);
              
              // Si fue SOLO vacuna, agregamos un registro ligero al historial también
              if (modo === 'vacuna') {
                  batchUpdate.historial = arrayUnion({
                      fecha: timestamp,
                      tipo: 'Vacunación',
                      motivo: `Aplicación de ${vacunaForm.nombre}`,
                      peso: form.peso
                  });
              }
          }

          // 3. ACTUALIZAR PESO ACTUAL
          if (form.peso) batchUpdate.peso = form.peso;
          batchUpdate.ultimaAtencion = timestamp;

          // EJECUTAR ACTUALIZACIÓN EN FIRESTORE
          const pacienteRef = doc(db, "pacientes", paciente.id);
          await updateDoc(pacienteRef, batchUpdate);

          // 4. CERRAR CITA (Si venía de agenda)
          if (citaId) {
              await updateDoc(doc(db, "citas", citaId), { estado: 'finalizada' });
          }

          alert("¡Atención registrada con éxito!");
          onExit();

      } catch (e) {
          console.error(e);
          alert("Error al guardar");
      } finally {
          setGuardando(false);
      }
  };

  const inputClass = "w-full p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-green-500 transition-all text-gray-800 dark:text-white";
  const labelClass = "text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider mt-3";

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900">
      
      {/* HEADER SUPERIOR */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-3">
            <button onClick={onExit} className="text-gray-400 hover:text-red-500 text-2xl">✕</button>
            <div>
                <h2 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{paciente.nombre}</h2>
                <span className="text-xs text-gray-500">{paciente.especie}</span>
            </div>
        </div>
        <div className="w-20">
            <label className="text-[10px] text-gray-400 block text-right">PESO (KG)</label>
            <input 
                type="number" 
                name="peso" 
                value={form.peso} 
                onChange={handleInput} 
                className="w-full text-right bg-transparent font-mono font-bold text-gray-800 dark:text-white outline-none border-b border-gray-300 focus:border-green-500" 
                placeholder="0.0"
            />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        
        {/* SELECTOR DE MODO (TABS) */}
        <div className="flex p-1 bg-gray-200 dark:bg-slate-800 rounded-xl mb-6">
            <button 
                onClick={() => setModo('consulta')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${modo === 'consulta' ? 'bg-white dark:bg-slate-700 shadow text-green-600' : 'text-gray-500'}`}
            >
                🩺 Consulta
            </button>
            <button 
                onClick={() => setModo('vacuna')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${modo === 'vacuna' ? 'bg-white dark:bg-slate-700 shadow text-purple-600' : 'text-gray-500'}`}
            >
                💉 Solo Vacuna
            </button>
        </div>

        {/* --- FORMULARIO: SOLO VACUNA --- */}
        {modo === 'vacuna' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-purple-50 dark:bg-slate-800 p-4 rounded-xl border border-purple-100 dark:border-slate-700">
                    <h3 className="font-bold text-purple-700 dark:text-purple-400 mb-4">Registro Rápido de Vacunación</h3>
                    <label className={labelClass}>Vacuna Aplicada</label>
                    <input name="nombre" value={vacunaForm.nombre} onChange={handleVacuna} placeholder="Ej. Rabia" className={inputClass} autoFocus />
                    
                    <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                            <label className={labelClass}>Fecha</label>
                            <input type="date" name="fecha" value={vacunaForm.fecha} onChange={handleVacuna} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Próxima Dosis</label>
                            <input type="date" name="proxima" value={vacunaForm.proxima} onChange={handleVacuna} className={inputClass} />
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- FORMULARIO: CONSULTA COMPLETA --- */}
        {modo === 'consulta' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                
                {/* 1. Motivo y Hallazgos */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm">
                    <label className={labelClass}>Motivo de Consulta</label>
                    <input name="motivo" value={form.motivo} onChange={handleInput} placeholder="Ej. Vómitos, Decaimiento..." className={inputClass} />
                    
                    <label className={labelClass}>Hallazgos Clínicos / Examen Físico</label>
                    <textarea name="anamnesis" value={form.anamnesis} onChange={handleInput} rows="3" placeholder="Temp, FC, FR, Mucosas..." className={inputClass} />
                </div>

                {/* 2. Diagnóstico */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                    <label className={labelClass}>Diagnóstico</label>
                    <input name="diagnostico" value={form.diagnostico} onChange={handleInput} placeholder="Ej. Gastroenteritis infecciosa" className={`${inputClass} font-bold`} />
                </div>

                {/* 3. Tratamiento (Simple vs Avanzado) */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Plan Terapéutico</label>
                        <button onClick={() => setAvanzado(!avanzado)} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded font-bold">
                            {avanzado ? 'Cambiar a Texto Simple' : 'Modo Avanzado'}
                        </button>
                    </div>

                    {!avanzado ? (
                        <textarea 
                            name="tratamientoTexto" 
                            value={form.tratamientoTexto} 
                            onChange={handleInput} 
                            rows="4" 
                            placeholder="Ej. - Omeprazol 10mg c/24h&#10;- Dieta blanda x 3 días" 
                            className={inputClass} 
                        />
                    ) : (
                        <div className="space-y-3 bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg">
                            {/* Constructor de Medicamentos */}
                            <div className="grid grid-cols-2 gap-2">
                                <input placeholder="Medicamento" value={medTemp.nombre} onChange={e => setMedTemp({...medTemp, nombre: e.target.value})} className="p-2 rounded border text-sm" />
                                <input placeholder="Dosis/Vía" value={medTemp.dosis} onChange={e => setMedTemp({...medTemp, dosis: e.target.value})} className="p-2 rounded border text-sm" />
                                <input placeholder="Frecuencia" value={medTemp.frecuencia} onChange={e => setMedTemp({...medTemp, frecuencia: e.target.value})} className="p-2 rounded border text-sm" />
                                <input placeholder="Duración" value={medTemp.duracion} onChange={e => setMedTemp({...medTemp, duracion: e.target.value})} className="p-2 rounded border text-sm" />
                            </div>
                            <button onClick={agregarMedicamento} className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded">+ Agregar Medicamento</button>
                            
                            {/* Lista Agregada */}
                            {medicamentos.map((m, i) => (
                                <div key={i} className="flex justify-between bg-white p-2 rounded text-xs border shadow-sm">
                                    <span className="font-bold">{m.nombre}</span>
                                    <span className="text-gray-500">{m.dosis} - {m.frecuencia} ({m.duracion})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 4. ¿Aplicó Vacuna También? */}
                <div className="bg-purple-50 dark:bg-slate-800/50 p-4 rounded-xl border border-purple-100 dark:border-slate-700">
                    <label className="text-xs font-bold text-purple-600 uppercase mb-2 block">¿Se aplicó vacuna en esta consulta?</label>
                    <input name="nombre" value={vacunaForm.nombre} onChange={handleVacuna} placeholder="Nombre de vacuna (Opcional)" className={inputClass} />
                    {vacunaForm.nombre && (
                        <div className="mt-2 grid grid-cols-2 gap-2 animate-in fade-in">
                            <input type="date" name="fecha" value={vacunaForm.fecha} onChange={handleVacuna} className={inputClass} />
                            <input type="date" name="proxima" value={vacunaForm.proxima} onChange={handleVacuna} className={inputClass} />
                        </div>
                    )}
                </div>

                <label className={labelClass}>Notas / Observaciones</label>
                <textarea name="notas" value={form.notas} onChange={handleInput} rows="2" className={inputClass} />
            </div>
        )}

        <button 
            onClick={finalizarAtencion}
            disabled={guardando}
            className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-transform active:scale-95 text-lg mt-6 mb-10"
        >
            {guardando ? 'Guardando...' : 'Finalizar Atención'}
        </button>

      </div>
    </div>
  );
}

// ==========================================
// 3. PÁGINA PRINCIPAL (Router de Vistas)
// ==========================================
export default function AtencionPage() {
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [citaAsociada, setCitaAsociada] = useState(null);

  const iniciarAtencion = (paciente, citaId = null) => {
      setPacienteSeleccionado(paciente);
      setCitaAsociada(citaId);
  };

  return (
    <div className="h-full flex flex-col">
        {!pacienteSeleccionado ? (
            <SelectorInicial onSelect={iniciarAtencion} />
        ) : (
            <Workspace 
                paciente={pacienteSeleccionado} 
                citaId={citaAsociada} 
                onExit={() => { setPacienteSeleccionado(null); setCitaAsociada(null); }} 
            />
        )}
    </div>
  );
}