import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-100">
      <h1 className="text-3xl font-bold mb-8 text-black">Bienvenido a VetApp</h1>
      
      <div className="grid gap-6 w-full max-w-sm">
        {/* Botón para ir al lado CLIENTE */}
        <Link 
          href="/agendar" 
          className="block p-6 bg-white border-l-8 border-blue-500 shadow-lg rounded hover:scale-105 transition"
        >
          <h2 className="text-xl font-bold text-gray-800">Soy Cliente 🐶</h2>
          <p className="text-gray-500 text-sm">Quiero agendar una cita</p>
        </Link>

        {/* Botón para ir al lado VETERINARIO */}
        <Link 
          href="/login" 
          className="block p-6 bg-slate-800 border-l-8 border-green-500 shadow-lg rounded hover:scale-105 transition"
        >
          <h2 className="text-xl font-bold text-white">Soy Veterinario 👨‍⚕️</h2>
          <p className="text-gray-400 text-sm">Gestionar mi negocio</p>
        </Link>
      </div>
    </div>
  );
}