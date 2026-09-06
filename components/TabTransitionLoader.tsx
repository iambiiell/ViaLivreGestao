import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewState } from '../types';

interface TabTransitionLoaderProps {
  currentView: ViewState | string;
  children: React.ReactNode;
}

const VIEW_TITLES: Record<string, string> = {
  'dashboard': 'Painel Geral',
  'schedule': 'Quadro de Escalas & Horários',
  'routes': 'Gestão de Linhas & Rotas',
  'drivers': 'Motoristas & Tripulação',
  'users': 'Usuários & Permissões',
  'vehicles': 'Frota de Veículos',
  'companies': 'Empresas & Garagens',
  'ticketing': 'Venda de Passagens',
  'monitoring': 'Centro de Controle Operacional',
  'observations': 'Ocorrências & Avarias',
  'maintenance': 'Manutenção da Frota',
  'reports-view': 'Relatórios & Auditoria',
  'shifts': 'Escala de Turnos',
  'inspections': 'Checklists & Vistorias',
  'payroll': 'Folha & Holerites',
  'time-tracking': 'Ponto Eletrônico',
  'traffic-violations': 'Infrações & Multas',
  'notifications': 'Central de Notificações',
  'recruitment': 'Recrutamento & Seleção',
  'sac': 'Atendimento SAC',
  'dispatcher': 'Despacho & Tráfego',
  'skins': 'Repositório de Skins',
  'passenger-view': 'Portal do Passageiro'
};

export const TabTransitionLoader: React.FC<TabTransitionLoaderProps> = ({ currentView, children }) => {
  const [isSwitching, setIsSwitching] = useState(false);
  const [activeViewTitle, setActiveViewTitle] = useState('');

  useEffect(() => {
    setIsSwitching(true);
    setActiveViewTitle(VIEW_TITLES[currentView] || 'Módulo Operacional');
    
    const timer = setTimeout(() => {
      setIsSwitching(false);
    }, 380);

    return () => clearTimeout(timer);
  }, [currentView]);

  return (
    <div className="relative w-full">
      {/* Top Neon Progress Bar */}
      <AnimatePresence>
        {isSwitching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[999] h-[3px] pointer-events-none overflow-hidden bg-slate-900/10 dark:bg-zinc-800/20"
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="h-full w-2/5 bg-gradient-to-r from-transparent via-yellow-400 to-amber-500 shadow-[0_0_12px_rgba(250,204,21,0.9)]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Micro Badge Notification for Instant Feedback */}
      <AnimatePresence>
        {isSwitching && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[400] pointer-events-none hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-zinc-900/90 text-yellow-400 border border-yellow-400/40 shadow-xl backdrop-blur-md text-[10px] font-black uppercase tracking-wider"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
            <span>Carregando {activeViewTitle}...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skeleton Screen Placeholder During Switch */}
      <AnimatePresence>
        {isSwitching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full space-y-6 py-4 pointer-events-none absolute inset-0 z-20 bg-slate-50/90 dark:bg-zinc-950/90 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-6 w-48 bg-slate-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
                <div className="h-3 w-72 bg-slate-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
              </div>
              <div className="h-10 w-32 bg-slate-200 dark:bg-zinc-800 rounded-2xl animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-5 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                  <div className="h-3 w-20 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="h-6 w-28 bg-slate-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-6 space-y-4">
              <div className="h-5 w-40 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 w-full bg-slate-100 dark:bg-zinc-800/50 rounded-2xl animate-pulse" />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated View Container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, y: 6, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.995 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
