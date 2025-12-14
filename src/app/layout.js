import "./globals.css";

export const metadata = {
  title: "App Veterinaria",
  description: "Gestión de pacientes y citas",
  manifest: "/manifest.json",
  // 1. ESTO ES LO NUEVO: Forzamos los iconos para Apple y Android
  icons: {
    icon: "/icon-192.png",      // Icono para pestañas y Android
    shortcut: "/icon-192.png",  // Acceso directo
    apple: "/icon-512.png",     // <--- ESTO ARREGLA EL IPHONE/IPAD
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Veterinaria",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="h-dvh">
      <body className="h-dvh flex flex-col antialiased bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white">
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
