import React from 'react';
import { motion } from 'framer-motion';
import { BusFront, Sparkles, RefreshCw, Activity, Compass } from 'lucide-react';

interface CommonLoaderProps {
  variant?: 'bus-radar' | 'orbit' | 'inline' | 'skeleton' | 'card' | 'pulse';
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CommonLoader: React.FC<CommonLoaderProps> = ({
  variant = 'bus-radar',
  message = 'Carregando dados...',
  size = 'md',
  className = ''
}) => {
  if (variant === 'skeleton') {
    return (
      <div className={`w-full space-y-3 animate-pulse p-4 ${className}`}>
        <div className="h-6 bg-slate-200 dark:bg-zinc-800 rounded-xl w-1/3" />
        <div className="h-12 bg-slate-150 dark:bg-zinc-850 rounded-2xl w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="h-20 bg-slate-100 dark:bg-zinc-800 rounded-2xl" />
          <div className="h-20 bg-slate-100 dark:bg-zinc-800 rounded-2xl" />
          <div className="h-20 bg-slate-100 dark:bg-zinc-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`p-8 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md rounded-3xl border border-slate-100 dark:border-zinc-800 flex flex-col items-center justify-center text-center gap-4 ${className}`}>
        <div className="relative flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="w-14 h-14 rounded-full border-2 border-slate-200 dark:border-zinc-700 border-t-yellow-400 dark:border-t-yellow-400"
          />
          <BusFront size={22} className="text-yellow-500 absolute animate-pulse" />
        </div>
        {message && (
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">
            {message}
          </p>
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 ${className}`}>
        <RefreshCw size={14} className="animate-spin text-yellow-500" />
        <span>{message}</span>
      </div>
    );
  }

  if (variant === 'orbit') {
    return (
      <div className={`flex flex-col items-center justify-center gap-4 py-8 ${className}`}>
        <div className="relative w-16 h-16 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-full h-full rounded-full border-2 border-dashed border-yellow-400/60 absolute"
          />
          <motion.div
            animate={{ scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="w-8 h-8 rounded-xl bg-yellow-400 flex items-center justify-center text-slate-950 shadow-lg shadow-yellow-400/30"
          >
            <Sparkles size={16} />
          </motion.div>
        </div>
        {message && (
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">
            {message}
          </p>
        )}
      </div>
    );
  }

  // Default 'bus-radar' variant
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-10 ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Outer Pulsing Wave */}
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-20 h-20 rounded-full border border-yellow-400/40 absolute"
        />
        
        {/* Rotating Radar Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 rounded-full border-2 border-slate-200 dark:border-zinc-800 border-t-yellow-400 border-r-yellow-400"
        />

        {/* Central Vehicle Icon */}
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-10 h-10 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center absolute shadow-md shadow-yellow-400/40"
        >
          <BusFront size={20} />
        </motion.div>
      </div>

      {message && (
        <div className="text-center space-y-1">
          <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-zinc-200">
            {message}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Sincronizando em tempo real
          </p>
        </div>
      )}
    </div>
  );
};
