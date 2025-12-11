'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
// Usamos ruta relativa para asegurar compatibilidad
import { db } from '../../../lib/firebase'; 
import { collection, addDoc, query, where, onSnapshot, getDocs } from 'firebase/firestore';

const HORARIOS_DISPONIBLES = [
  "09:00", "10:00", "11:00", "12:00", 
  "13:00", "15:00", "16:00", "17:00"
];

export default function AgendarPage() {
  const [estado, setEstado] = useState('esperando');
  
  // --- DATOS DEL DUEÑO ---
  const [nombreDueno, setNombreDueno] = useState('');
  const [telefono, setTelefono] = useState('');

  // --- DATOS DEL PACIENTE ---
  const [nombreMascota, setNombreMascota] = useState('');
  const [especie, setEspecie] = useState('perro');
  const [raza, setRaza] = useState('');
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState(''); 

  // --- DATOS CITA ---
  const [fecha, setFecha] = useState('');
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  
  const [horasOcupadas, setHorasOcupadas] = useState([]);
  const [buscandoHorario, setBuscandoHorario] = useState(false);

  useEffect(() => {
    if (!fecha) {

        return;
    }
    const q = query(collection(db, "citas"), where("fechaSolo", "==", fecha));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const ocupadas = snapshot.docs.map(doc => doc.data().hora);
        setHorasOcupadas(ocupadas);
        setBuscandoHorario(false);
    });
    return () => unsubscribe();
  }, [fecha]);

  const crearCita = async () => {
    if(!nombreMascota || !nombreDueno || !telefono || !fecha || !horaSeleccionada) {
        alert("Faltan datos obligatorios (*)");
        return;
    }

    try {
      setEstado('guardando');

      // 0. LIMPIEZA DE DATOS (Normalización)
      // Quitamos espacios al principio y final para evitar " Juan " vs "Juan"
      const nombreLimpio = nombreMascota.trim();
      const telefonoLimpio = telefono.trim();
      const duenoLimpio = nombreDueno.trim();
      const razaLimpia = raza.trim() || 'Desconocido';

      // 1. SEGURIDAD: Verificar disponibilidad de hora
      const qCheck = query(
        collection(db, "citas"),
        where("fechaSolo", "==", fecha),
        where("hora", "==", horaSeleccionada)
      );
      const snapshotCheck = await getDocs(qCheck);

      if (!snapshotCheck.empty) {
        alert("¡Lo sentimos! Alguien acaba de ganar ese horario.");
        setEstado('esperando');
        setHoraSeleccionada('');
        return;
      }

      // 2. SINCRONIZACIÓN INTELIGENTE (Anti-Duplicados Mejorado)
      // Paso A: Buscar todos los pacientes asociados a este teléfono
      const qPaciente = query(
        collection(db, "pacientes"),
        where("telefono", "==", telefonoLimpio) 
      );
      const snapshotPaciente = await getDocs(qPaciente);

      let pacienteExiste = false;

      // Paso B: Revisar manualmente si el nombre coincide (ignorando mayúsculas/minúsculas)
      snapshotPaciente.forEach((doc) => {
          const datos = doc.data();
          // Comparamos "firulais" con "FIRULAIS" -> true
          if (datos.nombre.toLowerCase() === nombreLimpio.toLowerCase()) {
              pacienteExiste = true;
          }
      });

      // Paso C: Solo crear si NO encontramos coincidencia
      if (!pacienteExiste) {
        await addDoc(collection(db, "pacientes"), {
            nombre: nombreLimpio,
            especie: especie,
            raza: razaLimpia,
            edad: edad || 'No especificada',
            peso: '', 
            dueño: duenoLimpio,
            telefono: telefonoLimpio,
            notas: 'Generado automáticamente desde Cita Web',
            vacunas: [], 
            createdAt: new Date()
        });
        console.log("Nuevo expediente creado (No existía previamente)");
      } else {
        console.log("Expediente existente encontrado. No se duplicó.");
      }

      // 3. CREAR LA CITA
      const fechaFinal = new Date(fecha + 'T' + horaSeleccionada);

      await addDoc(collection(db, "citas"), {
        dueño: duenoLimpio,
        telefono: telefonoLimpio,
        mascota: nombreLimpio,
        especie: especie,
        raza: razaLimpia,
        edad: edad || 'No especificada',
        fecha: fechaFinal, 
        fechaSolo: fecha,  
        hora: horaSeleccionada, 
        motivo: "Cita web",
        estado: "pendiente"
      });

      setEstado('exito');
      // Reset completo
      setNombreMascota(''); setEspecie('perro'); setRaza(''); setEdad(''); setPeso('');
      setNombreDueno(''); setTelefono('');
      setFecha(''); setHoraSeleccionada('');
      alert("¡Cita agendada correctamente!");
      
    } catch (error) {
      console.error(error);
      setEstado('esperando');
      alert("Error al guardar");
    }
  };

  const inputClass = "w-full p-2 border rounded bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-colors";

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-md mx-auto flex flex-col items-center">
          <h1 className="text-2xl font-bold text-blue-800 dark:text-blue-400 mb-6 mt-4">Agendar Visita</h1>
          
          <div className="w-full bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md space-y-6 transition-colors">
            
            {/* SECCIÓN 1: ¿QUIÉN VIENE? */}
            <div className="space-y-3 border-b border-gray-100 dark:border-slate-700 pb-4">
                <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">🐾 Datos del Paciente</h3>
                
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Nombre *</label>
                        <input type="text" value={nombreMascota} onChange={(e) => setNombreMascota(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Especie</label>
                        <select value={especie} onChange={(e) => setEspecie(e.target.value)} className={inputClass}>
                            <option value="perro">Perro 🐶</option>
                            <option value="gato">Gato 🐱</option>
                            <option value="otro">Otro 🐰</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 items-start"> 
                    <div>
                        <input 
                            type="text" 
                            placeholder="Raza" 
                            value={raza} 
                            onChange={(e) => setRaza(e.target.value)} 
                            className={`${inputClass} text-sm`} 
                        />
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 ml-1 leading-tight">
                            Escriba &quot;Desconocida&quot; si no la sabe
                        </p>
                    </div>
                    
                    <input type="text" placeholder="Edad (años o meses)" value={edad} onChange={(e) => setEdad(e.target.value)} className={`${inputClass} text-sm`} />
                </div>
            </div>

            {/* SECCIÓN 2: CONTACTO */}
            <div className="space-y-3 border-b border-gray-100 dark:border-slate-700 pb-4">
                <h3 className="font-semibold text-gray-800 dark:text-white">👤 Datos del Dueño</h3>
                <div className="grid grid-cols-1 gap-3">
                    <input type="text" placeholder="Tu Nombre *" value={nombreDueno} onChange={(e) => setNombreDueno(e.target.value)} className={inputClass} />
                    <input type="tel" placeholder="Teléfono / WhatsApp *" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputClass} />
                </div>
            </div>

            {/* SECCIÓN 3: FECHA */}
            <div className="space-y-3">
                <h3 className="font-semibold text-gray-800 dark:text-white">📅 Fecha y Hora</h3>
                <input type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); setHoraSeleccionada(''); }} className={inputClass} />
                
                {fecha && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                        {HORARIOS_DISPONIBLES.map((hora) => (
                            <button
                                key={hora}
                                onClick={() => setHoraSeleccionada(hora)}
                                disabled={horasOcupadas.includes(hora)}
                                className={`py-2 text-xs font-bold rounded border transition-colors ${
                                    hora === horaSeleccionada 
                                        ? 'bg-blue-600 text-white border-blue-600' 
                                        : horasOcupadas.includes(hora) 
                                            ? 'bg-gray-100 text-gray-300 dark:bg-slate-700 dark:text-slate-500 border-transparent cursor-not-allowed'
                                            : 'bg-white text-gray-700 dark:bg-slate-600 dark:text-gray-200 border-gray-200 dark:border-slate-500 hover:border-blue-500'
                                }`}
                            >
                                {hora}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button onClick={crearCita} disabled={estado === 'guardando'} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition disabled:bg-gray-400 dark:disabled:bg-slate-700">
              {estado === 'guardando' ? 'Guardando...' : 'Confirmar Cita'}
            </button>
          </div>
          <Link href="/" className="mt-8 text-gray-500 dark:text-gray-400 underline mb-8">Volver</Link>
          <div className="h-32 w-full"></div>
        </div>
      </div>
    </div>
  );
}