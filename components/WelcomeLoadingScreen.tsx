import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, ShieldCheck, Bus, LayoutDashboard, Clock } from 'lucide-react';
import { User } from '../types';

interface WelcomeLoadingScreenProps {
  currentUser: User | null;
  systemLogo?: string | null;
  onFinish?: () => void;
}

const STEPS = [
  { label: 'Autenticação Validada', icon: ShieldCheck },
  { label: 'Carregando Permissões e Módulos', icon: LayoutDashboard },
  { label: 'Sincronizando Frota e Escalas', icon: Bus },
  { label: 'Acesso Liberado ao Terminal', icon: Sparkles }
];

export const WelcomeLoadingScreen: React.FC<WelcomeLoadingScreenProps> = ({
  currentUser,
  systemLogo,
  onFinish
}) => {
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  const [progress, setProgress] = useState(20);

  const firstName = currentUser?.full_name?.split(' ')[0] || currentUser?.name || 'Operador';
  const roleLabel = currentUser?.role === 'ADMIN'
    ? 'ADMINISTRADOR'
    : currentUser?.job_title || (currentUser?.role === 'RH' ? 'Recursos Humanos' : currentUser?.role || 'COLABORADOR');

  useEffect(() => {
    const stepTimer1 = setTimeout(() => { setCompletedSteps(1); setProgress(45); }, 500);
    const stepTimer2 = setTimeout(() => { setCompletedSteps(2); setProgress(75); }, 1200);
    const stepTimer3 = setTimeout(() => { setCompletedSteps(3); setProgress(92); }, 1900);
    const stepTimer4 = setTimeout(() => { setCompletedSteps(4); setProgress(100); }, 2600);
    const finishTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 3200);

    return () => {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      clearTimeout(stepTimer4);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[9999] min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 select-none overflow-hidden font-sans">
      {/* Background Animated Ambient Lights */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg bg-slate-900/90 backdrop-blur-2xl border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Top Glowing Ambient Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 via-amber-400 to-indigo-500" />

        {/* User Badge & Avatar Header */}
        <div className="flex items-center gap-5 mb-7">
          <motion.div
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-3xl p-1 shadow-lg shadow-yellow-500/20 flex items-center justify-center shrink-0 border-2 border-slate-900 overflow-hidden"
          >
            {systemLogo ? (
              <img
                src={`${systemLogo.split('?')[0]}?t=${Date.now()}`}
                alt="Logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center text-yellow-400 font-black text-2xl">
                {firstName.charAt(0)}
              </div>
            )}
          </motion.div>

          <div className="text-left space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 text-[9px] font-black tracking-widest uppercase">
                BEM-VINDO
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                ONLINE
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white italic tracking-tighter truncate uppercase">
              Olá, {firstName}!
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider truncate">
              {roleLabel} {currentUser?.unidade ? `• ${currentUser.unidade}` : ''}
            </p>
          </div>
        </div>

        {/* Realtime Module Synchronization Checklist */}
        <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800/80 mb-6 space-y-3">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
            <span>Sincronizando Perfil Operacional</span>
            <span className="font-mono text-yellow-400 font-bold">{progress}%</span>
          </div>

          <div className="space-y-2.5">
            {STEPS.map((step, idx) => {
              const isDone = completedSteps > idx;
              const isCurrent = completedSteps === idx;
              const StepIcon = step.icon;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                    isDone
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : isCurrent
                      ? 'bg-yellow-400/10 border border-yellow-400/40 text-yellow-300 shadow-sm'
                      : 'bg-transparent text-slate-500 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider">
                    <StepIcon size={14} className={isDone ? 'text-emerald-400' : isCurrent ? 'text-yellow-400 animate-pulse' : 'text-slate-600'} />
                    <span className={isDone ? 'text-slate-200' : isCurrent ? 'text-white' : 'text-slate-500'}>
                      {step.label}
                    </span>
                  </div>

                  {isDone ? (
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <Clock size={14} className="text-yellow-400 animate-spin shrink-0" style={{ animationDuration: '3s' }} />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-700 shrink-0" />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Smooth Linear Progress Bar */}
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800 mt-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)]"
            />
          </div>
        </div>

        <p className="text-[10px] text-slate-500 text-center font-bold uppercase tracking-[0.2em] italic">
          Entrando no terminal de controle de frotas...
        </p>
      </motion.div>
    </div>
  );
};
