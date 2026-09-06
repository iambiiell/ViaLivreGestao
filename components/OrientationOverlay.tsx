import React, { useState, useEffect } from 'react';
import { Smartphone, RotateCw, X, ArrowRightLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const OrientationOverlay: React.FC = () => {
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Check if device is in landscape mode on a handheld or small form-factor screen
      const isLandscape = window.matchMedia('(orientation: landscape)').matches || window.innerWidth > window.innerHeight;
      const isSmallScreen = window.innerHeight <= 600 || window.innerWidth <= 960;
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

      // Trigger warning when in landscape on a mobile-dimensioned viewport or touch device
      if (isLandscape && isSmallScreen && isTouch) {
        setIsLandscapeMobile(true);
      } else {
        setIsLandscapeMobile(false);
        // Reset dismiss state once user rotates back to portrait
        setIsDismissed(false);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', checkOrientation);
    }

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', checkOrientation);
      }
    };
  }, []);

  if (!isLandscapeMobile || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] bg-slate-950/85 dark:bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-white dark:bg-zinc-900 border-2 border-yellow-400/80 rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center"
        >
          {/* Subtle Ambient Background Accent */}
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close / Dismiss Button */}
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title="Continuar em modo paisagem"
          >
            <X size={20} />
          </button>

          {/* Animated Phone Rotation Illustration */}
          <div className="relative w-24 h-24 mx-auto mb-5 flex items-center justify-center">
            <div className="absolute inset-0 bg-yellow-400/10 rounded-full animate-ping opacity-30" />
            <motion.div
              animate={{ 
                rotate: [0, 90, 90, 0],
                scale: [1, 1.05, 1.05, 1]
              }}
              transition={{ 
                duration: 2.8, 
                repeat: Infinity, 
                repeatDelay: 1,
                ease: "easeInOut" 
              }}
              className="w-16 h-20 bg-slate-900 dark:bg-zinc-800 border-2 border-yellow-400 rounded-2xl flex flex-col items-center justify-between p-1.5 shadow-xl"
            >
              <div className="w-4 h-1 bg-slate-700 rounded-full" />
              <div className="w-full flex-1 my-1 bg-yellow-400/20 rounded-lg flex items-center justify-center">
                <RotateCw size={16} className="text-yellow-400 animate-spin" style={{ animationDuration: '4s' }} />
              </div>
              <div className="w-2 h-2 rounded-full border border-yellow-400/60" />
            </motion.div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-400/15 border border-yellow-400/30 rounded-full mb-3">
            <Sparkles size={12} className="text-yellow-600 dark:text-yellow-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-yellow-700 dark:text-yellow-400">
              Modo Paisagem Detectado
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight mb-2">
            Gire para o Modo Retrato
          </h3>

          <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium leading-relaxed mb-6">
            Para uma melhor experiência no sistema de gestão de frotas e visualização ideal de itinerários, relatórios e painéis, sugerimos utilizar o dispositivo na posição <strong className="text-slate-900 dark:text-white font-bold">vertical (Retrato)</strong>.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsDismissed(true)}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-[10px] font-black uppercase tracking-wider transition-all"
            >
              Continuar em Paisagem
            </button>
            <button
              onClick={() => {
                // If Fullscreen Orientation Lock API is supported, request portrait
                if (window.screen?.orientation && (window.screen.orientation as any).lock) {
                  try {
                    (window.screen.orientation as any).lock('portrait').catch(() => {});
                  } catch (e) {}
                }
                setIsDismissed(true);
              }}
              className="flex-1 py-3 px-4 rounded-2xl bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-lg shadow-yellow-400/20 transition-all flex items-center justify-center gap-2"
            >
              <Smartphone size={15} />
              <span>Usar em Retrato</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OrientationOverlay;
