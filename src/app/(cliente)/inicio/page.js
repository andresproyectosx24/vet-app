'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/firebase'; 
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import CartillaClienteView from '../../../components/cliente/CartillaClienteView';
import HistorialClienteView from '../../../components/cliente/HistorialClienteView';

export default function ClientHome() {
  const [vista, setVista] = useState('menu'); 
  const [telefono, setTelefono] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [misMascotas, setMisMascotas] = useState([]);
  
  const [mascotaSeleccionada, setMascotaSeleccionada] = useState(null); 
  const [mascotaEditando, setMascotaEditando] = useState(null); 
  const [guardando, setGuardando] = useState(false);
  
  const [viendoCartilla, setViendoCartilla] = useState(false);
  const [viendoHistorial, setViendoHistorial] = useState(false);

  // Estado para controlar la animación de salida
  const [isClosing, setIsClosing] = useState(false);

  // --- MANEJO DEL BOTÓN ATRÁS (ANDROID/IOS) ---
  useEffect(() => {
    const handlePopState = (event) => {
      // Si el usuario presiona "Atrás", detectamos si hay un modal abierto
      if (vista !== 'menu') {
        // Iniciamos animación de cierre
        cerrarModal(false); // false = no llamar a history.back() porque el usuario ya lo hizo
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [vista]);

  // Función unificada para abrir modales con historial
  const abrirVista = (nuevaVista) => {
    // Agregamos un estado al historial para que el botón "Atrás" funcione
    window.history.pushState({ view: nuevaVista }, '', `#${nuevaVista}`);
    setVista(nuevaVista);
  };

  // Función para cerrar con animación
  const cerrarModal = (usarHistoryBack = true) => {
    setIsClosing(true);
    setTimeout(() => {
      setVista('menu');
      setMascotaSeleccionada(null);
      setMascotaEditando(null);
      setIsClosing(false);
      // Si cerramos con el botón "X", debemos retroceder el historial manualmente
      // Si cerramos con el botón físico "Atrás", no hacemos nada (el navegador ya retrocedió)
      if (usarHistoryBack) window.history.back(); 
    }, 300); // Duración de la animación de salida
  };

  // --- LÓGICA DE BÚSQUEDA ---
  const buscarMascotas = async () => {
    if (!telefono || telefono.length < 8) return alert("Por favor ingresa un número válido");
    
    setBuscando(true);
    try {
      const q = query(collection(db, "pacientes"), where("telefono", "==", telefono.trim()));
      const snapshot = await getDocs(q);
      
      const resultados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (resultados.length > 0) {
        setMisMascotas(resultados);
        // Reemplazamos el estado actual 'busqueda' por 'lista' en el historial para no tener que dar atrás 2 veces
        window.history.replaceState({ view: 'lista' }, '', '#lista');
        setVista('lista');
      } else {
        alert("No encontramos mascotas asociadas a este número.");
      }
    } catch (error) {
      console.error(error);
      alert("Error al buscar");
    } finally {
      setBuscando(false);
    }
  };

  const guardarEdicion = async () => {
    if (!mascotaEditando.nombre) return alert("El nombre es obligatorio");
    setGuardando(true);
    try {
      const ref = doc(db, "pacientes", mascotaEditando.id);
      await updateDoc(ref, {
        nombre: mascotaEditando.nombre,
        especie: mascotaEditando.especie,
        raza: mascotaEditando.raza,
        edad: mascotaEditando.edad
      });
      
      setMisMascotas(prev => prev.map(m => m.id === mascotaEditando.id ? mascotaEditando : m));
      setMascotaEditando(null); 
    } catch (error) {
      alert("Error al actualizar");
    } finally {
      setGuardando(false);
    }
  };

  const abrirCartilla = () => {
    setMascotaSeleccionada(null);
    setViendoCartilla(true);
  };

  const abrirHistorial = () => {
    setMascotaSeleccionada(null);
    setViendoHistorial(true);
  };

  if (viendoCartilla && mascotaSeleccionada) {
      return <CartillaClienteView mascota={mascotaSeleccionada} onBack={() => setViendoCartilla(false)} />;
  }

  if (viendoHistorial && mascotaSeleccionada) {
      return <HistorialClienteView mascota={mascotaSeleccionada} onBack={() => setViendoHistorial(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden relative">
       
       {/* 1. FONDO (Ajuste de Opacidad) */}
       <div className="fixed inset-0 z-0 pointer-events-none">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/bg-cliente.jpg')" }}
          ></div>
          {/* CAMBIO: Opacidad reducida para ver más la imagen (white/40 y slate/60) */}
          <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/60 backdrop-blur-[2px]"></div>
       </div>

       {/* Animaciones CSS locales para entrada y salida */}
   
       {/* 2. HEADER */}
       <div className="relative z-10 bg-gradient-to-br from-blue-600/95 to-purple-600/95 backdrop-blur-md pb-24 pt-12 px-6 rounded-b-[3rem] shadow-xl animate-slide-up-fade">
          <header className="relative z-10">
             <h1 className="text-3xl font-extrabold text-white mb-1 drop-shadow-sm">
               ¡Hola! 👋
             </h1>
             <p className="text-blue-100 text-lg font-medium drop-shadow-sm">
               Cuidando a tu mejor amigo.
             </p>
          </header>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-10 -mb-5 blur-2xl"></div>
       </div>

       {/* 3. MENU PRINCIPAL */}
       <div className="flex-1 px-6 -mt-16 relative z-10 pb-8">
         <div className="grid grid-cols-1 gap-4">
           
           <Link 
              href="/agendar" 
              className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-6 rounded-3xl shadow-lg border border-white/50 dark:border-slate-700 flex items-center gap-5 hover:bg-white dark:hover:bg-slate-800 hover:scale-[1.02] hover:shadow-xl transition-all duration-300 group active:scale-95 animate-slide-up-fade"
              style={{ animationDelay: '100ms' }}
           >
              <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-3xl shadow-inner group-hover:rotate-6 transition-transform">📅</div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 dark:text-white text-xl">Nueva Cita</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-tight font-medium">Programa una visita para hoy o después</p>
              </div>
              <span className="text-gray-300 dark:text-gray-600 text-2xl group-hover:text-blue-500 transition-colors">➔</span>
           </Link>

           <div className="grid grid-cols-2 gap-4 animate-slide-up-fade" style={{ animationDelay: '200ms' }}>
              <button 
                  onClick={() => abrirVista('busqueda')}
                  className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-5 rounded-3xl shadow-md border border-white/50 dark:border-slate-700 flex flex-col items-center justify-center text-center gap-3 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg transition-all duration-300 group active:scale-95"
              >
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🐶</div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-sm">Mis Mascotas</h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-tight font-medium">Expediente, cartilla y más</p>
                  </div>
              </button>
              
              <a href="tel:+525555555555" className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-5 rounded-3xl shadow-md border border-white/50 dark:border-slate-700 flex flex-col items-center justify-center text-center gap-3 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg transition-all duration-300 group active:scale-95">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📞</div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-sm">Urgencias</h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium">Llamar ahora</p>
                  </div>
              </a>
           </div>

           <div className="mt-4 bg-orange-50/95 dark:bg-slate-800/90 backdrop-blur-md p-5 rounded-3xl border border-orange-100 dark:border-orange-900/30 flex items-start gap-4 shadow-sm animate-slide-up-fade" style={{ animationDelay: '300ms' }}>
              <span className="text-3xl filter drop-shadow-sm">💡</span>
              <div>
                 <h4 className="font-bold text-orange-900 dark:text-orange-200 text-sm mb-1">Sabías que...</h4>
                 <p className="text-xs text-orange-800/80 dark:text-gray-300 leading-relaxed font-medium">
                   Mantén sus vacunas al día para evitar enfermedades comunes. Un chequeo anual puede prevenir problemas graves.
                 </p>
              </div>
           </div>
         </div>
       </div>

       {/* ============================================== */}
       {/* MODAL DE BÚSQUEDA (Con animación de salida) */}
       {/* ============================================== */}
       {vista === 'busqueda' && (
           <div className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
               <div className={`bg-white dark:bg-slate-900 w-full sm:w-96 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl ${isClosing ? 'animate-slide-out' : 'animate-slide-in'}`}>
                   <div className="flex justify-between items-center mb-6">
                       <h2 className="text-xl font-bold text-gray-800 dark:text-white">Acceder a Expedientes</h2>
                       <button onClick={() => cerrarModal(true)} className="bg-gray-100 dark:bg-slate-800 p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">✕</button>
                   </div>
                   
                   <p className="text-sm text-gray-500 mb-4">Ingresa tu número de teléfono registrado para ver tus mascotas.</p>
                   
                   <input 
                      type="tel" 
                      placeholder="Ej. 5512345678"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="w-full p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-lg outline-none focus:ring-2 focus:ring-purple-500 mb-4 transition-all"
                   />

                   <button 
                      onClick={buscarMascotas}
                      disabled={buscando}
                      className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-70"
                   >
                      {buscando ? 'Buscando...' : 'Ver mis Mascotas'}
                   </button>
               </div>
           </div>
       )}

       {/* ============================================== */}
       {/* LISTA DE MASCOTAS (Slide Right) */}
       {/* ============================================== */}
       {vista === 'lista' && (
           <div className={`fixed inset-0 z-50 bg-gray-50 dark:bg-slate-900 flex flex-col ${isClosing ? 'animate-slide-out' : 'animate-slide-in'}`}>
               <div className="p-4 flex items-center gap-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shadow-sm">
                   <button onClick={() => cerrarModal(true)} className="text-2xl text-gray-500 hover:text-gray-800 transition-colors">←</button>
                   <h2 className="text-lg font-bold text-gray-800 dark:text-white">Mis Mascotas</h2>
               </div>

               <div className="flex-1 overflow-y-auto p-4 space-y-4">
                   {misMascotas.map(p => (
                       <div key={p.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4 relative">
                           <div onClick={() => setMascotaSeleccionada(p)} className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center border-2 border-white dark:border-slate-600 shadow-sm cursor-pointer">
                               {p.foto ? (
                                   // eslint-disable-next-line @next/next/no-img-element
                                   <img src={p.foto} alt="foto" className="w-full h-full object-cover" />
                               ) : <span className="text-2xl">{p.especie === 'gato' ? '🐱' : '🐶'}</span>}
                           </div>
                           <div className="flex-1 cursor-pointer" onClick={() => setMascotaSeleccionada(p)}>
                               <h3 className="font-bold text-gray-900 dark:text-white text-lg">{p.nombre}</h3>
                               <p className="text-xs text-gray-500 dark:text-gray-400">{p.raza || 'Raza desconocida'} • {p.edad || 'Edad desconocida'}</p>
                           </div>
                           <button onClick={() => setMascotaEditando(p)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-full transition-colors">✎</button>
                       </div>
                   ))}
               </div>
           </div>
       )}

       {/* ============================================== */}
       {/* MODAL DE OPCIONES */}
       {/* ============================================== */}
       {mascotaSeleccionada && (
           <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200" onClick={() => setMascotaSeleccionada(null)}>
               <div className="bg-white dark:bg-slate-900 w-full sm:w-96 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300" onClick={e => e.stopPropagation()}>
                   <div className="text-center mb-6">
                       <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full mx-auto mb-3 overflow-hidden border-4 border-white dark:border-slate-700 shadow-md flex items-center justify-center">
                           {mascotaSeleccionada.foto ? (
                               // eslint-disable-next-line @next/next/no-img-element
                               <img src={mascotaSeleccionada.foto} alt="foto" className="w-full h-full object-cover" />
                           ) : <span className="text-4xl">🐾</span>}
                       </div>
                       <h2 className="text-xl font-bold text-gray-800 dark:text-white">{mascotaSeleccionada.nombre}</h2>
                       <p className="text-sm text-gray-500">¿Qué deseas consultar?</p>
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                       <button onClick={abrirCartilla} className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800 hover:bg-purple-100 transition-colors group">
                           <div className="text-2xl mb-1 group-active:scale-90 transition-transform">💉</div>
                           <div className="text-sm font-bold text-purple-700 dark:text-purple-300">Ver Cartilla</div>
                       </button>
                       <button onClick={abrirHistorial} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 hover:bg-blue-100 transition-colors group">
                           <div className="text-2xl mb-1 group-active:scale-90 transition-transform">📋</div>
                           <div className="text-sm font-bold text-blue-700 dark:text-blue-300">Ver Expediente</div>
                       </button>
                   </div>
                   <button onClick={() => setMascotaSeleccionada(null)} className="w-full mt-6 py-3 text-gray-500 font-medium">Cancelar</button>
               </div>
           </div>
       )}

       {/* ============================================== */}
       {/* MODAL DE EDICIÓN RÁPIDA */}
       {/* ============================================== */}
       {mascotaEditando && (
           <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
               <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-pop-up">
                   <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Editar Datos</h2>
                   
                   <div className="space-y-3">
                       <div>
                           <label className="text-xs text-gray-500 uppercase font-bold">Nombre</label>
                           <input 
                              value={mascotaEditando.nombre} 
                              onChange={e => setMascotaEditando({...mascotaEditando, nombre: e.target.value})}
                              className="w-full p-2 bg-gray-50 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 outline-none"
                           />
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                           <div>
                               <label className="text-xs text-gray-500 uppercase font-bold">Especie</label>
                               <select 
                                  value={mascotaEditando.especie} 
                                  onChange={e => setMascotaEditando({...mascotaEditando, especie: e.target.value})}
                                  className="w-full p-2 bg-gray-50 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 outline-none"
                               >
                                   <option value="perro">Perro</option>
                                   <option value="gato">Gato</option>
                                   <option value="otro">Otro</option>
                               </select>
                           </div>
                           <div>
                               <label className="text-xs text-gray-500 uppercase font-bold">Raza</label>
                               <input 
                                  value={mascotaEditando.raza} 
                                  onChange={e => setMascotaEditando({...mascotaEditando, raza: e.target.value})}
                                  className="w-full p-2 bg-gray-50 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 outline-none"
                               />
                           </div>
                       </div>
                       <div>
                           <label className="text-xs text-gray-500 uppercase font-bold">Edad</label>
                           <input 
                              value={mascotaEditando.edad} 
                              onChange={e => setMascotaEditando({...mascotaEditando, edad: e.target.value})}
                              className="w-full p-2 bg-gray-50 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 outline-none"
                           />
                       </div>
                   </div>

                   <div className="flex gap-3 mt-6">
                       <button onClick={() => setMascotaEditando(null)} className="flex-1 py-2 text-gray-500 bg-gray-100 dark:bg-slate-800 rounded-lg font-bold">Cancelar</button>
                       <button onClick={guardarEdicion} disabled={guardando} className="flex-1 py-2 text-white bg-blue-600 rounded-lg font-bold">{guardando ? '...' : 'Guardar'}</button>
                   </div>
               </div>
           </div>
       )}

       <div className="h-8"></div>
    </div>
  );
}