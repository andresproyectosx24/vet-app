'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase'; 
import { collection, deleteDoc, doc, query, orderBy, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';

// Helper para fechas locales (YYYY-MM-DD)
const getLocalDateStr = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

export default function DashboardVeterinario() {
  const [vista, setVista] = useState('lista'); 
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  // --- ESTADOS DE VISTA ---
  const [modoVista, setModoVista] = useState('dia'); // 'dia' | 'semana' | 'mes'
  const [fechaActual, setFechaActual] = useState(new Date()); 

  const [citaActiva, setCitaActiva] = useState(null);
  const [guardando, setGuardando] = useState(false);
  
  const [formData, setFormData] = useState({
    dueño: '', telefono: '', mascota: '', especie: 'perro',
    raza: '', edad: '', fecha: '', hora: '', motivo: ''
  });

  // 1. CARGA DE DATOS
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

  // 2. NAVEGACIÓN NATIVA
  useEffect(() => {
    const handleBack = () => {
        setVista('lista');
        setCitaActiva(null);
    };
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, []);

  // --- LÓGICA DE FECHAS ---
  const cambiarFecha = (cantidad) => {
      const nuevaFecha = new Date(fechaActual);
      if (modoVista === 'mes') {
          nuevaFecha.setMonth(fechaActual.getMonth() + cantidad);
      } else if (modoVista === 'semana') {
          nuevaFecha.setDate(fechaActual.getDate() + (cantidad * 7));
      } else {
          nuevaFecha.setDate(fechaActual.getDate() + cantidad);
      }
      setFechaActual(nuevaFecha);
  };

  const esHoy = (fecha) => getLocalDateStr(fecha) === getLocalDateStr(new Date());

  const getTituloFecha = () => {
      const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
      if (modoVista === 'mes') opciones.weekday = undefined; // Solo Mes y Año
      if (modoVista === 'mes') opciones.day = undefined;
      
      let texto = fechaActual.toLocaleDateString('es-ES', opciones);
      // Capitalizar primera letra
      texto = texto.charAt(0).toUpperCase() + texto.slice(1);
      
      if (modoVista === 'dia' && esHoy(fechaActual)) {
          return `${texto} (Hoy)`;
      }
      return texto;
  };

  // --- FILTROS DE CITAS ---
  const getCitasDelDia = (fecha) => {
      const fechaStr = getLocalDateStr(fecha);
      return citas.filter(c => c.fechaSolo === fechaStr);
  };

  // --- GENERADORES DE CALENDARIO ---
  const getDiasSemana = () => {
      const start = new Date(fechaActual);
      const day = start.getDay(); // 0 (Domingo) - 6 (Sábado)
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Ajuste al Lunes
      start.setDate(diff);

      const dias = [];
      for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          dias.push(d);
      }
      return dias;
  };

  const getDiasMes = () => {
      const year = fechaActual.getFullYear();
      const month = fechaActual.getMonth();
      
      // Primer día del mes
      const start = new Date(year, month, 1);
      // Retroceder al Lunes previo para llenar la cuadrícula
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); 
      start.setDate(diff);

      const dias = [];
      // 42 días cubren cualquier mes en una cuadrícula de 7x6
      for (let i = 0; i < 42; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          dias.push(d);
      }
      return dias;
  };

  // --- ACCIONES CRUD Y ESTADOS ---
  const cambiarEstadoCita = async (id, nuevoEstado, e) => {
      e.stopPropagation();
      try {
          await updateDoc(doc(db, "citas", id), { estado: nuevoEstado });
      } catch (error) {
          console.error("Error actualizando estado:", error);
      }
  };

  const eliminarCita = async (id, e) => {
    e.stopPropagation(); 
    if(!confirm("¿Borrar cita del historial permanentemente?")) return;
    try {
      await deleteDoc(doc(db, "citas", id));
    } catch (error) {
      alert("Error al eliminar");
    }
  };

  // ... (abrirFormulario, cerrarFormulario, handleInput, guardarCita, getIcono se mantienen igual) ...
  // Copia simplificada para brevedad, la lógica es la misma que ya tenías
  const abrirFormulario = (cita = null) => {
      window.history.pushState({ view: 'formulario' }, '', '#formulario');
      if (cita) {
          setCitaActiva(cita);
          let fechaStr = cita.fechaSolo || '';
          if (!fechaStr && cita.fecha?.seconds) fechaStr = new Date(cita.fecha.seconds * 1000).toISOString().split('T')[0];
          setFormData({
              dueño: cita.dueño || '', telefono: cita.telefono || '', mascota: cita.mascota || '', especie: cita.especie || 'perro',
              raza: cita.raza || '', edad: cita.edad || '', fecha: fechaStr, hora: cita.hora || '', motivo: cita.motivo || ''
          });
      } else {
          setCitaActiva(null);
          setFormData({ dueño: '', telefono: '', mascota: '', especie: 'perro', raza: '', edad: '', fecha: getLocalDateStr(fechaActual), hora: '', motivo: '' });
      }
      setVista('formulario');
  };

  const cerrarFormulario = () => {
      if (window.location.hash === '#formulario') window.history.back();
      else setVista('lista');
  };

  const handleInput = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const guardarCita = async () => {
      if (!formData.mascota || !formData.dueño || !formData.fecha || !formData.hora) return alert("Faltan datos");
      setGuardando(true);
      try {
          const fechaFinal = new Date(formData.fecha + 'T' + formData.hora);
          const payload = { ...formData, fecha: fechaFinal, fechaSolo: formData.fecha, estado: citaActiva?.estado || 'pendiente' };
          if (citaActiva) await updateDoc(doc(db, "citas", citaActiva.id), payload);
          else await addDoc(collection(db, "citas"), payload);
          cerrarFormulario();
      } catch (error) { alert("Error"); } finally { setGuardando(false); }
  };

  const getIcono = (especie) => {
      if(especie === 'perro') return '🐶';
      if(especie === 'gato') return '🐱';
      return '🐾';
  }

  const inputClass = "w-full p-3 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all";

  // --- RENDERIZADO DE TARJETA ---
  const renderCitaCard = (cita) => {
      // Definir estilos según estado
      let borderClass = 'border-blue-500';
      let bgClass = 'bg-white dark:bg-slate-800';
      
      if (cita.estado === 'asistio') {
          borderClass = 'border-green-500';
          bgClass = 'bg-green-50 dark:bg-green-900/20';
      } else if (cita.estado === 'no_asistio') {
          borderClass = 'border-red-500';
          bgClass = 'bg-red-50 dark:bg-red-900/20';
      }

      return (
        <div 
            key={cita.id} 
            onClick={() => abrirFormulario(cita)} 
            className={`${bgClass} p-4 rounded-xl shadow-sm border-l-4 ${borderClass} relative transition-colors cursor-pointer mb-3`}
        >
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800 dark:text-white">
                        {getIcono(cita.especie)} {cita.mascota}
                        <span className="text-xs font-normal text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-900 px-2 py-0.5 rounded-full border border-gray-200 dark:border-slate-700">
                            {cita.hora}
                        </span>
                    </h3>
                </div>
                
                {/* CONTROLES DE ESTADO (NUEVO) */}
                <div className="flex gap-2">
                    {/* Botón Asistió (Verde) */}
                    <button 
                        onClick={(e) => cambiarEstadoCita(cita.id, 'asistio', e)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${cita.estado === 'asistio' ? 'bg-green-500 text-white shadow-md scale-110' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/50 hover:text-green-600'}`}
                    >
                        ✓
                    </button>
                    {/* Botón No Asistió (Rojo) */}
                    <button 
                        onClick={(e) => cambiarEstadoCita(cita.id, 'no_asistio', e)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${cita.estado === 'no_asistio' ? 'bg-red-500 text-white shadow-md scale-110' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600'}`}
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-500 border-t border-gray-200/50 dark:border-slate-700 pt-2 mt-2">
                <span className="flex items-center gap-1">👤 {cita.dueño}</span>
                <div className="flex gap-3">
                    <span className="text-blue-600 dark:text-blue-400">📞 {cita.telefono}</span>
                    {/* Botón borrar sutil */}
                    <button onClick={(e) => eliminarCita(cita.id, e)} className="text-gray-300 hover:text-red-400">🗑</button>
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="h-full flex flex-col relative bg-gray-50 dark:bg-slate-900 transition-colors">
        
      {/* VISTA 1: LISTA (Día / Semana / Mes) */}
      {vista === 'lista' && (
        <>
            <main className="flex-1 overflow-y-auto p-4 relative">
                
                {/* HEADER DE CONTROLES */}
                <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-sm pb-4">
                    {/* Switcher de Vistas */}
                    <div className="flex bg-gray-200 dark:bg-slate-800 p-1 rounded-lg mb-4">
                        {['dia', 'semana', 'mes'].map((m) => (
                            <button 
                                key={m}
                                onClick={() => setModoVista(m)}
                                className={`flex-1 py-1 text-sm font-bold rounded-md transition-all capitalize ${modoVista === m ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
                            >
                                {m === 'dia' ? 'Día' : m === 'semana' ? 'Semana' : 'Mes'}
                            </button>
                        ))}
                    </div>

                    {/* Navegación de Fecha */}
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <button onClick={() => cambiarFecha(-1)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">←</button>
                        
                        <div className="text-center">
                            <h2 className="text-sm font-bold text-gray-800 dark:text-white">
                                {getTituloFecha()}
                            </h2>
                        </div>

                        <button onClick={() => cambiarFecha(1)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">→</button>
                    </div>
                </div>

                {/* CONTENIDO PRINCIPAL */}
                <div className="space-y-4">
                    
                    {/* --- VISTA DIARIA --- */}
                    {modoVista === 'dia' && (
                        <div>
                            {(() => {
                                const citasDia = getCitasDelDia(fechaActual);
                                if (citasDia.length === 0) return (
                                    <div className="text-center py-10 text-gray-400 dark:text-gray-600">
                                        <p>No hay citas para este día</p>
                                    </div>
                                );
                                return citasDia.map(renderCitaCard);
                            })()}
                        </div>
                    )}

                    {/* --- VISTA SEMANAL --- */}
                    {modoVista === 'semana' && (
                        <div className="space-y-6">
                            {getDiasSemana().map((dia) => {
                                const citasDia = getCitasDelDia(dia);
                                const esHoyDia = esHoy(dia);
                                
                                return (
                                    <div key={dia.toISOString()} className={`rounded-xl ${esHoyDia ? 'bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900' : ''}`}>
                                        <h3 className={`text-sm font-bold mb-3 px-2 flex justify-between ${esHoyDia ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>
                                            <span>{dia.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }).toUpperCase()}</span>
                                            {esHoyDia && <span className="text-xs bg-blue-100 text-blue-600 px-2 rounded-full">HOY</span>}
                                        </h3>
                                        
                                        {citasDia.length > 0 ? (
                                            citasDia.map(renderCitaCard)
                                        ) : (
                                            <p className="text-xs text-gray-300 dark:text-gray-700 px-4 mb-4 italic">Sin citas</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* --- VISTA MENSUAL (CALENDARIO) --- */}
                    {modoVista === 'mes' && (
                        <div className="grid grid-cols-7 gap-1 bg-gray-200 dark:bg-slate-800 p-1 rounded-xl">
                            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => (
                                <div key={d} className="text-center text-xs font-bold text-gray-500 py-2">{d}</div>
                            ))}
                            
                            {getDiasMes().map((dia, i) => {
                                const citasDia = getCitasDelDia(dia);
                                const esMismoMes = dia.getMonth() === fechaActual.getMonth();
                                const esHoyDia = esHoy(dia);
                                
                                return (
                                    <div 
                                        key={i} 
                                        onClick={() => { setFechaActual(dia); setModoVista('dia'); }}
                                        className={`
                                            h-14 bg-white dark:bg-slate-900 rounded-lg flex flex-col items-center justify-start pt-1 cursor-pointer transition-colors relative
                                            ${!esMismoMes ? 'opacity-30' : ''}
                                            ${esHoyDia ? 'ring-2 ring-blue-500 z-10' : ''}
                                        `}
                                    >
                                        <span className={`text-xs font-bold ${esHoyDia ? 'text-blue-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {dia.getDate()}
                                        </span>
                                        
                                        {/* Puntos indicadores de citas */}
                                        <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
                                            {citasDia.slice(0, 4).map(c => (
                                                <div 
                                                    key={c.id} 
                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                        c.estado === 'asistio' ? 'bg-green-500' : 
                                                        c.estado === 'no_asistio' ? 'bg-red-500' : 'bg-blue-400'
                                                    }`} 
                                                />
                                            ))}
                                            {citasDia.length > 4 && <span className="text-[8px] text-gray-400">+</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                <div className="h-24"></div>
            </main>

            {/* BOTÓN FLOTANTE (+) */}
            <button 
                onClick={() => abrirFormulario()}
                className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl font-bold hover:scale-110 active:scale-95 transition-transform z-30"
            >
                +
            </button>
        </>
      )}

      {/* VISTA 2: FORMULARIO */}
      {vista === 'formulario' && (
          <main className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-slate-900 relative">
            <div className="flex justify-between items-center -mt-14 mb-6 -mx-4 sticky -top-5 bg-gray-100 dark:bg-slate-900 z-20 py-2 border-b border-gray-200 dark:border-slate-800 shadow-sm">
                <button onClick={cerrarFormulario} className="text-gray-500 dark:text-gray-400 font-medium px-2 py-1">Cancelar</button>
                <h2 className="font-bold text-gray-700 dark:text-white">{citaActiva ? 'Editar Cita' : 'Nueva Cita'}</h2>
                <button 
                    onClick={guardarCita} 
                    disabled={guardando}
                    className={`font-bold text-lg px-2 py-1 ${guardando ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'}`}
                >
                    {guardando ? '...' : 'Guardar'}
                </button>
            </div>

            <div className="max-w-md mx-auto space-y-4 relative z-10 mt-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-2">📅 Cuándo</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                            <input type="date" name="fecha" value={formData.fecha} onChange={handleInput} className={inputClass} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Hora</label>
                            <input type="time" name="hora" value={formData.hora} onChange={handleInput} className={inputClass} />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-2">🐾 Paciente</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <input name="mascota" placeholder="Nombre Mascota" value={formData.mascota} onChange={handleInput} className={inputClass} />
                        <select name="especie" value={formData.especie} onChange={handleInput} className={inputClass}>
                            <option value="perro">Perro 🐶</option>
                            <option value="gato">Gato 🐱</option>
                            <option value="otro">Otro</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <input name="raza" placeholder="Raza" value={formData.raza} onChange={handleInput} className={`${inputClass} text-sm`} />
                        <input name="edad" placeholder="Edad" value={formData.edad} onChange={handleInput} className={`${inputClass} text-sm`} />
                    </div>
                    <input name="motivo" placeholder="Motivo de consulta (opcional)" value={formData.motivo} onChange={handleInput} className={inputClass} />
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-2">👤 Dueño</h3>
                    <input name="dueño" placeholder="Nombre Dueño" value={formData.dueño} onChange={handleInput} className={inputClass} />
                    <input name="telefono" type="tel" placeholder="Teléfono" value={formData.telefono} onChange={handleInput} className={inputClass} />
                </div>

                <div className="h-20"></div>
            </div>
          </main>
      )}
    </div>
  );
}