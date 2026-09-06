
import React from 'react';
import { LayoutDashboard, Map, Calendar, Menu, BrainCircuit, Timer, BusFront, Ticket, CreditCard, DollarSign, PlayCircle } from 'lucide-react';
import { ViewState, User } from '../types';
import { motion } from 'framer-motion';

interface MobileBottomNavProps {
  currentView: ViewState | string;
  onChangeView: (view: ViewState | string) => void;
  onOpenMenu: () => void;
  currentUser: User | null;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentView, onChangeView, onOpenMenu, currentUser }) => {
  const allTabs = [
    { id: 'dashboard', label: 'INÍCIO', icon: LayoutDashboard, roles: ['ADMIN', 'RH', 'MECHANIC', 'TICKET_AGENT'] },
    { id: 'operation-center', label: 'OPERACIONAL', icon: PlayCircle, roles: ['ADMIN', 'DRIVER', 'CONDUCTOR', 'FISCAL', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'] },
    { id: 'schedule', label: 'ESCALA', icon: Calendar, roles: ['ADMIN', 'FISCAL'] },
    { id: 'time-tracking', label: 'PONTO', icon: Timer, roles: ['ADMIN', 'DRIVER', 'CONDUCTOR', 'MECHANIC', 'FISCAL', 'TICKET_AGENT', 'RH', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'] },
    { id: 'passenger-view', label: 'VIAGENS', icon: Ticket, roles: ['PASSENGER'] },
    { id: 'passenger-view', label: 'RECARGA', icon: CreditCard, roles: ['PASSENGER'], metadata: { tab: 'recharge' } },
  ];

  const filteredTabs = allTabs.filter(tab => {
      const isFullAdmin = currentUser?.role === 'ADMIN' || currentUser?.is_full_admin || (currentUser?.job_title || '').toUpperCase().includes('ADMINISTRADOR') || (currentUser?.job_title || '').toUpperCase().includes('ADMIN');
      if (isFullAdmin) return true;
      const userRole = (currentUser?.role || '').toUpperCase();
      const userJob = (currentUser?.job_title || '').toUpperCase();
      return tab.roles.some(r => r.toUpperCase() === userRole || userJob.includes(r.toUpperCase()));
  }).sort((a, b) => {
    // Custom sort: operation-center first, dashboard second, then alphabetical
    if (a.id === 'operation-center') return -1;
    if (b.id === 'operation-center') return 1;
    if (a.id === 'dashboard') return -1;
    if (b.id === 'dashboard') return 1;
    return a.label.localeCompare(b.label);
  });

  return (
    <motion.div 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 w-full h-20 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-slate-100 dark:border-zinc-800 flex items-center justify-around px-4 pb-safe z-[45] shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] transition-colors"
    >
      {filteredTabs.slice(0, 4).map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;
        return (
          <button
            key={tab.id + (tab.metadata?.tab || '')}
            onClick={() => {
                onChangeView(tab.id as any);
                if (tab.metadata) {
                    window.dispatchEvent(new CustomEvent('change-tab', { detail: tab.metadata.tab }));
                }
            }}
            className={`relative flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-yellow-600' : 'text-slate-400 active:scale-90'}`}
          >
            {isActive && (
              <motion.div 
                layoutId="nav-active"
                className="absolute -top-3 w-8 h-1 bg-yellow-400 rounded-full"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-yellow-50 dark:bg-yellow-900/10 scale-110' : 'bg-transparent'}`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        );
      })}
      
      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center gap-1 text-slate-400 active:scale-90 transition-all"
      >
        <div className="p-2 rounded-xl bg-transparent">
            <Menu size={22} />
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest">Mais</span>
      </button>
    </motion.div>
  );
};

export default MobileBottomNav;
