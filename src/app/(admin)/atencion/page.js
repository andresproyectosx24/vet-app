'use client';

import { useState, useEffect } from 'react';
import { db, storage, auth } from '../../../lib/firebase'; 
import { collection, doc, query, orderBy, where, onSnapshot, updateDoc, arrayUnion, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- UTILIDAD: COMPRESIÓN DE IMÁGENES (Local) ---
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
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Error al comprimir'));
          resolve(new File([blob], archivo.name, { type: 'image/jpeg', lastModified: Date.now() }));
        }, 'image/jpeg', 0.7); 
      };
    };
    reader.onerror = (e) => reject(e);
  });
};

const getTodayStr = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

// Helper para bloquear gestos del layout padre
const bloquearSwipe = (e) => e.stopPropagation();

// ==========================================
// 1. SELECTOR INICIAL
// ==========================================
function SelectorInicial({ onSelect }) {
  const [citasHoy, setCitasHoy] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  // Cargar Citas de Hoy (Manual Sort para evitar errores de índice)
  useEffect(() => {
    const hoy = getTodayStr();
    const q = query(collection(db, "citas"), where("fechaSolo", "==", hoy));
    
    const unsub = onSnapshot(q, snap => {
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs = docs
            .filter(c => c.estado !== 'finalizada')
            .sort((a, b) => a.hora.localeCompare(b.hora));
        setCitasHoy(docs);
    });
    return () => unsub();
  }, []);

  // Cargar Todos los Pacientes
  useEffect(() => {
    const q = query(collection(db, "pacientes"));
    const unsub = onSnapshot(q, snap => {
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setPacientes(docs);
    });
    return () => unsub();
  }, []);

  // FILTRO INTELIGENTE: Oculta pacientes archivados (activo === false)
  const pacientesFiltrados = pacientes.filter(p => 
    p.activo !== false && // <--- ESTA LÍNEA OCULTA LOS ARCHIVADOS
    (p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.dueño.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const crearYAtender = async () => {
      if(!busqueda) return;
      const nombre = busqueda;
      const dueno = prompt("Nombre del dueño:");
      if(!dueno) return;

      const docRef = await addDoc(collection(db, "pacientes"), {
          nombre, dueño: dueno, especie: 'perro', fechaRegistro: new Date().toISOString(), vacunas: [], historial: [], activo: true
      });
      onSelect({ id: docRef.id, nombre, dueño: dueno, vacunas: [], historial: [] }, null);
  };

  // Helper para comparar textos suavemente
  const cleanStr = (str) => str ? str.toLowerCase().trim() : '';

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900 p-4">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Sala de Espera</h1>

      {/* CITAS DE HOY */}
      {citasHoy.length > 0 && (
          <div className="mb-6 flex-none">
              <h2 className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">📅 Agendados para hoy</h2>
              
              {/* AQUÍ ESTÁ EL CAMBIO: Bloqueamos swipe en este contenedor */}
              <div 
                className="flex gap-3 overflow-x-auto pb-2 snap-x"
                onTouchStart={bloquearSwipe}
                onTouchMove={bloquearSwipe}
                onTouchEnd={bloquearSwipe}
              >
                  {citasHoy.map(cita => (
                      <div 
                        key={cita.id} 
                        onClick={() => {
                            const pacienteReal = pacientes.find(p => 
                                cleanStr(p.nombre) === cleanStr(cita.mascota) && 
                                cleanStr(p.dueño) === cleanStr(cita.dueño)
                            );
                            
                            if (pacienteReal) {
                                if (pacienteReal.activo === false) {
                                    alert("Este paciente está archivado. Restauralo en la sección de Pacientes para atenderlo.");
                                } else {
                                    onSelect(pacienteReal, cita.id);
                                }
                            } else {
                                alert("No encontré el expediente exacto. Búscalo manualmente abajo.");
                                setBusqueda(cita.mascota);
                            }
                        }}
                        className="min-w-[160px] bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border-l-4 border-blue-500 cursor-pointer snap-center active:scale-95 transition-transform"
                      >
                          <span className="text-xs font-bold bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">{cita.hora}</span>
                          <h3 className="font-bold text-gray-800 dark:text-white mt-1 truncate">{cita.mascota}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{cita.motivo}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* BUSCADOR */}
      <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">🔍 Paciente sin cita</h2>
          <input 
            type="text" 
            placeholder="Buscar por nombre o dueño..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full p-4 rounded-xl bg-white dark:bg-slate-800 border-none shadow-sm text-lg mb-4 outline-none focus:ring-2 focus:ring-green-500 text-gray-800 dark:text-white"
          />
          
          <div className="flex-1 overflow-y-auto space-y-2 pb-4">
            {busqueda && pacientesFiltrados.length === 0 && (
                <div 
                    onClick={crearYAtender}
                    className="p-4 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-500 text-center cursor-pointer active:bg-blue-50 dark:active:bg-blue-900/20"
                >
                    No existe &ldquo;{busqueda}&rdquo;.<br/><b>+ Tocar para Crear y Atender</b>
                </div>
            )}

            {pacientesFiltrados.map(p => {
              const citaDeHoy = citasHoy.find(c => 
                  cleanStr(c.mascota) === cleanStr(p.nombre) && 
                  cleanStr(c.dueño) === cleanStr(p.dueño)
              );

              return (
                  <div 
                    key={p.id} 
                    onClick={() => onSelect(p, citaDeHoy ? citaDeHoy.id : null)} 
                    className={`bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-slate-700 ${citaDeHoy ? 'border border-blue-400' : ''}`}
                  >
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          {p.nombre}
                          {citaDeHoy && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 rounded-full">TIENE CITA HOY</span>}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{p.raza} • {p.dueño}</p>
                    </div>
                    <span className="text-xl text-gray-300">➜</span>
                  </div>
              );
            })}
          </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. WORKSPACE DE ATENCIÓN
// ==========================================
function Workspace({ paciente, citaId, onExit }) {
  const [modo, setModo] = useState('consulta'); 
  const [avanzado, setAvanzado] = useState(false); 
  const [guardando, setGuardando] = useState(false);
  const [expandirVacuna, setExpandirVacuna] = useState(false); 

  const [hallazgosFoto, setHallazgosFoto] = useState(null); 
  const [hallazgosPreview, setHallazgosPreview] = useState(null); 
  
  const [vacunaFoto, setVacunaFoto] = useState(null); 
  const [vacunaPreview, setVacunaPreview] = useState(null); 

  const [form, setForm] = useState({
    peso: paciente.peso || '',
    motivo: '',
    anamnesis: '', 
    diagnostico: '',
    tratamientoTexto: '', 
    notas: ''
  });

  const [vacunaForm, setVacunaForm] = useState({
      nombre: '',
      fecha: getTodayStr(),
      proxima: '',
      observaciones: '' 
  });

  const [medicamentos, setMedicamentos] = useState([]);
  const [medTemp, setMedTemp] = useState({ nombre: '', dosis: '', frecuencia: '', duracion: '' });

  // Helper para bloquear swipe (Ya definido arriba, pero lo pasamos aquí también por claridad si se separara)
  const bloquearSwipe = (e) => e.stopPropagation();

  useEffect(() => {
      window.history.pushState({ view: 'workspace' }, '', '#workspace');
      const handleBack = () => onExit();
      window.addEventListener('popstate', handleBack);
      return () => window.removeEventListener('popstate', handleBack);
  }, []);

  const procesarFoto = async (e, setFile, setPreview, autoExpand = false) => {
      const file = e.target.files[0];
      if (file) {
          try {
              const comp = await comprimirImagen(file);
              setFile(comp);
              setPreview(URL.createObjectURL(comp));
              if(autoExpand) setExpandirVacuna(true);
          } catch (err) { alert("Error imagen"); }
      }
  };

  const handleInput = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleVacuna = (e) => setVacunaForm({ ...vacunaForm, [e.target.name]: e.target.value });

  const agregarMedicamento = () => {
      if(!medTemp.nombre) return;
      setMedicamentos([...medicamentos, { ...medTemp, activo: true }]);
      setMedTemp({ nombre: '', dosis: '', frecuencia: '', duracion: '' });
  };

  const finalizarAtencion = async () => {
      if (modo === 'consulta' && !form.diagnostico) return alert("Falta el diagnóstico");
      if (modo === 'vacuna' && !vacunaForm.nombre) return alert("Falta nombre de vacuna");

      setGuardando(true);
      try {
          const timestamp = new Date().toISOString();
          const batchUpdate = {};
          
          let urlHallazgos = null;
          let urlVacuna = null;

          if (hallazgosFoto) {
              const refH = ref(storage, `pacientes/${paciente.id}/historial/${Date.now()}_h.jpg`);
              const snapH = await uploadBytes(refH, hallazgosFoto);
              urlHallazgos = await getDownloadURL(snapH.ref);
          }
          if (vacunaFoto) {
              const refV = ref(storage, `pacientes/${paciente.id}/vacunas/${Date.now()}_v.jpg`);
              const snapV = await uploadBytes(refV, vacunaFoto);
              urlVacuna = await getDownloadURL(snapV.ref);
          }

          if (modo === 'consulta') {
              const consultaData = {
                  fecha: timestamp,
                  tipo: 'Consulta',
                  peso: form.peso,
                  motivo: form.motivo || 'Revisión General',
                  hallazgos: form.anamnesis,
                  fotoHallazgos: urlHallazgos, 
                  diagnostico: form.diagnostico,
                  tratamiento: avanzado ? medicamentos : form.tratamientoTexto,
                  notas: form.notas,
                  veterinario: auth.currentUser?.email
              };
              batchUpdate.historial = arrayUnion(consultaData);
          }

          if (modo === 'vacuna' || (modo === 'consulta' && vacunaForm.nombre)) {
              const nuevaVacuna = {
                  id: Date.now().toString(),
                  nombre: vacunaForm.nombre,
                  fecha: vacunaForm.fecha,
                  proxima: vacunaForm.proxima || null,
                  observaciones: vacunaForm.observaciones || null, 
                  foto: urlVacuna, 
                  creadoEl: timestamp
              };
              batchUpdate.vacunas = arrayUnion(nuevaVacuna);
              
              if (modo === 'vacuna') {
                  batchUpdate.historial = arrayUnion({
                      fecha: timestamp,
                      tipo: 'Vacunación',
                      motivo: `Aplicación de ${vacunaForm.nombre}`,
                      peso: form.peso
                  });
              }
          }

          if (form.peso) batchUpdate.peso = form.peso;
          batchUpdate.ultimaAtencion = timestamp;

          // GUARDAR
          await updateDoc(doc(db, "pacientes", paciente.id), batchUpdate);
          
          // CERRAR CITA (Si existe)
          if (citaId) {
              await updateDoc(doc(db, "citas", citaId), { estado: 'finalizada' });
          }

          window.history.back(); 

      } catch (e) {
          console.error(e);
          alert("Error al guardar");
          setGuardando(false);
      }
  };

  const inputClass = "w-full p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-green-500 transition-all text-gray-800 dark:text-white";
  const labelClass = "text-xs font-bold text-gray-500 uppercase mb-1 block tracking-wider mt-3";

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-900" onTouchStart={bloquearSwipe} onTouchMove={bloquearSwipe}>
      
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-3">
            <button onClick={() => window.history.back()} className="text-gray-400 hover:text-red-500 text-2xl">✕</button>
            <div>
                <h2 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{paciente.nombre}</h2>
                <span className="text-xs text-gray-500">{paciente.especie}</span>
            </div>
        </div>
        <div className="w-20">
            <label className="text-[10px] text-gray-400 block text-right">PESO (KG)</label>
            <input type="number" name="peso" value={form.peso} onChange={handleInput} className="w-full text-right bg-transparent font-mono font-bold text-gray-800 dark:text-white outline-none border-b border-gray-300 focus:border-green-500" placeholder="0.0" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        
        {/* TABS */}
        <div className="flex p-1 bg-gray-200 dark:bg-slate-800 rounded-xl mb-6">
            <button onClick={() => setModo('consulta')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${modo === 'consulta' ? 'bg-white dark:bg-slate-700 shadow text-green-600' : 'text-gray-500'}`}>🩺 Consulta</button>
            <button onClick={() => setModo('vacuna')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${modo === 'vacuna' ? 'bg-white dark:bg-slate-700 shadow text-purple-600' : 'text-gray-500'}`}>💉 Solo Vacuna</button>
        </div>

        {/* --- FORMULARIO --- */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {modo === 'consulta' && (
                <>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm">
                        <label className={labelClass}>Motivo de Consulta</label>
                        <input name="motivo" value={form.motivo} onChange={handleInput} placeholder="Ej. Vómitos..." className={inputClass} />
                        
                        <label className={labelClass}>Hallazgos Clínicos / Fotos</label>
                        <textarea name="anamnesis" value={form.anamnesis} onChange={handleInput} rows="3" placeholder="Temp, FC, FR..." className={inputClass} />
                        
                        <div className="mt-2 flex items-center gap-3">
                            <label className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer">
                                📷 Agregar Foto
                                <input type="file" accept="image/*" capture="environment" onChange={(e) => procesarFoto(e, setHallazgosFoto, setHallazgosPreview)} className="hidden" />
                            </label>
                            {hallazgosPreview && (
                                <div className="relative w-12 h-12 rounded overflow-hidden border border-gray-300">
                                    <img src={hallazgosPreview} className="w-full h-full object-cover" />
                                    <button onClick={() => {setHallazgosFoto(null); setHallazgosPreview(null)}} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center font-bold">✕</button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                        <label className={labelClass}>Diagnóstico</label>
                        <input name="diagnostico" value={form.diagnostico} onChange={handleInput} placeholder="Ej. Gastroenteritis" className={`${inputClass} font-bold`} />
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Plan Terapéutico</label>
                            <button onClick={() => setAvanzado(!avanzado)} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded font-bold">{avanzado ? 'Texto Simple' : 'Avanzado'}</button>
                        </div>
                        {!avanzado ? (
                            <textarea name="tratamientoTexto" value={form.tratamientoTexto} onChange={handleInput} rows="4" className={inputClass} />
                        ) : (
                            <div className="space-y-3 bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg">
                                <div className="grid grid-cols-2 gap-2">
                                    <input placeholder="Medicamento" value={medTemp.nombre} onChange={e => setMedTemp({...medTemp, nombre: e.target.value})} className="p-2 rounded border text-sm" />
                                    <input placeholder="Dosis" value={medTemp.dosis} onChange={e => setMedTemp({...medTemp, dosis: e.target.value})} className="p-2 rounded border text-sm" />
                                </div>
                                <button onClick={agregarMedicamento} className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded">+ Agregar</button>
                                {medicamentos.map((m, i) => <div key={i} className="text-xs bg-white p-2 rounded">{m.nombre} - {m.dosis}</div>)}
                            </div>
                        )}
                    </div>
                </>
            )}

            {(modo === 'vacuna' || modo === 'consulta') && (
                <div className={`p-4 rounded-xl border transition-colors ${modo === 'vacuna' ? 'bg-white dark:bg-slate-800 border-gray-200' : 'bg-purple-50 dark:bg-slate-800/50 border-purple-100'}`}>
                    <label className="text-xs font-bold text-purple-600 uppercase mb-2 block">{modo === 'vacuna' ? 'Datos de Vacunación' : '¿Se aplicó vacuna?'}</label>
                    <input name="nombre" value={vacunaForm.nombre} onChange={handleVacuna} placeholder="Nombre de vacuna" className={inputClass} />
                    {(modo === 'vacuna' || vacunaForm.nombre) && (
                        <div className="mt-3 space-y-3 animate-in fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={labelClass}>Fecha</label><input type="date" name="fecha" value={vacunaForm.fecha} onChange={handleVacuna} className={inputClass} /></div>
                                <div><label className={labelClass}>Próxima</label><input type="date" name="proxima" value={vacunaForm.proxima} onChange={handleVacuna} className={inputClass} /></div>
                            </div>
                            <button onClick={() => setExpandirVacuna(!expandirVacuna)} className="text-xs font-bold text-gray-400 flex items-center gap-1">{expandirVacuna ? '▼ Ocultar Detalles' : '▶ Agregar Evidencia / Notas'}</button>
                            {expandirVacuna && (
                                <div className="bg-gray-100 dark:bg-slate-700/50 p-3 rounded-lg space-y-3">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">{vacunaPreview ? <img src={vacunaPreview} className="w-full h-full object-cover" /> : <span className="text-xl">📷</span>}</div>
                                        <label className="bg-blue-600 text-white text-xs px-3 py-2 rounded-lg font-bold cursor-pointer shadow-sm">FOTO ETIQUETA<input type="file" accept="image/*" capture="environment" onChange={(e) => procesarFoto(e, setVacunaFoto, setVacunaPreview)} className="hidden" /></label>
                                    </div>
                                    <textarea name="observaciones" value={vacunaForm.observaciones} onChange={handleVacuna} placeholder="Lote, observaciones extra..." className="w-full p-2 text-sm rounded border border-gray-300 dark:border-slate-600 outline-none" rows="2" />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {modo === 'consulta' && (
                <>
                    <label className={labelClass}>Notas Generales</label>
                    <textarea name="notas" value={form.notas} onChange={handleInput} rows="2" className={inputClass} />
                </>
            )}
        </div>

        <button onClick={finalizarAtencion} disabled={guardando} className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-transform active:scale-95 text-lg mt-6 mb-10">{guardando ? 'Guardando...' : 'Finalizar Atención'}</button>
      </div>
    </div>
  );
}

// ==========================================
// 3. PÁGINA PRINCIPAL
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