'use client';

import { comprimirImagen } from '../../utils/compressor';

export default function FotoSection({ fotoPreview, onFotoChange, onFotoDelete }) {
  const procesarArchivo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const archivoComprimido = await comprimirImagen(file);
      const url = URL.createObjectURL(archivoComprimido);
      onFotoChange(archivoComprimido, url);
    } catch (error) {
      console.error(error);
      alert('No se pudo procesar la imagen');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative w-32 h-32">
        <div className="w-full h-full rounded-full bg-gray-200 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-lg flex items-center justify-center overflow-hidden">
          {fotoPreview ? (
            <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-5xl opacity-30">🐾</span>
          )}
        </div>

        <label className="absolute bottom-0 right-0 bg-blue-600 text-white w-9 h-9 rounded-full cursor-pointer hover:bg-blue-700 transition shadow-md z-10 flex items-center justify-center">
          <span className="text-sm">📷</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={procesarArchivo}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex gap-4 text-sm font-medium">
        <label className="flex items-center gap-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition">
          <span>📁 Galería</span>
          <input
            type="file"
            accept="image/*"
            onChange={procesarArchivo}
            className="hidden"
          />
        </label>

        {fotoPreview && (
          <button onClick={onFotoDelete} className="text-red-500 px-2">
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
