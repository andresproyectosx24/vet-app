'use client';

export default function CartillaClienteView({ mascota, onBack }) {
  
  const handleDownload = () => {
    window.print();
  };

  // Ordenar vacunas por fecha descendente
  const vacunas = (mascota.vacunas || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden animate-in slide-in-from-bottom duration-300">
      
      {/* ESTILOS DE IMPRESIÓN LIMPIA */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0; /* ESTO ES LA CLAVE: Elimina fecha, URL y n.º de página */
            size: auto;
          }
          body {
            margin: 0;
            padding: 0;
            background: white !important;
          }
          /* Ajuste para que el contenido no quede pegado al borde del papel al quitar los márgenes */
          #printable-area {
            padding: 1.5cm !important; 
            margin: 0 !important;
            width: 100% !important;
          }
          /* Ocultar cualquier elemento que no sea el área imprimible es buena práctica, 
             aunque ya usamos la clase print:hidden en los botones */
        }
      `}</style>

      {/* 1. HEADER (Solo visible en pantalla) */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800 print:hidden bg-white dark:bg-slate-900 sticky top-0 z-10">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-900 dark:text-gray-400">
          ← Volver
        </button>
        <h2 className="font-bold text-gray-800 dark:text-white">Cartilla Digital</h2>
        <div className="w-8"></div> {/* Espaciador */}
      </div>

      {/* 2. CONTENIDO (Esto es lo que se imprime/descarga) */}
      <div className="flex-1 overflow-y-auto p-6 print:overflow-visible bg-gray-50 dark:bg-slate-900 print:bg-white" id="printable-area">
        
        {/* Tarjeta de Identificación (Estilo Credencial) */}
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
        <h3 className="text-lg font-bold text-blue-800 dark:text-blue-400 print:text-blue-900 mb-4 px-2 uppercase tracking-wider border-b-2 border-blue-100 print:border-blue-900 pb-1 break-after-avoid">
            Registro de Vacunación
        </h3>

        {/* Lista de Vacunas (Diseño Tabla Limpia) */}
        <div className="space-y-4 print:space-y-2">
            {vacunas.length === 0 ? (
                <p className="text-center text-gray-400 py-10 italic">No hay vacunas registradas.</p>
            ) : (
                vacunas.map((vacuna, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 print:bg-transparent p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 print:border-b print:border-t-0 print:border-x-0 print:rounded-none print:shadow-none flex justify-between items-start break-inside-avoid">
                        <div>
                            <p className="font-bold text-gray-800 dark:text-white print:text-black text-lg">{vacuna.nombre}</p>
                            <p className="text-xs text-gray-400 print:text-gray-600 mt-1">
                                {vacuna.observaciones ? `Nota: ${vacuna.observaciones}` : 'Aplicación regular'}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-gray-500 print:text-gray-600 uppercase font-bold">Aplicada</div>
                            <div className="text-gray-900 dark:text-white print:text-black font-mono">{vacuna.fecha}</div>
                            
                            {vacuna.proxima && (
                                <div className="mt-2 print:mt-1">
                                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 print:border-none print:bg-transparent print:text-black print:p-0">
                                        Próxima: <b>{vacuna.proxima}</b>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Footer del PDF */}
        <div className="hidden print:block mt-12 text-center border-t pt-4 text-sm text-gray-400 break-inside-avoid">
            <p>Documento generado digitalmente por Mi Veterinaria App.</p>
            <p>Consulta válida como comprobante informativo.</p>
        </div>

      </div>

      {/* 3. BOTÓN DESCARGAR (Flotante) */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 print:hidden">
          <button 
            onClick={handleDownload}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <span>📥</span> Descargar PDF / Imprimir
          </button>
      </div>

    </div>
  );
}