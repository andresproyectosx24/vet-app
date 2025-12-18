'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase'; 
import { collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot, deleteDoc, where, getDocs } from 'firebase/firestore';

export default function ClientesPage() {
  const [vista, setVista] = useState('lista'); 
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [clienteActivo, setClienteActivo] = useState(null); 
  const [guardando, setGuardando] = useState(false); 
  const [mascotasAsociadas, setMascotasAsociadas] = useState([]); 

  const [formData, setFormData] = useState({
    nombre: '', telefono: '', email: '', direccion: '', notas: ''
  });

  // 1. CARGA DE DATOS
  useEffect(() => {
    const q = query(collection(db, "clientes"), orderBy("nombre", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setClientes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  // 2. NAVEGACIÓN NATIVA
  useEffect(() => {
    const handleBack = () => { setVista('lista'); setClienteActivo(null); };
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, []);

  const abrirFormulario = async (cliente = null) => {
      window.history.pushState({ view: 'formulario' }, '', '#formulario');
      if (cliente) {
          setClienteActivo(cliente);
          setFormData({
              nombre: cliente.nombre || '',
              telefono: cliente.telefono || '',
              email: cliente.email || '',
              direccion: cliente.direccion || '',
              notas: cliente.notas || ''
          });
          
          // --- LOGICA DE UNIFICACIÓN ---
          // Buscamos primero por ID (La nueva forma robusta)
          const qPorId = query(collection(db, "pacientes"), where("clienteId", "==", cliente.id));
          const snapId = await getDocs(qPorId);
          let mascotas = snapId.docs.map(d => ({ id: d.id, ...d.data() }));

          // Si no hay por ID (datos antiguos), intentamos fallback por teléfono
          if (mascotas.length === 0 && cliente.telefono) {
             const qTel = query(collection(db, "pacientes"), where("telefono", "==", cliente.telefono));
             const snapTel = await getDocs(qTel);
             // Filtramos duplicados por si acaso
             const mascotasTel = snapTel.docs.map(d => ({ id: d.id, ...d.data() }));
             // Unimos y deduplicamos (preferencia al ID)
             mascotas = [...mascotas, ...mascotasTel.filter(m => !mascotas.some(ya => ya.id === m.id))];
          }

          setMascotasAsociadas(mascotas);
      } else {
          setClienteActivo(null);
          setFormData({ nombre: '', telefono: '', email: '', direccion: '', notas: '' });
          setMascotasAsociadas([]);
      }
      setVista('formulario');
  };

  const cerrarVista = () => window.history.back();

  const bloquearSwipe = (e) => e.stopPropagation();

  const handleInput = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const guardarCliente = async () => {
    if (!formData.nombre || !formData.telefono) return alert("Nombre y Teléfono son obligatorios");
    setGuardando(true); 

    try {
        const payload = { ...formData, updatedAt: new Date() };

        if (clienteActivo) {
            await updateDoc(doc(db, "clientes", clienteActivo.id), payload);
            
            // Opcional: Actualizar pacientes vinculados si cambió el teléfono (Legacy support)
            // En un sistema puro por ID, esto no sería necesario, pero ayuda en la transición.
        } else {
            await addDoc(collection(db, "clientes"), { ...payload, createdAt: new Date() });
        }
        
        cerrarVista(); 
    } catch (e) {
        console.error(e);
        alert("Error al guardar");
    } finally {
        setGuardando(false);
    }
  };

  const eliminarCliente = async () => {
      if(!confirm("¿Eliminar cliente? Sus mascotas quedarán huérfanas en el sistema.")) return;
      try {
          await deleteDoc(doc(db, "clientes", clienteActivo.id));
          cerrarVista();
      } catch (e) {
          alert("Error al eliminar");
      }
  };

  const inputClass = "w-full p-3 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-orange-500 transition-all";

  return (
    <div className="w-full h-full flex flex-col relative bg-gray-50 dark:bg-slate-900 transition-colors">
      
      {/* VISTA LISTA */}
      {vista === 'lista' && (
        <>
            <main className="flex-1 overflow-y-auto p-4">
                <div className="top-0 z-10 bg-gray-50 dark:bg-slate-900 pb-2 pt-1">
                    <input 
                        type="text" placeholder="🔍 Buscar cliente..." value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border-none shadow-sm text-gray-900 dark:text-white placeholder-gray-400"
                    />
                </div>

                <div className="space-y-3 mt-2">
                    {clientes.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || c.telefono.includes(busqueda)).map(c => (
                        <div key={c.id} onClick={() => abrirFormulario(c)} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm flex items-center gap-4 border-l-4 border-orange-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors relative">
                            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-2xl overflow-hidden text-orange-600 dark:text-orange-400 font-bold">
                                {c.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 dark:text-white">{c.nombre}</h3>
                                <p className="text-xs text-gray-500 dark:text-slate-400">{c.telefono}</p>
                            </div>
                            <span className="text-gray-300 dark:text-slate-600 text-xl">›</span>
                        </div>
                    ))}
                    {clientes.length === 0 && <div className="text-center py-10 text-gray-400 italic">No hay clientes registrados.</div>}
                </div>
                <div className="h-24"></div>
            </main>

            <button onClick={() => abrirFormulario()} className="absolute bottom-8 right-6 w-14 h-14 bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl font-bold hover:scale-110 active:scale-95 transition-transform z-50">+</button>
        </>
      )}

      {/* VISTA FORMULARIO */}
      {vista === 'formulario' && (
          <main 
            className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-slate-900 relative"
            onTouchStart={bloquearSwipe} onTouchMove={bloquearSwipe} onTouchEnd={bloquearSwipe}
          >
            <div className="flex justify-between items-center -mt-14 mb-6 -mx-4 sticky -top-5 bg-gray-100 dark:bg-slate-900 z-20 py-2 border-b border-gray-200 dark:border-slate-800 shadow-sm px-4">
                <button onClick={cerrarVista} className="text-gray-500 dark:text-gray-400 font-medium px-2 py-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded">Cancelar</button>
                <h2 className="font-bold text-gray-700 dark:text-white text-lg">{clienteActivo ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                <button onClick={guardarCliente} disabled={guardando} className={`font-bold text-lg px-2 py-1 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20 ${guardando ? 'text-gray-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {guardando ? '...' : 'Guardar'}
                </button>
            </div>

            <div className="max-w-md mx-auto space-y-6 mt-4">
                
                {/* INFO BÁSICA */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3 mt-14">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-2">Información de Contacto</h3>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nombre Completo *</label>
                        <input name="nombre" value={formData.nombre} onChange={handleInput} className={inputClass} placeholder="Ej. Juan Pérez" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Teléfono *</label>
                        <input name="telefono" type="tel" value={formData.telefono} onChange={handleInput} className={inputClass} placeholder="Ej. 5512345678" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Email</label>
                        <input name="email" type="email" value={formData.email} onChange={handleInput} className={inputClass} placeholder="correo@ejemplo.com" />
                    </div>
                </div>

                {/* DOMICILIO */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-3">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-2">Domicilio / Notas</h3>
                    <textarea name="direccion" placeholder="Dirección completa..." value={formData.direccion} onChange={handleInput} className={`${inputClass} h-20 text-sm`} />
                    <textarea name="notas" placeholder="Notas adicionales (deudas, preferencias...)" value={formData.notas} onChange={handleInput} className={`${inputClass} h-20 text-sm`} />
                </div>

                {/* MASCOTAS VINCULADAS */}
                {clienteActivo && (
                    <div className="bg-blue-50 dark:bg-slate-800/50 p-4 rounded-xl border border-blue-100 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-blue-700 dark:text-blue-400 text-sm">🐾 Mascotas del Cliente</h3>
                            <span className="text-xs bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">{mascotasAsociadas.length}</span>
                        </div>
                        
                        {mascotasAsociadas.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {mascotasAsociadas.map((m, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white dark:bg-slate-700 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-slate-600">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">
                                            {m.especie === 'gato' ? '🐱' : '🐶'}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-700 dark:text-gray-200 text-sm">{m.nombre}</p>
                                            <p className="text-[10px] text-gray-400">{m.raza}</p>
                                        </div>
                                        {/* Indicador de si está bien vinculado por ID */}
                                        {m.clienteId === clienteActivo.id ? 
                                            <span className="text-green-500 text-xs" title="Vinculado correctamente">🔗</span> :
                                            <span className="text-orange-400 text-xs" title="Vinculado por teléfono (Antiguo)">⚠️</span>
                                        }
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 italic text-center py-2">No tiene mascotas registradas.</p>
                        )}
                        
                        <p className="text-[10px] text-gray-400 mt-2 text-center">Para agregar una mascota, ve a la sección &quot;Pacientes&quot; y busca a este cliente.</p>
                    </div>
                )}

                {clienteActivo && (
                    <button onClick={eliminarCliente} className="w-full text-red-500 dark:text-red-400 text-sm py-4 hover:underline">
                        Eliminar Cliente
                    </button>
                )}
                
                <div className="h-20"></div>
            </div>
          </main>
      )}
    </div>
  );
}