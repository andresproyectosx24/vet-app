'use client';

export default function HistorialClienteView({ mascota, onBack }) {
  
  const handleDownload = () => {
    window.print();
  };

  // Ordenar historial por fecha descendente (más reciente primero)
  const historial = (mascota.historial || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden animate-in slide-in-from-bottom duration-300">
      
      {/* ESTILOS DE IMPRESIÓN LIMPIA */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            margin: 0;
            padding: 0;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-area {
            padding: 1.5cm !important; 
            margin: 0 !important;
            width: 100% !important;
          }
          /* Ocultar elementos no deseados */
          .no-print { display: none !important; }
        }
      `}</style>

      {/* 1. HEADER (Solo visible en pantalla) */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800 print:hidden bg-white dark:bg-slate-900 sticky top-0 z-10">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-900 dark:text-gray-400">
          ← Volver
        </button>
        <h2 className="font-bold text-gray-800 dark:text-white">Expediente Clínico</h2>
        <div className="w-8"></div>
      </div>

      {/* 2. CONTENIDO IMPRIMIBLE */}
      <div className="flex-1 overflow-y-auto p-6 print:overflow-visible bg-gray-50 dark:bg-slate-900 print:bg-white" id="printable-area">
        
        {/* Encabezado del Paciente (Identificación) */}
        <div className="bg-white dark:bg-slate-800 print:bg-white print:border print:border-gray-300 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mb-8 flex items-center gap-6 break-inside-avoid">
            <div className="w-24 h-24 rounded-full bg-blue-100 print:bg-gray-100 flex items-center justify-center text-4xl overflow-hidden border-4 border-white dark:border-slate-700 shadow-md print:shadow-none print:border-gray-200">
                {mascota.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mascota.foto} alt={mascota.nombre} className="w-full h-full object-cover" />
                ) : (
                    <span>{mascota.especie === 'gato' ? '🐱' : '🐶'}</span>
                )}
            </div>
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white print:text-black mb-1">{mascota.nombre}</h1>
                <div className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600 space-y-0.5">
                    <p>Propietario: <span className="font-medium text-gray-800 dark:text-gray-200 print:text-black">{mascota.dueño}</span></p>
                    <p>Especie: {mascota.especie} | Raza: {mascota.raza}</p>
                    <p>Edad: {mascota.edad}</p>
                </div>
            </div>
        </div>

        {/* Título Sección */}
        <h3 className="text-lg font-bold text-blue-800 dark:text-blue-400 print:text-blue-900 mb-6 px-2 uppercase tracking-wider border-b-2 border-blue-100 print:border-blue-900 pb-1 break-after-avoid">
            Historial Médico
        </h3>

        {/* Lista de Consultas */}
        <div className="space-y-6 print:space-y-4">
            {historial.length === 0 ? (
                <p className="text-center text-gray-400 py-10 italic">No hay historial registrado.</p>
            ) : (
                historial.map((registro, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 print:bg-transparent p-5 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 print:border-b print:border-t-0 print:border-x-0 print:rounded-none print:shadow-none break-inside-avoid">
                        
                        {/* Cabecera de la Consulta */}
                        <div className="flex justify-between items-start mb-3 print:mb-2">
                            <div>
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 print:text-gray-500 uppercase tracking-wide">
                                    {new Date(registro.fecha).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                                <h3 className="font-bold text-gray-800 dark:text-white print:text-black text-xl mt-1">
                                    {registro.motivo || 'Consulta General'}
                                </h3>
                            </div>
                            {registro.peso && (
                                <span className="bg-gray-100 dark:bg-slate-700 print:bg-gray-50 print:border print:border-gray-200 text-gray-600 dark:text-gray-300 print:text-black text-xs font-bold px-3 py-1 rounded-full">
                                    {registro.peso} kg
                                </span>
                            )}
                        </div>

                        {/* Detalles */}
                        <div className="space-y-3 print:space-y-2 text-sm">
                            {registro.diagnostico && (
                                <div className="p-3 bg-blue-50 dark:bg-slate-700/30 print:bg-transparent print:p-0 rounded-lg border-l-4 border-blue-500 print:border-none">
                                    <span className="font-bold text-blue-700 dark:text-blue-300 print:text-black block text-xs uppercase mb-1">Diagnóstico</span>
                                    <p className="text-gray-700 dark:text-gray-300 print:text-black">{registro.diagnostico}</p>
                                </div>
                            )}

                            {registro.tratamiento && (
                                <div className="p-3 bg-green-50 dark:bg-slate-700/30 print:bg-transparent print:p-0 rounded-lg border-l-4 border-green-500 print:border-none">
                                    <span className="font-bold text-green-700 dark:text-green-300 print:text-black block text-xs uppercase mb-1">Tratamiento</span>
                                    <p className="text-gray-700 dark:text-gray-300 print:text-black whitespace-pre-wrap">
                                        {typeof registro.tratamiento === 'string' ? registro.tratamiento : 
                                            Array.isArray(registro.tratamiento) ? 
                                                registro.tratamiento.map(m => `• ${m.nombre} (${m.dosis} - ${m.frecuencia})`).join('\n') 
                                            : 'Ver detalles'}
                                    </p>
                                </div>
                            )}

                            {registro.notas && (
                                <div className="pt-2 mt-2 border-t border-gray-100 dark:border-slate-700 print:border-gray-200">
                                    <span className="font-bold text-gray-500 print:text-gray-600 text-xs">Observaciones:</span>
                                    <p className="text-gray-600 dark:text-gray-400 print:text-black italic">{registro.notas}</p>
                                </div>
                            )}
                        </div>

                    </div>
                ))
            )}
        </div>

        {/* Footer del PDF */}
        <div className="hidden print:block mt-12 text-center border-t pt-4 text-sm text-gray-400 break-inside-avoid">
            <p>Resumen clínico generado por Mi Veterinaria App.</p>
            <p>Este documento es informativo y no sustituye una receta médica oficial.</p>
        </div>

      </div>

      {/* 3. BOTÓN DESCARGAR */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 print:hidden">
          <button 
            onClick={handleDownload}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <span>📥</span> Descargar Historial / Imprimir
          </button>
      </div>

    </div>
  );
}