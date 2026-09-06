
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BusFront, Ticket, DollarSign, Activity, PlayCircle, ShieldCheck } from 'lucide-react';
import { Trip, BusRoute, Vehicle, Company, User } from '../types';
import DriverView from './DriverView';
import FiscalPatioView from './FiscalPatioView';

interface OperationTabsProps {
  trips: Trip[];
  routes: BusRoute[];
  vehicles: Vehicle[];
  companies: Company[];
  currentUser: User | null;
  onUpdateTrip: (trip: Trip) => void;
  addToast: (message: string, type?: 'success' | 'white' | 'error') => void;
  initialTab?: 'URBANO' | 'RODOVIARIO' | 'COBRADOR' | 'OVERVIEW' | 'FISCAL';
}

const OperationTabs: React.FC<OperationTabsProps> = (props) => {
  const { currentUser } = props;
  
  const isAdmin = currentUser?.role === 'ADMIN' || (currentUser?.job_title || '').toUpperCase().includes('ADMINISTRADOR') || currentUser?.is_full_admin;
  const isFiscal = (currentUser?.role || '').toUpperCase() === 'FISCAL' || (currentUser?.job_title || '').toUpperCase().includes('FISCAL');
  const isDespachante = (currentUser?.role || '').toUpperCase() === 'DESPACHANTE' || (currentUser?.job_title || '').toUpperCase().includes('DESPACHANTE');
  
  const userBaseRole = useMemo(() => {
    const role = (currentUser?.role || '').toUpperCase();
    const title = (currentUser?.job_title || '').toUpperCase();

    if (isFiscal) return 'FISCAL';
    if (title.includes('RODOVIÁRIO') || title.includes('RODOVIARIO')) return 'RODOVIARIO';
    if (title.includes('COBRADOR')) return 'COBRADOR';
    if (title.includes('URBANO')) return 'URBANO';
    
    if (role.includes('RODOVIARIO')) return 'RODOVIARIO';
    if (role.includes('COBRADOR')) return 'COBRADOR';
    if (role.includes('URBANO')) return 'URBANO';

    return 'URBANO';
  }, [currentUser, isFiscal]);

  const [activeTab, setActiveTab] = useState<'URBANO' | 'RODOVIARIO' | 'COBRADOR' | 'OVERVIEW' | 'FISCAL'>(
    props.initialTab || (isFiscal ? 'FISCAL' : ((isAdmin || isDespachante) ? 'OVERVIEW' : (userBaseRole as any)))
  );

  const availableTabs = useMemo(() => {
    const tabs = [];
    const hasMonitoringPermission = currentUser?.permissions?.includes('monitoring');
    const isSupervisor = isAdmin || isFiscal || isDespachante || hasMonitoringPermission;

    if (isFiscal || isSupervisor) {
      tabs.push({ id: 'FISCAL', label: 'Fiscalização de Pátio', icon: ShieldCheck });
    }
    if (isSupervisor && !isFiscal) {
      tabs.push({ id: 'OVERVIEW', label: 'Monitoramento', icon: PlayCircle });
    }
    if (isSupervisor || userBaseRole === 'URBANO') {
      tabs.push({ id: 'URBANO', label: 'Motorista Urbano', icon: BusFront });
    }
    if (isSupervisor || userBaseRole === 'RODOVIARIO') {
      tabs.push({ id: 'RODOVIARIO', label: 'Motorista Rodoviário', icon: Ticket });
    }
    if (isSupervisor || userBaseRole === 'COBRADOR') {
      tabs.push({ id: 'COBRADOR', label: 'Cobrador', icon: DollarSign });
    }
    return tabs.sort((a, b) => {
      if (a.id === 'FISCAL') return -1;
      if (b.id === 'FISCAL') return 1;
      return a.label.localeCompare(b.label);
    });
  }, [currentUser, userBaseRole, isAdmin, isFiscal, isDespachante]);

  // If user role changed and current tab is not available, switch
  useEffect(() => {
    if (!availableTabs.find(t => t.id === activeTab)) {
      setActiveTab(availableTabs[0]?.id as any || (isFiscal ? 'FISCAL' : 'URBANO'));
    }
  }, [availableTabs, activeTab, isFiscal]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
            <Activity className="text-yellow-400" size={32} />
            Central de Operações
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">
            {isFiscal ? 'Módulo de Fiscalização de Linhas, Frota e Arrecadação' : 'Módulo de Gestão Operacional em Tempo Real'}
          </p>
        </div>
        
        <div className="flex bg-white dark:bg-zinc-900 p-2 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm self-start relative flex-wrap gap-1">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative flex items-center gap-2 px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
                activeTab === tab.id 
                  ? 'text-white z-10' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabBg"
                  className="absolute inset-0 bg-slate-900 dark:bg-yellow-400 rounded-2xl shadow-lg -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <tab.icon size={14} className={activeTab === tab.id ? "text-yellow-400 dark:text-slate-900" : ""} />
              <span className={activeTab === tab.id ? "dark:text-slate-900" : ""}>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-zinc-950 p-1 md:p-6 rounded-[3rem] border-4 border-slate-100 dark:border-zinc-900 min-h-[600px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'FISCAL' ? (
              <FiscalPatioView 
                {...props}
              />
            ) : activeTab === 'OVERVIEW' ? (
              <div className="space-y-6">
                 <div className="bg-yellow-400 p-8 rounded-[3rem] border-4 border-slate-900 shadow-2xl relative overflow-hidden">
                    <div className="relative z-10 text-slate-900">
                        <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none mb-2">Painel de Supervisão</h2>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Monitoramento Geral de Atividades</p>
                    </div>
                    <PlayCircle size={150} className="absolute -right-8 -bottom-8 text-slate-900/10 rotate-12" />
                </div>
                <DriverView 
                  {...props} 
                  forcedRole={undefined}
                  isSupervision={true}
                />
              </div>
            ) : (
                <DriverView 
                  {...props} 
                  forcedRole={activeTab as any} 
                  isSupervision={isAdmin || isFiscal || isDespachante}
                />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OperationTabs;
