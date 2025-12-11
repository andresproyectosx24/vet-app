'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const PAGE_ORDER = {
  '/dashboard': 0,
  '/pacientes': 1,
};

const PAGE_INFO = {
  '/dashboard': { title: 'Agenda', icon: '📅' },
  '/pacientes': { title: 'Pacientes', icon: '🐶' },
};

export default function AdminLayout({ children }) {
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  const prevPath = useRef(pathname);
  const contentRef = useRef(null);
  
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const dragging = useRef(false);
  const isScrolling = useRef(false);
  const minSwipeDistance = 60;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace('/login');
      else setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (prevPath.current !== pathname) {
    const prevIndex = PAGE_ORDER[prevPath.current] ?? 0;
    const currIndex = PAGE_ORDER[pathname] ?? 0;
    if (currIndex > prevIndex) setDirection('enter-from-right');
    else if (currIndex < prevIndex) setDirection('enter-from-left');
    prevPath.current = pathname;
  }

  const getNextPath = () => {
    const idx = PAGE_ORDER[pathname] ?? 0;
    const nextIdx = idx + 1;
    const entry = Object.entries(PAGE_ORDER).find(([, v]) => v === nextIdx);
    return entry ? entry[0] : null;
  };

  const getPrevPath = () => {
    const idx = PAGE_ORDER[pathname] ?? 0;
    const prevIdx = idx - 1;
    const entry = Object.entries(PAGE_ORDER).find(([, v]) => v === prevIdx);
    return entry ? entry[0] : null;
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    currentX.current = t.clientX;
    dragging.current = true;
    isScrolling.current = false;

    const el = contentRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.willChange = 'transform';
    }
  };

  const onTouchMove = (e) => {
    if (!dragging.current || isScrolling.current) return;
    
    const t = e.touches[0];
    currentX.current = t.clientX;
    const deltaX = currentX.current - startX.current;
    const deltaY = t.clientY - startY.current;

    // DETECCIÓN INTELIGENTE SCROLL
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
        isScrolling.current = true;
        // CORRECCIÓN: Si ya habíamos movido un poco el panel, lo regresamos a 0 inmediatamente
        const el = contentRef.current;
        if (el) {
            el.style.transition = 'transform 100ms ease-out';
            el.style.transform = 'translateX(0)';
        }
        return;
    }

    // Límites
    if (deltaX > 0 && !getPrevPath()) return;
    if (deltaX < 0 && !getNextPath()) return;

    const el = contentRef.current;
    if (el) el.style.transform = `translateX(${deltaX}px)`;
  };

  const resetSwipe = () => {
    dragging.current = false;
    isScrolling.current = false;
    const el = contentRef.current;
    if (el) {
      el.style.transition = 'transform 200ms ease-out';
      el.style.transform = 'translateX(0)';
    }
  };

  const onTouchEnd = () => {
    if (!dragging.current || isScrolling.current) {
        // Aseguramos limpieza si soltamos mientras hacíamos scroll
        resetSwipe();
        return;
    } 

    dragging.current = false;
    const delta = currentX.current - startX.current;
    const el = contentRef.current;
    
    const isValidMove = (delta > 0 && getPrevPath()) || (delta < 0 && getNextPath());

    if (Math.abs(delta) >= minSwipeDistance && isValidMove) {
      const to = delta < 0 ? getNextPath() : getPrevPath();
      if (el) {
        el.style.transition = 'transform 200ms ease-out';
        el.style.transform = `translateX(${delta < 0 ? -window.innerWidth : window.innerWidth}px)`;
      }
      if (to) router.replace(to);
    } else {
      // Snap back (regreso elástico)
      resetSwipe();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-green-600">
        <div className="animate-pulse font-bold">Cargando Sistema...</div>
      </div>
    );
  }

  const currentInfo = PAGE_INFO[pathname] || { title: 'Veterinaria', icon: '🐾' };

  return (
    <div className="flex flex-col h-full min-h-[100dvh] overflow-hidden bg-gray-50 dark:bg-slate-900">
      <style jsx global>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-enter-from-right { animation: slideInRight 220ms ease-out; }
        .animate-enter-from-left { animation: slideInLeft 220ms ease-out; }
      `}</style>

      <header className="fixed top-0 w-full h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 z-40 flex items-center justify-center shadow-sm transition-colors">
        <h1 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <span>{currentInfo.icon}</span>
          {currentInfo.title}
        </h1>
      </header>

      <div
        key={pathname}
        ref={contentRef}
        className={`flex-1 pt-14 pb-20 overflow-hidden flex flex-col ${direction === 'enter-from-right' ? 'animate-enter-from-right' : ''} ${direction === 'enter-from-left' ? 'animate-enter-from-left' : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={resetSwipe} // NUEVO: Previene que se quede trabado si el navegador interrumpe
      >
        {children}
      </div>

      <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex justify-around items-center h-16 z-50 pb-safe transition-colors">
        <Link 
          href="/dashboard" 
          replace={true}
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${pathname === '/dashboard' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <span className="text-xl">📅</span>
          <span className="text-[10px] font-bold mt-1">Agenda</span>
        </Link>

        <Link 
          href="/pacientes" 
          replace={true}
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${pathname === '/pacientes' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <span className="text-xl">🐶</span>
          <span className="text-[10px] font-bold mt-1">Pacientes</span>
        </Link>
      </nav>
    </div>
  );
}