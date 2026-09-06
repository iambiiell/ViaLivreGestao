import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BusFront, Sparkles, Activity, ShieldCheck, Wifi, Radio } from 'lucide-react';

interface SystemLoadingScreenProps {
  systemLogo?: string | null;
  message?: string;
  customStatus?: string;
}

const BOOT_STEPS = [
  { text: "Iniciando núcleo de telemetria...", icon: Activity },
  { text: "Conectando banco de dados da frota...", icon: Wifi },
  { text: "Sincronizando rotas, viagens e escalas...", icon: BusFront },
  { text: "Validando integridade e segurança...", icon: ShieldCheck },
  { text: "Preparando terminal operacional...", icon: Sparkles }
];

export const SystemLoadingScreen: React.FC<SystemLoadingScreenProps> = ({
  systemLogo,
  message,
  customStatus
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < BOOT_STEPS.length - 1 ? prev + 1 : prev));
    }, 700);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) return 98;
        const jump = Math.floor(Math.random() * 12) + 6;
        return Math.min(prev + jump, 98);
      });
    }, 280);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const CurrentIcon = BOOT_STEPS[currentStepIndex]?.icon || Sparkles;

  return (
    <div className="fixed inset-0 z-[9999] min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 select-none overflow-hidden font-sans">
      {/* Background Ambient Glow Orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
      
      {/* Subtle Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md flex flex-col items-center text-center"
      >
        {/* Central Futuristic Icon Portal */}
        <div className="relative mb-8 flex items-center justify-center">
          {/* Outer Pulsing Radar Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
            className="w-32 h-32 rounded-full border border-dashed border-yellow-400/30 absolute"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
            className="w-28 h-28 rounded-full border-2 border-t-yellow-400 border-r-transparent border-b-indigo-500 border-l-transparent absolute shadow-[0_0_20px_rgba(250,204,21,0.25)]"
          />

          {/* Radar Scanner Beam */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
            className="w-28 h-28 rounded-full absolute pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg, rgba(250,204,21,0.25) 0deg, transparent 60deg, transparent 360deg)'
            }}
          />

          {/* Central Logo Container */}
          <motion.div
            animate={{
              y: [0, -4, 0],
              boxShadow: [
                '0 0 25px rgba(250,204,21,0.2)',
                '0 0 45px rgba(250,204,21,0.45)',
                '0 0 25px rgba(250,204,21,0.2)'
              ]
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 bg-gradient-to-b from-slate-900 via-slate-900 to-zinc-950 rounded-2xl border-2 border-yellow-400/80 flex items-center justify-center relative overflow-hidden backdrop-blur-xl"
          >
            {systemLogo ? (
              <img
                src={`${systemLogo.split('?')[0]}?t=${Date.now()}`}
                alt="Logo"
                className="w-14 h-14 object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="relative">
                <BusFront size={38} className="text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]" />
                <motion.div
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"
                />
              </div>
            )}

            {/* Shimmer Light Reflection Sweep */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
          </motion.div>
        </div>

        {/* Brand Title */}
        <div className="space-y-1 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/25 text-yellow-400 text-[10px] font-black tracking-[0.25em] uppercase mb-1">
            <Radio size={11} className="animate-pulse text-yellow-400" />
            <span>SISTEMA DE GESTÃO DE FROTAS</span>
          </div>
          <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">
            ViaLivre Gestão
          </h2>
        </div>

        {/* Dynamic Telemetry Status Card */}
        <div className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-2xl space-y-3.5">
          {/* Animated Status Row */}
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2.5 text-left min-w-0">
              <div className="w-7 h-7 rounded-lg bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-yellow-400 shrink-0">
                <CurrentIcon size={14} className="animate-pulse" />
              </div>
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentStepIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="font-bold text-slate-200 text-[11px] uppercase tracking-wide truncate"
                >
                  {customStatus || BOOT_STEPS[currentStepIndex]?.text || message || 'Carregando recursos...'}
                </motion.span>
              </AnimatePresence>
            </div>
            <span className="font-mono font-black text-xs text-yellow-400 shrink-0 pl-2">
              {progress}%
            </span>
          </div>

          {/* High-Tech Glowing Progress Bar */}
          <div className="relative w-full h-2 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <motion.div
              initial={{ width: '10%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-yellow-300 relative shadow-[0_0_12px_rgba(250,204,21,0.7)]"
            >
              {/* Shining Tip Light */}
              <div className="absolute right-0 top-0 bottom-0 w-3 bg-white rounded-full blur-[1px]" />
            </motion.div>
          </div>

          {/* Footer Sub-telemetry indicators */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[9px] text-slate-400 uppercase font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Servidor: Ativo
            </span>
            <span className="text-slate-500">v1.5.0 PRO</span>
            <span className="flex items-center gap-1 text-slate-300">
              <Wifi size={10} className="text-yellow-400" />
              Sync 100%
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
