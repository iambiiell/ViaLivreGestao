
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
  
  const isAdmin = currentUser?.role === 'ADMIN' || (currentUser?.job_title || '').toUpperCase().includes('ADMINISTRADOR') || (currentUser?.job_title || '').toUpperCase().includes('ADMIN') || currentUser?.is_full_admin;
  const isFiscal = (currentUser?.role || '').toUpperCase() === 'FISCAL' || (currentUser?.job_title || '').toUpperCase().includes('FISCAL');
  
  const userBaseRole = useMemo(() => {
    const role = (currentUser?.role || '').toUpperCase();
    const title = (currentUser?.job_title || '').toUpperCase();

    if (isFiscal) return 'FISCAL';
    if (title.includes('RODOVIÁRIO') || title.includes('RODOVIARIO') || role.includes('RODOVIARIO')) return 'RODOVIARIO';
    if (title.includes('COBRADOR') || role.includes('COBRADOR')) return 'COBRADOR';
    if (title.includes('URBANO') || role.includes('URBANO') || role === 'DRIVER') return 'URBANO';
    return 'URBANO';
  }, [currentUser, isFiscal]);

  const isUrbanDriver = useMemo(() => {
    const role = (currentUser?.role || '').toUpperCase();
    const title = (currentUser?.job_title || '').toUpperCase();
    return role === 'DRIVER' || title.includes('MOTORISTA URBANO') || title.includes('URBANO') || role === 'URBANO';
  }, [currentUser]);

  // Dual role check: Se o campo Cobrador não for preenchido na escala ou se o veículo não possuir cobrador,
  // o Motorista Urbano também terá acesso à aba Cobrador na Central de Operações.
  const hasUrbanTripWithoutConductor = useMemo(() => {
    if (!isUrbanDriver && userBaseRole !== 'URBANO') return false;
    const currentId = currentUser?.id;
    const currentName = (currentUser?.full_name || currentUser?.name || '').trim().toLowerCase();

    // 1. Viagens vinculadas ao motorista
    const myTrips = props.trips.filter(t => {
      const matchId = t.driver_id && t.driver_id === currentId;
      const matchName = t.driver_name && currentName && t.driver_name.trim().toLowerCase().includes(currentName);
      return matchId || matchName;
    });

    if (myTrips.length > 0) {
      // Tem viagem onde o cobrador não foi preenchido
      return myTrips.some(t => {
        const hasNoConductor = !t.conductor_id || 
          !t.conductor_name || 
          t.conductor_name === 'Não atribuído' || 
          t.conductor_name === 'Nenhum' || 
          !t.conductor_name.trim();
        return hasNoConductor;
      });
    }

    // Se o motorista urbano não tem viagens com cobrador dedicado fixado, libera acesso à aba Cobrador
    return true;
  }, [isUrbanDriver, userBaseRole, props.trips, currentUser]);

  const availableTabs = useMemo(() => {
    const tabs: Array<{ id: 'URBANO' | 'RODOVIARIO' | 'COBRADOR' | 'OVERVIEW' | 'FISCAL'; label: string; icon: any }> = [];

    // Fiscalização de Pátio e Painel de Supervisão devem aparecer APENAS para o Fiscal e Administrador
    if (isAdmin || isFiscal) {
      tabs.push({ id: 'FISCAL', label: 'Fiscalização de Pátio', icon: ShieldCheck });
      tabs.push({ id: 'OVERVIEW', label: 'Painel de Supervisão', icon: PlayCircle });
    }

    if (isAdmin) {
      tabs.push({ id: 'URBANO', label: 'Motorista Urbano', icon: BusFront });
      tabs.push({ id: 'RODOVIARIO', label: 'Motorista Rodoviário', icon: Ticket });
      tabs.push({ id: 'COBRADOR', label: 'Cobrador', icon: DollarSign });
    } else if (!isFiscal) {
      // Para cargos específicos, mostrar o cargo cadastrado e dual-role
      if (userBaseRole === 'URBANO' || isUrbanDriver) {
        tabs.push({ id: 'URBANO', label: 'Motorista Urbano', icon: BusFront });
        // Se associado a rota sem cobrador ou se cobrador não foi preenchido, a aba de cobrador aparece automaticamente
        if (hasUrbanTripWithoutConductor) {
          tabs.push({ id: 'COBRADOR', label: 'Cobrador', icon: DollarSign });
        }
      } else if (userBaseRole === 'RODOVIARIO') {
        tabs.push({ id: 'RODOVIARIO', label: 'Motorista Rodoviário', icon: Ticket });
      } else if (userBaseRole === 'COBRADOR') {
        tabs.push({ id: 'COBRADOR', label: 'Cobrador', icon: DollarSign });
      }
    }

    return tabs;
  }, [isAdmin, isFiscal, userBaseRole, isUrbanDriver, hasUrbanTripWithoutConductor]);

  const [activeTab, setActiveTab] = useState<'URBANO' | 'RODOVIARIO' | 'COBRADOR' | 'OVERVIEW' | 'FISCAL'>(() => {
    if (props.initialTab && (isAdmin || (isFiscal && (props.initialTab === 'FISCAL' || props.initialTab === 'OVERVIEW')))) {
      return props.initialTab;
    }
    if (isFiscal) return 'FISCAL';
    if (isAdmin) return 'OVERVIEW';
    if (userBaseRole === 'RODOVIARIO') return 'RODOVIARIO';
    if (userBaseRole === 'COBRADOR') return 'COBRADOR';
    return 'URBANO';
  });

  // If activeTab is not in availableTabs, switch to the first available tab
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(t => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs, activeTab]);

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
                  isSupervision={isAdmin || isFiscal}
                />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OperationTabs;
