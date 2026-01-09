'use client';

import { useState, useEffect, use } from 'react'; 
import Link from 'next/link';
// CORRECCIÓN: Usamos 3 niveles (../../../) para llegar a src/lib
import { db, storage } from '../../../lib/firebase'; 
import { collection, addDoc, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
// CORRECCIÓN: Usamos 3 niveles (../../../) para llegar a src/utils
import { comprimirImagen } from '../../../utils/compressor'; 

const HORARIOS_DISPONIBLES = [
  "09:00", "10:00", "11:00", "12:00", 
  "13:00", "15:00", "16:00", "17:00"
];

// ==========================================
// 1. LÓGICA DE NEGOCIO (HOOK)
// ==========================================
const useAgendarLogic = (idVeterinaria) => {
  const [modo, setModo] = useState('nuevo'); 
  const [estado, setEstado] = useState('esperando');
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null); 

  // Datos Formulario
  const [nombreDueno, setNombreDueno] = useState('');
  const [telefono, setTelefono] = useState('');
  const [nombreMascota, setNombreMascota] = useState('');
  const [especie, setEspecie] = useState('perro');
  const [raza, setRaza] = useState('');
  const [edad, setEdad] = useState('');
  
  // Archivos
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);

  // Cita
  const [fecha, setFecha] = useState('');
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [horasOcupadas, setHorasOcupadas] = useState([]);

  // Efecto: Cargar horas ocupadas
  useEffect(() => {
    if (!fecha || !idVeterinaria) {
        setHorasOcupadas([]); 
        return;
    }
    const q = query(
        collection(db, "citas"), 
        where("fechaSolo", "==", fecha),
        where("clinicId", "==", idVeterinaria)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setHorasOcupadas(snapshot.docs.map(doc => doc.data().hora));
    });
    return () => unsubscribe();
  }, [fecha, idVeterinaria]);

  const buscarPaciente = async () => {
      if(!telefono || !nombreMascota) return alert("Ingresa datos");
      setBuscandoPaciente(true);
      try {
          const q = query(collection(db, "pacientes"), where("telefono", "==", telefono.trim()));
          const snapshot = await getDocs(q);
          let encontrado = null;
          snapshot.forEach(doc => {
              if (doc.data().nombre.toLowerCase() === nombreMascota.trim().toLowerCase()) {
                  encontrado = { id: doc.id, ...doc.data() };
              }
          });

          if (encontrado) {
              setPacienteEncontrado(encontrado);
              setNombreDueno(encontrado.dueño);
              setEspecie(encontrado.especie);
              setRaza(encontrado.raza);
              setEdad(encontrado.edad);
          } else {
              alert("No encontramos expediente. Regístrate como nuevo.");
          }
      } catch (error) { alert("Error al buscar"); } 
      finally { setBuscandoPaciente(false); }
  };

  const handleFoto = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const comprimido = await comprimirImagen(file);
        setFotoFile(comprimido);
        setFotoPreview(URL.createObjectURL(comprimido));
      } catch (err) { alert("Error al procesar imagen"); }
    }
  };

  const crearCita = async () => {
    if(!pacienteEncontrado && (!nombreMascota || !nombreDueno || !telefono)) return alert("Faltan datos");
    if(!fecha || !horaSeleccionada) return alert("Selecciona fecha y hora");

    try {
      setEstado('guardando');

      // Validar Disponibilidad
      const qCheck = query(
        collection(db, "citas"),
        where("fechaSolo", "==", fecha),
        where("hora", "==", horaSeleccionada),
        where("clinicId", "==", idVeterinaria)
      );
      const snapshotCheck = await getDocs(qCheck);

      if (!snapshotCheck.empty) {
        alert("Ese horario ya fue ganado.");
        setEstado('esperando');
        setHoraSeleccionada('');
        return;
      }

      // Subir Foto
      let urlFoto = null;
      if (modo === 'nuevo' && fotoFile) {
         const storageRef = ref(storage, `pacientes/nuevos/${Date.now()}_${fotoFile.name}`);
         const snapshot = await uploadBytes(storageRef, fotoFile);
         urlFoto = await getDownloadURL(snapshot.ref);
      }

      // Crear Paciente (Si es nuevo)
      const nombreLimpio = nombreMascota.trim();
      const telefonoLimpio = telefono.trim();
      const duenoLimpio = pacienteEncontrado ? pacienteEncontrado.dueño : nombreDueno.trim();

      if (modo === 'nuevo' && !pacienteEncontrado) {
          const qPaciente = query(collection(db, "pacientes"), where("telefono", "==", telefonoLimpio));
          const snapshotPaciente = await getDocs(qPaciente);
          let pacienteExiste = false;
          snapshotPaciente.forEach((doc) => {
              if (doc.data().nombre.toLowerCase() === nombreLimpio.toLowerCase()) pacienteExiste = true;
          });

          if (!pacienteExiste) {
            await addDoc(collection(db, "pacientes"), {
                nombre: nombreLimpio,
                especie, raza: raza || 'Desconocido', edad: edad || 'No especificada', peso: '', 
                dueño: duenoLimpio, telefono: telefonoLimpio, foto: urlFoto,
                notas: 'Generado automáticamente desde Cita Web', vacunas: [], createdAt: new Date()
            });
          }
      }

      // Crear Cita
      await addDoc(collection(db, "citas"), {
        clinicId: idVeterinaria,
        dueño: duenoLimpio, telefono: telefonoLimpio, mascota: nombreLimpio,
        especie: pacienteEncontrado ? pacienteEncontrado.especie : especie,
        raza: pacienteEncontrado ? pacienteEncontrado.raza : (raza || 'Desconocido'),
        edad: pacienteEncontrado ? pacienteEncontrado.edad : (edad || 'No especificada'),
        fecha: new Date(fecha + 'T' + horaSeleccionada), 
        fechaSolo: fecha, hora: horaSeleccionada, 
        motivo: "Cita web", estado: "pendiente",
        pacienteId: pacienteEncontrado ? pacienteEncontrado.id : null
      });

      setEstado('exito');
      // Reset
      setNombreMascota(''); setEspecie('perro'); setRaza(''); setEdad(''); setNombreDueno(''); setTelefono('');
      setFecha(''); setHoraSeleccionada(''); setFotoFile(null); setFotoPreview(null); setPacienteEncontrado(null);
      alert("¡Cita agendada correctamente!");
      
    } catch (error) {
      console.error(error);
      setEstado('esperando');
      alert("Error al guardar");
    }
  };

  return {
    modo, setModo, estado, buscandoPaciente, pacienteEncontrado, setPacienteEncontrado,
    nombreDueno, setNombreDueno, telefono, setTelefono, nombreMascota, setNombreMascota,
    especie, setEspecie, raza, setRaza, edad, setEdad,
    fotoPreview, handleFoto,
    fecha, setFecha, horaSeleccionada, setHoraSeleccionada, horasOcupadas,
    buscarPaciente, crearCita
  };
};

