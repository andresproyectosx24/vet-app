import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col transition-colors justify-between">
      
      {/* 1. CONTENIDO CENTRAL (Minimalista) */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700">
        
        {/* Logo / Icono Central */}
        <div className="w-32 h-32 bg-white dark:bg-slate-800 rounded-full shadow-2xl flex items-center justify-center mb-8 border-4 border-blue-50 dark:border-slate-700">
          <span className="text-6xl">🏥</span>
        </div>

        <h1 className="text-5xl font-black text-gray-800 dark:text-white mb-4 tracking-tighter">
          Bienvenido
        </h1>
        
        <p className="text-xl text-gray-500 dark:text-gray-400 mb-12 max-w-lg font-light">
          Sistema de Atención Veterinaria.<br/>
          <strong className="font-bold text-gray-700 dark:text-gray-300">Cuidamos lo que más amas.</strong>
        </p>

        {/* El "Botón Grande" que lleva al menú principal del cliente */}
        <Link 
          href="/inicio" 
          className="group relative inline-flex items-center justify-center px-10 py-4 font-bold text-white transition-all duration-200 bg-blue-600 text-xl rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95"
        >
          <span className="mr-3 text-2xl">🐾</span>
          <span>Comenzar</span>
          {/* Indicador de "Online" pulsando para llamar la atención */}
          <div className="absolute -top-1 -right-1">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
            </span>
          </div>
        </Link>

      </main>

      {/* 2. FOOTER (Con el acceso "secreto" al admin) */}
      <footer className="p-6 text-center">
        <p className="text-xs text-gray-300 dark:text-slate-700 mb-4">© 2025 Mi Veterinaria</p>
        
        {/* Link discreto: Sin botón, solo texto pequeño y gris tenue */}
        <Link 
            href="/login" 
            className="text-[10px] text-gray-200 dark:text-slate-800 hover:text-gray-400 dark:hover:text-slate-600 transition-colors uppercase tracking-widest"
        >
            • Acceso Personal •
        </Link>
      </footer>
    </div>
  );
}