'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase'; 
import { collection, deleteDoc, doc, query, orderBy, onSnapshot, addDoc, updateDoc, where, getDocs } from 'firebase/firestore';

// Horarios fijos para estandarizar
const HORARIOS_DISPONIBLES = [
  "09:00", "10:00", "11:00", "12:00", 
  "13:00", "15:00", "16:00", "17:00"
];

// Helper para fechas locales (YYYY-MM-DD)
const getLocalDateStr = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

export default function DashboardVeterinario() {
  const [vista, setVista] = useState('lista'); 
  const [citas, setCitas] = useState([]);
  const [pacientes, setPacientes] = useState([]); 
  const [cargando, setCargando] = useState(true);
  
  const [modoVista, setModoVista] = useState('dia'); 
  const [fechaActual, setFechaActual] = useState(new Date()); 

  const [citaActiva, setCitaActiva] = useState(null);
  const [guardando, setGuardando] = useState(false);
  
  const [modoPaciente, setModoPaciente] = useState('existente'); 
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  // NUEVO: Estado para bloquear horas ocupadas en el formulario
  const [horasOcupadas, setHorasOcupadas] = useState([]);

  const [formData, setFormData] = useState({
    dueño: '', telefono: '', mascota: '', especie: 'perro',
    raza: '', edad: '', fecha: '', hora: '', motivo: '',
    pacienteId: null 
  });

  // 1. CARGA DE DATOS GENERALES
  useEffect(() => {
    const qCitas = query(collection(db, "citas"), orderBy("fecha", "asc"));
    const unsubCitas = onSnapshot(qCitas, (snapshot) => {
        const listaCitas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        setCitas(listaCitas);
        setCargando(false);
    });

    const qPacientes = query(collection(db, "pacientes"), orderBy("nombre", "asc"));
    const unsubPacientes = onSnapshot(qPacientes, (snapshot) => {
        const listaPacientes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        setPacientes(listaPacientes);
    });

    return () => {
        unsubCitas();
        unsubPacientes();
    };
  }, []);

  // 2. DETECCIÓN DE HORAS OCUPADAS (Lógica Nueva)
  useEffect(() => {
    if (!formData.fecha) {
        setHorasOcupadas([]);
        return;
    }
    
    // Consultamos citas para la fecha seleccionada en el formulario
    const q = query(collection(db, "citas"), where("fechaSolo", "==", formData.fecha));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const ocupadas = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            // Si estamos editando, NO bloqueamos la hora que ya tiene esta misma cita
            if (citaActiva && doc.id === citaActiva.id) return;
            // Agregamos horas de otras citas a la lista de ocupadas
            if (data.hora) ocupadas.push(data.hora);
        });
        setHorasOcupadas(ocupadas);
    });

    return () => unsubscribe();
  }, [formData.fecha, citaActiva]);

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
      if (modoVista === 'mes') opciones.weekday = undefined; 
      if (modoVista === 'mes') opciones.day = undefined;
      
      let texto = fechaActual.toLocaleDateString('es-ES', opciones);
      texto = texto.charAt(0).toUpperCase() + texto.slice(1);
      
      if (modoVista === 'dia' && esHoy(fechaActual)) {
          return `${texto} (Hoy)`;
      }
      return texto;
  };

  const getCitasDelDia = (fecha) => {
      const fechaStr = getLocalDateStr(fecha);
      return citas.filter(c => c.fechaSolo === fechaStr);
  };

  const getDiasSemana = () => {
      const start = new Date(fechaActual);
      const day = start.getDay(); 
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); 
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
      const start = new Date(year, month, 1);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); 
      start.setDate(diff);

      const dias = [];
      for (let i = 0; i < 42; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          dias.push(d);
      }
      return dias;
  };

  const eliminarCita = async (id, e) => {
    e.stopPropagation(); 
    if(!confirm("¿Cancelar esta cita permanentemente?")) return;
    try {
      await deleteDoc(doc(db, "citas", id));
    } catch (error) {
      alert("Error al eliminar");
    }
  };

  const abrirFormulario = (cita = null) => {
      window.history.pushState({ view: 'formulario' }, '', '#formulario');
      setSugerencias([]); 
      if (cita) {
          setCitaActiva(cita);
          setModoPaciente('existente'); 
          let fechaStr = cita.fechaSolo || '';
          if (!fechaStr && cita.fecha?.seconds) fechaStr = new Date(cita.fecha.seconds * 1000).toISOString().split('T')[0];
          setFormData({
              dueño: cita.dueño || '', telefono: cita.telefono || '', mascota: cita.mascota || '', especie: cita.especie || 'perro',
              raza: cita.raza || '', edad: cita.edad || '', fecha: fechaStr, hora: cita.hora || '', motivo: cita.motivo || '',
              pacienteId: cita.pacienteId || null 
          });
      } else {
          setCitaActiva(null);
          setModoPaciente('existente'); 
          setFormData({ dueño: '', telefono: '', mascota: '', especie: 'perro', raza: '', edad: '', fecha: getLocalDateStr(fechaActual), hora: '', motivo: '', pacienteId: null });
      }
      setVista('formulario');
  };

  const cerrarFormulario = () => {
      if (window.location.hash === '#formulario') window.history.back();
      else setVista('lista');
  };

  const handleInput = (e) => {
      const { name, value } = e.target;
      setFormData({ ...formData, [name]: value });

      if (modoPaciente === 'existente' && (name === 'mascota' || name === 'dueño')) {
          if (value.length > 1) {
              const matches = pacientes.filter(p => 
                  p.nombre.toLowerCase().includes(value.toLowerCase()) || 
                  p.dueño.toLowerCase().includes(value.toLowerCase())
              ).slice(0, 5); 
              setSugerencias(matches);
              setMostrarSugerencias(true);
          } else {
              setSugerencias([]);
              setMostrarSugerencias(false);
          }
      }
  };
  
  const setHora = (hora) => {
      setFormData({ ...formData, hora });
  };

  const seleccionarPaciente = (paciente) => {
      setFormData({
          ...formData,
          mascota: paciente.nombre,
          dueño: paciente.dueño,
          telefono: paciente.telefono,
          especie: paciente.especie,
          raza: paciente.raza,
          edad: paciente.edad,
          pacienteId: paciente.id 
      });
      setSugerencias([]);
      setMostrarSugerencias(false);
  };

  const guardarCita = async () => {
      if (!formData.mascota || !formData.dueño || !formData.fecha || !formData.hora) return alert("Faltan datos");
      
      // Validación extra: No permitir guardar si la hora está ocupada
      if (horasOcupadas.includes(formData.hora)) {
          return alert("Ese horario ya está ocupado. Por favor elige otro.");
      }

      setGuardando(true);
      try {
          if (modoPaciente === 'nuevo' && !citaActiva) {
              const qDuplicado = query(
                  collection(db, "pacientes"), 
                  where("telefono", "==", formData.telefono.trim())
              );
              const snapshot = await getDocs(qDuplicado);
              let existe = false;
              snapshot.forEach(doc => {
                  if (doc.data().nombre.toLowerCase() === formData.mascota.trim().toLowerCase()) existe = true;
              });

              if (!existe) {
                  await addDoc(collection(db, "pacientes"), {
                      nombre: formData.mascota.trim(),
                      especie: formData.especie,
                      raza: formData.raza || 'Desconocido',
                      edad: formData.edad || 'No especificada',
                      peso: '', 
                      dueño: formData.dueño.trim(),
                      telefono: formData.telefono.trim(),
                      notas: 'Creado desde Agenda (Admin)',
                      vacunas: [],
                      createdAt: new Date()
                  });
              }
          }

          const fechaFinal = new Date(formData.fecha + 'T' + formData.hora);
          const payload = { 
              ...formData, 
              fecha: fechaFinal, 
              fechaSolo: formData.fecha, 
              estado: citaActiva?.estado || 'pendiente' 
          };
          
          if (citaActiva) await updateDoc(doc(db, "citas", citaActiva.id), payload);
          else await addDoc(collection(db, "citas"), payload);
          
          cerrarFormulario();
      } catch (error) { 
          console.error(error);
          alert("Error al guardar"); 
      } finally { 
          setGuardando(false); 
      }
  };

  const getIcono = (especie) => {
      if(especie === 'perro') return '🐶';
      if(especie === 'gato') return '🐱';
      return '🐾';
  }

  const inputClass = "w-full p-3 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all";

  const renderCitaCard = (cita) => {
      const ahora = new Date();
      const fechaCita = cita.fecha?.seconds ? new Date(cita.fecha.seconds * 1000) : new Date(cita.fecha);
      const yaPaso = fechaCita < ahora;
      const atendida = cita.estado === 'finalizada';

      let borderClass = 'border-blue-500';
      let bgClass = 'bg-white dark:bg-slate-800';
      let opacityClass = '';

      if (atendida) {
          borderClass = 'border-green-500';
          bgClass = 'bg-green-50 dark:bg-green-900/20';
          opacityClass = 'opacity-70';
      } else if (yaPaso) {
          borderClass = 'border-red-500';
          bgClass = 'bg-red-50 dark:bg-red-900/20';
      }

      return (
        <div 
            key={cita.id} 
            onClick={() => abrirFormulario(cita)} 
            className={`${bgClass} ${opacityClass} p-4 rounded-xl shadow-sm border-l-4 ${borderClass} relative transition-colors cursor-pointer mb-3`}
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
                <button onClick={(e) => eliminarCita(cita.id, e)} className="text-gray-300 hover:text-red-400 p-1 text-sm">🗑</button>
            </div>

            <div className="flex items-end justify-between text-xs text-gray-500 dark:text-slate-500 border-t border-gray-200/50 dark:border-slate-700 pt-2 mt-2">
                <span className="flex items-center gap-1">👤 {cita.dueño}</span>
                <div className="flex flex-col items-end gap-1">
                    <span className="text-blue-600 dark:text-blue-400 font-medium">📞 {cita.telefono}</span>
                    {atendida && <span className="text-[10px] font-bold text-green-600 uppercase bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">Completada</span>}
                    {yaPaso && !atendida && <span className="text-[10px] font-bold text-red-500 uppercase bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">Sin Asistencia</span>}
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
                
                <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-sm pb-4">
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

                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <button onClick={() => cambiarFecha(-1)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">←</button>
                        <div className="text-center">
                            <h2 className="text-sm font-bold text-gray-800 dark:text-white">{getTituloFecha()}</h2>
                        </div>
                        <button onClick={() => cambiarFecha(1)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">→</button>
                    </div>
                </div>

                <div className="space-y-4">
                    {modoVista === 'dia' && (
                        <div>
                            {(() => {
                                const citasDia = getCitasDelDia(fechaActual);
                                if (citasDia.length === 0) return (
                                    <div className="text-center py-10 text-gray-400 dark:text-gray-600"><p>No hay citas para este día</p></div>
                                );
                                return citasDia.map(renderCitaCard);
                            })()}
                        </div>
                    )}

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
                                        {citasDia.length > 0 ? citasDia.map(renderCitaCard) : <p className="text-xs text-gray-300 dark:text-gray-700 px-4 mb-4 italic">Sin citas</p>}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* VISTA MENSUAL */}
                    {modoVista === 'mes' && (
                        <div className="grid grid-cols-7 gap-1 bg-gray-200 dark:bg-slate-800 p-1 rounded-xl">
                            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                                <div key={i} className="text-center text-xs font-bold text-gray-500 py-2">{d}</div>
                            ))}
                            {getDiasMes().map((dia, i) => {
                                const citasDia = getCitasDelDia(dia);
                                const esMismoMes = dia.getMonth() === fechaActual.getMonth();
                                const esHoyDia = esHoy(dia);
                                return (
                                    <div key={i} onClick={() => { setFechaActual(dia); setModoVista('dia'); }} className={`h-14 bg-white dark:bg-slate-900 rounded-lg flex flex-col items-center justify-start pt-1 cursor-pointer transition-colors relative ${!esMismoMes ? 'opacity-30' : ''} ${esHoyDia ? 'ring-2 ring-blue-500 z-10' : ''}`}>
                                        <span className={`text-xs font-bold ${esHoyDia ? 'text-blue-500' : 'text-gray-700 dark:text-gray-300'}`}>{dia.getDate()}</span>
                                        <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
                                            {citasDia.slice(0, 4).map(c => {
                                                let dotColor = 'bg-blue-400';
                                                const fechaCita = c.fecha?.seconds ? new Date(c.fecha.seconds * 1000) : new Date(c.fecha);
                                                if (c.estado === 'finalizada') dotColor = 'bg-green-500';
                                                else if (fechaCita < new Date()) dotColor = 'bg-red-500';
                                                return <div key={c.id} className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />;
                                            })}
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

            <button onClick={() => abrirFormulario()} className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl font-bold hover:scale-110 active:scale-95 transition-transform z-30">+</button>
        </>
      )}

      {/* VISTA 2: FORMULARIO */}
      {vista === 'formulario' && (
          <main className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-slate-900 relative">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-gray-100 dark:bg-slate-900 z-20 py-4 border-b border-gray-200 dark:border-slate-800 shadow-sm">
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

            <div className="max-w-md mx-auto space-y-4 relative z-10">
                
                {/* SWITCHER DE MODO PACIENTE */}
                {!citaActiva && (
                    <div className="flex p-1 bg-gray-200 dark:bg-slate-800 rounded-lg mb-4">
                        <button 
                            onClick={() => { setModoPaciente('existente'); setFormData({...formData, mascota: '', dueño: '', telefono: ''}); }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${modoPaciente === 'existente' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}
                        >
                            🔍 Paciente Existente
                        </button>
                        <button 
                            onClick={() => { setModoPaciente('nuevo'); setFormData({...formData, mascota: '', dueño: '', telefono: '', especie: 'perro', raza: '', edad: ''}); }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${modoPaciente === 'nuevo' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-purple-400' : 'text-gray-500'}`}
                        >
                            ✨ Nuevo Paciente
                        </button>
                    </div>
                )}

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-2">📅 Cuándo</h3>
                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1 font-bold">Fecha</label>
                            <input type="date" name="fecha" value={formData.fecha} onChange={handleInput} className={inputClass} />
                        </div>
                        
                        {/* Selector de Hora con Bloqueo Visual */}
                        <div>
                            <label className="text-xs text-gray-500 block mb-2 font-bold">Hora</label>
                            <div className="grid grid-cols-4 gap-2">
                                {HORARIOS_DISPONIBLES.map(hora => {
                                    const isOccupied = horasOcupadas.includes(hora);
                                    const isSelected = formData.hora === hora;
                                    
                                    return (
                                        <button
                                            key={hora}
                                            onClick={() => !isOccupied && setHora(hora)}
                                            disabled={isOccupied}
                                            className={`py-2 text-xs font-bold rounded border transition-colors ${
                                                isSelected 
                                                    ? 'bg-blue-600 text-white border-blue-600' 
                                                    : isOccupied
                                                        ? 'bg-gray-100 text-gray-300 dark:bg-slate-700 dark:text-slate-500 border-transparent cursor-not-allowed'
                                                        : 'bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:border-blue-400'
                                            }`}
                                        >
                                            {hora}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* FORMULARIO DE PACIENTE SEGÚN MODO */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3 relative">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-2 flex justify-between items-center">
                        <span>🐾 Paciente</span>
                        {formData.pacienteId && (
                            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full flex items-center justify-center leading-none h-6">
                                Vinculado
                            </span>
                        )}
                        {!formData.pacienteId && modoPaciente === 'nuevo' && (
                            <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-3 py-1 rounded-full flex items-center justify-center leading-none h-6">
                                Se creará
                            </span>
                        )}
                    </h3>

                    {/* MODO EXISTENTE: BUSCADOR */}
                    {modoPaciente === 'existente' && (
                        <div className="relative">
                            <label className="text-xs text-gray-500 block mb-1 font-bold">Buscar por nombre o dueño</label>
                            <input 
                                name="mascota" 
                                placeholder="Escribe para buscar..." 
                                value={formData.mascota} 
                                onChange={handleInput} 
                                className={inputClass} 
                                autoComplete="off"
                            />
                            {/* Lista de sugerencias */}
                            {mostrarSugerencias && sugerencias.length > 0 && (
                                <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg shadow-xl z-50 mt-1 max-h-40 overflow-y-auto">
                                    {sugerencias.map(p => (
                                        <div 
                                            key={p.id} 
                                            onClick={() => seleccionarPaciente(p)}
                                            className="p-3 border-b border-gray-100 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-slate-600 cursor-pointer flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="font-bold text-sm text-gray-800 dark:text-white">{p.nombre}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-300">{p.raza} • {p.dueño}</p>
                                            </div>
                                            <span className="text-blue-500">➜</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* MODO NUEVO O EDITAR: CAMPOS COMPLETOS */}
                    {(modoPaciente === 'nuevo' || citaActiva) && (
                        <>
                            {modoPaciente === 'nuevo' && (
                                <input name="mascota" placeholder="Nombre Mascota" value={formData.mascota} onChange={handleInput} className={inputClass} />
                            )}
                            
                            <div className="grid grid-cols-2 gap-3">
                                <select name="especie" value={formData.especie} onChange={handleInput} className={inputClass}>
                                    <option value="perro">Perro 🐶</option>
                                    <option value="gato">Gato 🐱</option>
                                    <option value="otro">Otro</option>
                                </select>
                                <input name="motivo" placeholder="Motivo consulta" value={formData.motivo} onChange={handleInput} className={inputClass} />
                            </div>

                            {/* Campos extra solo si es nuevo paciente */}
                            {modoPaciente === 'nuevo' && (
                                <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                                    <input name="raza" placeholder="Raza" value={formData.raza} onChange={handleInput} className={`${inputClass} text-sm`} />
                                    <input name="edad" placeholder="Edad" value={formData.edad} onChange={handleInput} className={`${inputClass} text-sm`} />
                                </div>
                            )}
                        </>
                    )}
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