// ==========================================
// 2. VISTA (FRONTEND)
// ==========================================

export default function DynamicAgendarPage({ params }) {
  const { idVeterinaria } = use(params);
  const logic = useAgendarLogic(idVeterinaria);

  const theme = {
      primary: 'blue', 
      bgInput: 'bg-gray-50 dark:bg-slate-700',
      textPrimary: 'text-blue-800 dark:text-blue-400'
  };

  const inputClass = `w-full p-2 border rounded ${theme.bgInput} text-gray-900 dark:text-white border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-${theme.primary}-500 outline-none transition-colors`;
  const esOtro = logic.especie === 'otro';

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-white dark:bg-slate-900">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-md mx-auto flex flex-col items-center">
          <h1 className={`text-2xl font-bold ${theme.textPrimary} mb-6 mt-4`}>Agendar Visita</h1>
          
          <div className="w-full bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md space-y-6 transition-colors border border-gray-100 dark:border-slate-700">
            
            <div className="flex p-1 bg-gray-100 dark:bg-slate-700 rounded-lg mb-4">
                <button onClick={() => { logic.setModo('nuevo'); logic.setPacienteEncontrado(null); }} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${logic.modo === 'nuevo' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-400'}`}>Soy Nuevo</button>
                <button onClick={() => { logic.setModo('recurrente'); logic.setPacienteEncontrado(null); }} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${logic.modo === 'recurrente' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-400'}`}>Ya soy Cliente</button>
            </div>

            {logic.modo === 'recurrente' && !logic.pacienteEncontrado && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="text-center mb-2"><span className="text-4xl">👋</span><p className="text-sm text-gray-500 mt-2">Ingresa tus datos para encontrarte rápido</p></div>
                    <div><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Tu Teléfono</label><input type="tel" value={logic.telefono} onChange={(e) => logic.setTelefono(e.target.value)} className={inputClass} placeholder="Ej. 5512345678" /></div>
                    <div><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Nombre Mascota</label><input type="text" value={logic.nombreMascota} onChange={(e) => logic.setNombreMascota(e.target.value)} className={inputClass} placeholder="Ej. Firulais" /></div>
                    <button onClick={logic.buscarPaciente} disabled={logic.buscandoPaciente} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">{logic.buscandoPaciente ? 'Buscando...' : 'Buscar Expediente'}</button>
                </div>
            )}

            {logic.pacienteEncontrado && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800 text-center animate-in zoom-in">
                    <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-2 overflow-hidden flex items-center justify-center">{logic.pacienteEncontrado.foto ? <img src={logic.pacienteEncontrado.foto} className="w-full h-full object-cover" /> : <span className="text-3xl">🐶</span>}</div>
                    <h3 className="font-bold text-green-700 dark:text-green-400 mt-2">¡Hola, {logic.pacienteEncontrado.nombre}!</h3>
                    <p className="text-xs text-green-600 dark:text-green-300">Dueño: {logic.pacienteEncontrado.dueño}</p>
                    <button onClick={() => logic.setPacienteEncontrado(null)} className="text-xs text-gray-400 underline mt-2">No soy yo</button>
                </div>
            )}

            {logic.modo === 'nuevo' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex justify-center mb-4">
                        <label className="flex flex-col items-center gap-2 cursor-pointer group">
                            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-700 border-2 border-dashed border-gray-300 dark:border-slate-500 flex items-center justify-center overflow-hidden relative group-hover:border-blue-500 transition-colors">
                                {logic.fotoPreview ? <img src={logic.fotoPreview} className="w-full h-full object-cover" /> : <span className="text-2xl text-gray-400">📷</span>}
                            </div>
                            <span className="text-xs text-blue-500 font-bold">Agregar Foto (Opcional)</span>
                            <input type="file" accept="image/*" onChange={logic.handleFoto} className="hidden" />
                        </label>
                    </div>

                    <div className="space-y-3 border-b border-gray-100 dark:border-slate-700 pb-4">
                        <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">🐾 Datos del Paciente</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Nombre *</label><input type="text" value={logic.nombreMascota} onChange={(e) => logic.setNombreMascota(e.target.value)} className={inputClass} /></div>
                            <div><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Especie</label><select value={logic.especie} onChange={(e) => logic.setEspecie(e.target.value)} className={inputClass}><option value="perro">Perro 🐶</option><option value="gato">Gato 🐱</option><option value="otro">Otro 🐰</option></select></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-start"> 
                            <div><label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">{esOtro ? 'Tipo de animal' : 'Raza'}</label><input type="text" placeholder={esOtro ? "Ej. Tortuga" : "Raza"} value={logic.raza} onChange={(e) => logic.setRaza(e.target.value)} className={`${inputClass} text-sm`} /><p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 ml-1 leading-tight">{esOtro ? 'Tortuga, Iguana, Perico...' : 'Escriba "desconocido" si no la sabe'}</p></div>
                            <div><label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">Edad</label><input type="text" placeholder="Ej. 2 años" value={logic.edad} onChange={(e) => logic.setEdad(e.target.value)} className={`${inputClass} text-sm`} /></div>
                        </div>
                    </div>

                    <div className="space-y-3 border-b border-gray-100 dark:border-slate-700 pb-4">
                        <h3 className="font-semibold text-gray-800 dark:text-white">👤 Datos del Dueño</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <input type="text" placeholder="Tu Nombre *" value={logic.nombreDueno} onChange={(e) => logic.setNombreDueno(e.target.value)} className={inputClass} />
                            <input type="tel" placeholder="Teléfono / WhatsApp *" value={logic.telefono} onChange={(e) => logic.setTelefono(e.target.value)} className={inputClass} />
                        </div>
                    </div>
                </div>
            )}

            {(logic.modo === 'nuevo' || logic.pacienteEncontrado) && (
                <div className="space-y-3 pt-2 animate-in slide-in-from-bottom-2">
                    <h3 className="font-semibold text-gray-800 dark:text-white">📅 Fecha y Hora</h3>
                    <input type="date" value={logic.fecha} onChange={(e) => { logic.setFecha(e.target.value); logic.setHoraSeleccionada(''); }} className={inputClass} />
                    {logic.fecha && (
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            {HORARIOS_DISPONIBLES.map((hora) => (
                                <button key={hora} onClick={() => logic.setHoraSeleccionada(hora)} disabled={logic.horasOcupadas.includes(hora)} className={`py-2 text-xs font-bold rounded border transition-colors ${hora === logic.horaSeleccionada ? 'bg-blue-600 text-white border-blue-600' : logic.horasOcupadas.includes(hora) ? 'bg-gray-100 text-gray-300 dark:bg-slate-700 dark:text-slate-500 border-transparent cursor-not-allowed' : 'bg-white text-gray-700 dark:bg-slate-600 dark:text-gray-200 border-gray-200 dark:border-slate-500 hover:border-blue-500'}`}>{hora}</button>
                            ))}
                        </div>
                    )}
                    <button onClick={logic.crearCita} disabled={logic.estado === 'guardando'} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition disabled:bg-gray-400 dark:disabled:bg-slate-700 mt-4">{logic.estado === 'guardando' ? 'Guardando...' : 'Confirmar Cita'}</button>
                </div>
            )}
          </div>

          <Link href={`/${idVeterinaria}`} className="mt-8 text-gray-500 dark:text-gray-400 underline mb-8">Volver al inicio</Link>
          <div className="h-8 w-full"></div>
        </div>
      </div>
    </div>
  );
}