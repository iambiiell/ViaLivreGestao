import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewState } from '../types';

interface GlobalTopProgressBarProps {
  currentView?: ViewState | string;
  isActionLoading?: boolean;
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
  'passenger-view': 'Portal do Passageiro',
  'license-view': 'Gestão de Licenças',
  'subscription-view': 'Assinatura & Planos'
};

export const GlobalTopProgressBar: React.FC<GlobalTopProgressBarProps> = ({
  currentView,
  isActionLoading = false
}) => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [activeTitle, setActiveTitle] = useState('');

  // Trigger loading when currentView changes or custom event is dispatched
  useEffect(() => {
    if (!currentView) return;

    const title = VIEW_TITLES[currentView] || 'Módulo do Sistema';
    setActiveTitle(title);
    setVisible(true);
    setProgress(15);

    const t1 = setTimeout(() => setProgress(55), 70);
    const t2 = setTimeout(() => setProgress(88), 180);
    const t3 = setTimeout(() => {
      setProgress(100);
      const t4 = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(t4);
    }, 380);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [currentView]);

  // Support global custom events: 'system-loading-start' and 'system-loading-end'
  useEffect(() => {
    const handleStart = (e: any) => {
      const customTitle = e.detail?.title || 'Sincronizando Dados...';
      setActiveTitle(customTitle);
      setVisible(true);
      setProgress(20);
      setTimeout(() => setProgress(75), 100);
    };

    const handleEnd = () => {
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 220);
    };

    window.addEventListener('system-loading-start', handleStart);
    window.addEventListener('system-loading-end', handleEnd);

    return () => {
      window.removeEventListener('system-loading-start', handleStart);
      window.removeEventListener('system-loading-end', handleEnd);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none">
            {/* Background Track */}
            <div className="w-full h-[3.5px] bg-slate-900/10 dark:bg-black/40 overflow-hidden relative backdrop-blur-sm">
              {/* Animated Progress Bar */}
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 relative shadow-[0_0_14px_rgba(250,204,21,0.9),0_0_4px_rgba(245,158,11,1)]"
              >
                {/* Leading glowing tip */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-white/70 blur-[2px] rounded-full" />
                
                {/* Shimmer sweep */}
                <motion.div
                  animate={{ x: ['-100%', '250%'] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                />
              </motion.div>
            </div>

            {/* Micro Badge Notification Floating Top */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="absolute top-2 left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/90 text-yellow-400 border border-yellow-400/40 shadow-xl backdrop-blur-md text-[9px] font-black uppercase tracking-widest pointer-events-none"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
              <span>{activeTitle}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
