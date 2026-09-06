
import React, { useState, useMemo, useEffect } from 'react';
import { Building2, PlayCircle, Users, DollarSign, Bus, TrendingUp, Clock, Calendar, ArrowRight, Search, X, AlertTriangle, ExternalLink, Download, BarChart3, LayoutDashboard, Sparkles, ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { Trip, BusRoute, Company, IssueReport, City, PassengerDetails, Subscription } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import AnalyticsPanel from './AnalyticsPanel';
import { OperationsSummary } from './OperationsSummary';
import { triggerHaptic } from '../utils/haptic';
import { formatDate, formatDateTime } from '../utils/dateFormatter';

interface DashboardProps {
  allTrips: Trip[];
  routes: BusRoute[];
  companies: Company[];
  cities: City[];
  reports: IssueReport[];
  vehicles?: any[];
  users?: any[];
  subscription?: Subscription | null;
  onForceBackup?: () => void;
  isMobile?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 dark:bg-zinc-900/95 text-white p-4 rounded-2xl border border-slate-800 dark:border-zinc-700 shadow-xl text-[10px] font-black uppercase backdrop-blur-md">
        <p className="text-yellow-400 font-black mb-1">{`Horário: ${label}`}</p>
        {payload.map((item: any, idx: number) => {
          const isRev = item.name === 'Faturamento Líquido';
          const isOcc = item.name === 'Ocupação Média';
          return (
            <p key={idx} style={{ color: item.color }} className="font-bold">
              {item.name}: {isRev ? `R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : isOcc ? `${item.value} pax/viagem` : item.value}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

const WeeklyRevenueTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 dark:bg-zinc-900/95 text-white p-4 rounded-2xl border border-slate-800 dark:border-zinc-700 shadow-xl text-[10px] font-black uppercase backdrop-blur-md">
        <p className="text-yellow-400 font-black mb-1">{`${data.label} • ${data.fullDate}`}</p>
        <p className="text-emerald-400 font-bold text-xs mb-1">
          Faturamento: R$ {data.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-slate-300 font-bold">Viagens: {data.trips}</p>
        <p className="text-slate-400 font-bold">Passageiros: {data.pax.toLocaleString('pt-BR')}</p>
      </div>
    );
  }
  return null;
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string; textColor: string; delay?: number }> = ({ title, value, icon, color, textColor, delay = 0 }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ scale: 1.025, y: -2 }}
    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 flex items-center justify-between group transition-all cursor-default"
  >
    <div className="min-w-0 pr-2">
      <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-1 truncate">{title}</p>
      <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white leading-none tracking-tighter truncate">{value}</h3>
    </div>
    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${color} ${textColor} shadow-lg flex items-center justify-center transition-transform group-hover:rotate-12 border-2 border-slate-900 dark:border-zinc-800 shrink-0`}>
      {icon}
    </div>
  </motion.div>
);

const Dashboard: React.FC<DashboardProps> = ({ allTrips = [], routes = [], companies = [], vehicles = [], users = [], subscription, onForceBackup, isMobile = false }) => {
  const [activeTab, setActiveTab] = useState<'realtime' | 'analytics'>('realtime');
  const [mobileCardIndex, setMobileCardIndex] = useState<number>(0);
  const [filterCompanyId, setFilterCompanyId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [backupStatus, setBackupStatus] = useState<'UP_TO_DATE' | 'DELAYED'>('DELAYED');
  const [lastBackupDate, setLastBackupDate] = useState<string>('Nenhum');

  useEffect(() => {
    const updateBackupStatus = () => {
      const stored = localStorage.getItem('vialivre_last_weekly_backup_timestamp');
      if (stored) {
        const ts = parseInt(stored, 10);
        if (!isNaN(ts)) {
          const diffDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
          setBackupStatus(diffDays <= 7 ? 'UP_TO_DATE' : 'DELAYED');
          setLastBackupDate(formatDate(ts));
          return;
        }
      }
      setBackupStatus('DELAYED');
      setLastBackupDate('Nenhum');
    };

    updateBackupStatus();
    const interval = setInterval(updateBackupStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const daysUntilExpiration = useMemo(() => {
    if (!subscription || subscription.plan_type === 'LIFETIME') return null;
    const now = new Date();
    const expiresAt = new Date(subscription.expires_at);
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [subscription]);

  const summary = useMemo(() => {
    let totalPax = 0; let revenue = 0; let tripCount = 0;
    const today = new Date().toISOString().split('T')[0];
    
    allTrips.filter(t => t.trip_date.split('T')[0] === today && (!filterCompanyId || routes.find(r => r.id === t.route_id)?.company_id === filterCompanyId)).forEach(trip => {
      if (trip.status === 'Concluída' || trip.status === 'Em Rota') {
        tripCount++;
        const route = routes.find(r => r.id === trip.route_id);
        Object.values(trip.passengers || {}).forEach((p: any) => {
          totalPax += (p.pagantes + p.vale_transporte + p.imp_card + p.gratuitos);
          if (route) {
              revenue += (p.pagantes + p.vale_transporte) * route.price;
              revenue += p.imp_card * (route.price * 0.7); 
          }
        });
      }
    });
    return { totalPax, revenue, tripCount };
  }, [allTrips, routes, filterCompanyId]);

  const hourlyData = useMemo(() => {
    const hoursMap: Record<string, { hour: string; passengers: number; revenue: number }> = {};
    
    // Initialize standard operating hours (05:00 to 23:00)
    for (let h = 5; h <= 23; h++) {
      const hStr = h.toString().padStart(2, '0');
      hoursMap[hStr] = {
        hour: `${hStr}:00`,
        passengers: 0,
        revenue: 0
      };
    }

    const today = new Date().toISOString().split('T')[0];
    let filteredTrips = allTrips.filter(t => 
      t.trip_date.split('T')[0] === today && 
      (!filterCompanyId || routes.find(r => r.id === t.route_id)?.company_id === filterCompanyId)
    );

    // Fallback: If today's trips are empty or have zero passenger entries, 
    // fall back to grouping all loaded trips to ensure the chart is populated!
    if (filteredTrips.length === 0 || filteredTrips.every(t => !t.passengers || Object.keys(t.passengers).length === 0)) {
      filteredTrips = allTrips.filter(t => 
        !filterCompanyId || routes.find(r => r.id === t.route_id)?.company_id === filterCompanyId
      );
    }

    filteredTrips.forEach(trip => {
      const hourPart = trip.departure_time ? trip.departure_time.split(':')[0] : '00';
      if (!hoursMap[hourPart]) {
        hoursMap[hourPart] = {
          hour: `${hourPart}:00`,
          passengers: 0,
          revenue: 0
        };
      }

      const route = routes.find(r => r.id === trip.route_id);
      Object.values(trip.passengers || {}).forEach((p: any) => {
        const paxInTrip = (p.pagantes || 0) + (p.vale_transporte || 0) + (p.imp_card || 0) + (p.gratuitos || 0);
        hoursMap[hourPart].passengers += paxInTrip;
        
        if (route) {
          let tripRevenue = ((p.pagantes || 0) + (p.vale_transporte || 0)) * (route.price || 0);
          tripRevenue += (p.imp_card || 0) * ((route.price || 0) * 0.7);
          hoursMap[hourPart].revenue += tripRevenue;
        }
      });
    });

    return Object.keys(hoursMap)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(key => hoursMap[key]);
  }, [allTrips, routes, filterCompanyId]);

  const averageOccupancyData = useMemo(() => {
    const hoursMap: Record<string, { hour: string; totalPassengers: number; tripCount: number }> = {};
    
    // Initialize standard operating hours (05:00 to 23:00)
    for (let h = 5; h <= 23; h++) {
      const hStr = h.toString().padStart(2, '0');
      hoursMap[hStr] = {
        hour: `${hStr}:00`,
        totalPassengers: 0,
        tripCount: 0
      };
    }

    const today = new Date().toISOString().split('T')[0];
    let filteredTrips = allTrips.filter(t => 
      t.trip_date.split('T')[0] === today && 
      (!filterCompanyId || routes.find(r => r.id === t.route_id)?.company_id === filterCompanyId)
    );

    // Fallback: If today's trips are empty or have zero passenger entries, 
    // fall back to grouping all loaded trips to ensure the chart is populated!
    if (filteredTrips.length === 0 || filteredTrips.every(t => !t.passengers || Object.keys(t.passengers).length === 0)) {
      filteredTrips = allTrips.filter(t => 
        !filterCompanyId || routes.find(r => r.id === t.route_id)?.company_id === filterCompanyId
      );
    }

    filteredTrips.forEach(trip => {
      const hourPart = trip.departure_time ? trip.departure_time.split(':')[0] : '00';
      if (!hoursMap[hourPart]) {
        hoursMap[hourPart] = {
          hour: `${hourPart}:00`,
          totalPassengers: 0,
          tripCount: 0
        };
      }

      let paxInTrip = 0;
      Object.values(trip.passengers || {}).forEach((p: any) => {
        paxInTrip += (p.pagantes || 0) + (p.vale_transporte || 0) + (p.imp_card || 0) + (p.gratuitos || 0);
      });

      hoursMap[hourPart].totalPassengers += paxInTrip;
      hoursMap[hourPart].tripCount += 1;
    });

    return Object.keys(hoursMap)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(key => {
        const item = hoursMap[key];
        const avg = item.tripCount > 0 ? parseFloat((item.totalPassengers / item.tripCount).toFixed(1)) : 0;
        return {
          hour: item.hour,
          occupancy: avg,
          tripCount: item.tripCount
        };
      });
  }, [allTrips, routes, filterCompanyId]);

  const weeklyDailyRevenueData = useMemo(() => {
    const days: { dateStr: string; label: string; fullDate: string; revenue: number; trips: number; pax: number }[] = [];
    const today = new Date();

    // Last 7 days continuous timeline
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const dayOfWeek = weekDays[d.getDay()];
      const [year, month, day] = dateStr.split('-');
      const label = i === 0 ? `Hoje (${day}/${month})` : `${dayOfWeek} (${day}/${month})`;
      const fullDate = `${day}/${month}/${year}`;

      days.push({
        dateStr,
        label,
        fullDate,
        revenue: 0,
        trips: 0,
        pax: 0
      });
    }

    allTrips.forEach(trip => {
      if (!trip.trip_date) return;
      const tripDateStr = trip.trip_date.split('T')[0];
      const dayItem = days.find(d => d.dateStr === tripDateStr);
      
      const route = routes.find(r => r.id === trip.route_id);
      if (filterCompanyId && route?.company_id !== filterCompanyId) return;

      let tripRev = 0;
      let tripPax = 0;
      Object.values(trip.passengers || {}).forEach((p: any) => {
        const pax = (p.pagantes || 0) + (p.vale_transporte || 0) + (p.imp_card || 0) + (p.gratuitos || 0);
        tripPax += pax;
        if (route) {
          tripRev += ((p.pagantes || 0) + (p.vale_transporte || 0)) * (route.price || 0);
          tripRev += (p.imp_card || 0) * ((route.price || 0) * 0.7);
        }
      });

      if (dayItem) {
        dayItem.revenue += tripRev;
        dayItem.trips += 1;
        dayItem.pax += tripPax;
      }
    });

    return days;
  }, [allTrips, routes, filterCompanyId]);

  const weeklySummary = useMemo(() => {
    const totalRev = weeklyDailyRevenueData.reduce((acc, d) => acc + d.revenue, 0);
    const totalTrips = weeklyDailyRevenueData.reduce((acc, d) => acc + d.trips, 0);
    const totalPax = weeklyDailyRevenueData.reduce((acc, d) => acc + d.pax, 0);
    const avgDailyRev = totalRev / 7;
    
    // Day over day trend: compare last 2 days
    const todayRev = weeklyDailyRevenueData[6]?.revenue || 0;
    const yesterdayRev = weeklyDailyRevenueData[5]?.revenue || 0;
    let growthRate = 0;
    if (yesterdayRev > 0) {
      growthRate = ((todayRev - yesterdayRev) / yesterdayRev) * 100;
    }

    return { totalRev, totalTrips, totalPax, avgDailyRev, growthRate };
  }, [weeklyDailyRevenueData]);

  // Normalized search query memoized for lightning-fast matching without GC overhead
  const normalizedSearch = useMemo(() => {
    return searchTerm.trim().toLowerCase();
  }, [searchTerm]);

  // Memoized filtered trips list
  const activeTodayTrips = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    if (!allTrips || allTrips.length === 0) return [];

    return allTrips.filter(t => {
      if (!t.trip_date) return false;
      const matchesDate = t.trip_date.split('T')[0] === today;
      if (!matchesDate) return false;

      const r = routes.find(ro => ro.id === t.route_id);
      const matchesCompany = !filterCompanyId || r?.company_id === filterCompanyId;
      if (!matchesCompany) return false;

      if (!normalizedSearch) return true;

      const driverMatch = t.driver_name?.toLowerCase().includes(normalizedSearch);
      const busMatch = t.bus_number?.includes(normalizedSearch);
      const originMatch = r?.origin?.toLowerCase().includes(normalizedSearch);
      const destinationMatch = r?.destination?.toLowerCase().includes(normalizedSearch);
      const lineMatch = r?.prefixo_linha?.toLowerCase().includes(normalizedSearch);
      const statusMatch = t.status?.toLowerCase().includes(normalizedSearch);

      return Boolean(driverMatch || busMatch || originMatch || destinationMatch || lineMatch || statusMatch);
    }).sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || ''));
  }, [allTrips, normalizedSearch, routes, filterCompanyId]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <OperationsSummary trips={allTrips} vehicles={vehicles} users={users} routes={routes} />

      {daysUntilExpiration !== null && daysUntilExpiration <= 7 && daysUntilExpiration > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800/50 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-red-500/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-red-600 uppercase tracking-tight">Atenção! Assinatura Expirando</h4>
              <p className="text-xs font-bold text-red-700/70 dark:text-red-400/70 leading-tight">
                Sua assinatura do <span className="font-black">ViaLivre Gestão</span> expira em {daysUntilExpiration} {daysUntilExpiration === 1 ? 'dia' : 'dias'}. 
                Reative seu plano agora para evitar o bloqueio de acesso para você e sua equipe. Faça backup dos seus dados para segurança.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onForceBackup && (
              <button 
                onClick={onForceBackup}
                className="px-6 py-3 bg-yellow-400 text-slate-900 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-yellow-500 transition-all flex items-center gap-2 shadow-md active:scale-95 shrink-0 border-2 border-slate-900"
              >
                Cópia de Segurança (JSON) <Download size={14} />
              </button>
            )}
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'my-subscription' }))}
              className="px-6 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all flex items-center gap-2 shadow-md active:scale-95 shrink-0"
            >
              Reativar Plano <ExternalLink size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Seletor de Visão do Painel */}
      <div id="tour-dashboard-tabs" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-2 sm:p-3 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('realtime');
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'realtime'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}
          >
            <LayoutDashboard size={16} />
            <span>Visão Operacional</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('analytics');
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'analytics'
                ? 'bg-yellow-400 text-slate-950 shadow-md ring-2 ring-yellow-400/40'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}
          >
            <BarChart3 size={16} />
            <span>Painel de Análises</span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 bg-slate-900 text-yellow-400 text-[8px] font-black rounded-md ml-1">
              30 Dias
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto px-2">
          {isMobile && (
            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase text-yellow-600 dark:text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-lg border border-yellow-400/20">
              <ArrowLeftRight size={10} /> Deslize as abas
            </span>
          )}
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles size={13} className="text-yellow-500" /> Métricas & Indicadores
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'analytics' ? (
          <motion.div
            key="analytics-tab"
            initial={{ opacity: 0, x: 25 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -25 }}
            transition={{ duration: 0.28 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              // Swipe right to go back to realtime with haptic response
              if (info.offset.x > 60 || info.velocity.x > 300) {
                triggerHaptic('swipe');
                setActiveTab('realtime');
              }
            }}
            className="touch-pan-y"
          >
            <AnalyticsPanel 
              allTrips={allTrips} 
              routes={routes} 
              companies={companies} 
              isMobile={isMobile}
            />
          </motion.div>
        ) : (
          <motion.div
            key="realtime-tab"
            initial={{ opacity: 0, x: -25 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 25 }}
            transition={{ duration: 0.28 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              // Swipe left to go to analytics with haptic response
              if (info.offset.x < -60 || info.velocity.x < -300) {
                triggerHaptic('swipe');
                setActiveTab('analytics');
              }
            }}
            className="space-y-8 touch-pan-y"
          >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase italic leading-none">Visão Operacional</h2>
              <p className="text-[10px] text-yellow-600 font-black uppercase tracking-[0.3em] mt-2 border-l-2 border-yellow-400 pl-3">Dashboard em Tempo Real • {formatDate(new Date())}</p>
          </div>
          <div className="flex flex-row items-center gap-3">
              {/* Status de Backup em Tempo Real */}
              <div 
                className={`px-4 py-3 rounded-2xl border flex items-center gap-2.5 h-12 shadow-sm font-black text-[9px] uppercase tracking-widest transition-all ${
                  backupStatus === 'UP_TO_DATE' 
                    ? 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-red-50 dark:bg-red-950/25 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                }`}
                title={backupStatus === 'UP_TO_DATE' ? `Backup realizado em: ${lastBackupDate}` : 'Nenhum backup recente registrado nos últimos 7 dias'}
              >
                <div className="relative flex items-center justify-center w-2 h-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${backupStatus === 'UP_TO_DATE' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${backupStatus === 'UP_TO_DATE' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                </div>
                <span>Backup {backupStatus === 'UP_TO_DATE' ? 'Em dia' : 'Atrasado'}</span>
              </div>

              {onForceBackup && (
                <button 
                  onClick={onForceBackup}
                  className="px-4 py-3 bg-slate-950 dark:bg-zinc-800 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest hover:bg-black dark:hover:bg-zinc-700 transition-all flex items-center gap-2 shadow-md border-2 border-slate-800 h-12"
                  title="Exportar todos os dados do banco para um arquivo JSON local"
                >
                  Backup de Segurança <Download size={12} className="text-yellow-400" />
                </button>
              )}
              <div className="bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-slate-100 dark:border-zinc-800 flex items-center gap-2 h-12 shadow-sm">
                  <Building2 size={16} className="text-yellow-600 ml-2" />
                  <select className="bg-transparent text-[10px] font-black uppercase outline-none dark:text-zinc-300 pr-2" value={filterCompanyId} onChange={e => setFilterCompanyId(e.target.value)}>
                    <option value="">Todo o Grupo</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
              </div>
          </div>
      </div>

      {/* Summary Cards: Swipeable Carousel on Mobile, Grid on Tablet/Desktop */}
      <div className="block md:hidden">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            Resumo Operacional ({mobileCardIndex + 1}/3)
          </span>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((idx) => (
              <button
                key={idx}
                onClick={() => setMobileCardIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  mobileCardIndex === idx 
                    ? 'w-6 bg-yellow-400' 
                    : 'w-2 bg-slate-200 dark:bg-zinc-700'
                }`}
                aria-label={`Ir para o cartão ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2.5rem]">
          <motion.div
            key={mobileCardIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={(_, info) => {
              if (info.offset.x < -40 || info.velocity.x < -200) {
                triggerHaptic('card_snap');
                setMobileCardIndex((prev) => (prev < 2 ? prev + 1 : 0));
              } else if (info.offset.x > 40 || info.velocity.x > 200) {
                triggerHaptic('card_snap');
                setMobileCardIndex((prev) => (prev > 0 ? prev - 1 : 2));
              }
            }}
            className="touch-pan-y cursor-grab active:cursor-grabbing"
          >
            {mobileCardIndex === 0 && (
              <StatCard title="Operação do Dia" value={summary.tripCount.toString()} icon={<PlayCircle size={24} />} color="bg-slate-900" textColor="text-white" delay={0} />
            )}
            {mobileCardIndex === 1 && (
              <StatCard title="Pax Projetado" value={summary.totalPax.toLocaleString()} icon={<Users size={24} />} color="bg-yellow-400" textColor="text-slate-900" delay={0} />
            )}
            {mobileCardIndex === 2 && (
              <StatCard title="Receita Líquida Estimada" value={summary.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<DollarSign size={24} />} color="bg-emerald-500" textColor="text-white" delay={0} />
            )}
          </motion.div>
        </div>

        <div className="flex justify-between items-center mt-2 px-2 text-[9px] font-bold text-slate-400 uppercase">
          <button 
            onClick={() => {
              triggerHaptic('light');
              setMobileCardIndex((prev) => (prev > 0 ? prev - 1 : 2));
            }}
            className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-200 py-1"
          >
            <ChevronLeft size={12} /> Anterior
          </button>
          <span className="text-[8px] tracking-wider text-slate-400/80">Deslize para ver mais</span>
          <button 
            onClick={() => {
              triggerHaptic('light');
              setMobileCardIndex((prev) => (prev < 2 ? prev + 1 : 0));
            }}
            className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-200 py-1"
          >
            Próximo <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Desktop / Tablet Grid View */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <StatCard title="Operação do Dia" value={summary.tripCount.toString()} icon={<PlayCircle size={24} />} color="bg-slate-900" textColor="text-white" delay={0.1} />
        </div>
        <div>
          <StatCard title="Pax Projetado" value={summary.totalPax.toLocaleString()} icon={<Users size={24} />} color="bg-yellow-400" textColor="text-slate-900" delay={0.2} />
        </div>
        <div>
          <StatCard title="Receita Líquida Estimada" value={summary.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<DollarSign size={24} />} color="bg-emerald-500" textColor="text-white" delay={0.3} />
        </div>
      </div>

      {/* Painel Gráfico de Demanda e Receita */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {/* Gráfico 1: Passageiros por Hora (Ocupação) */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">Ocupação Horária</p>
              <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase italic">Passageiros por Horário (Pax/Hora)</h4>
            </div>
            <span className="p-3 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 rounded-2xl border border-yellow-250 dark:border-yellow-900/30">
              <Users size={20} />
            </span>
          </div>
          
          <div className="w-full h-64 min-w-0 min-h-[260px] flex-1">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPax" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#EAB308" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-zinc-800/50" />
                <XAxis dataKey="hour" fontSize={8} fontWeight="bold" stroke="#94A3B8" />
                <YAxis fontSize={8} fontWeight="bold" stroke="#94A3B8" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="passengers" name="Passageiros Transportados" stroke="#EAB308" strokeWidth={3} fillOpacity={1} fill="url(#colorPax)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Receita Distribuída por Horário */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">Receita Distribuída</p>
              <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase italic">Receita por Horário de Partida (R$/Hora)</h4>
            </div>
            <span className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-2xl border border-emerald-200 dark:border-emerald-900/30">
              <DollarSign size={20} />
            </span>
          </div>

          <div className="w-full h-64 min-w-0 min-h-[260px] flex-1">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-zinc-800/50" />
                <XAxis dataKey="hour" fontSize={8} fontWeight="bold" stroke="#94A3B8" />
                <YAxis fontSize={8} fontWeight="bold" stroke="#94A3B8" tickFormatter={(v) => `R$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="Faturamento Líquido" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Ocupação Média por Horário */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col h-[400px] lg:col-span-2 xl:col-span-1">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">Média por Horário</p>
              <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase italic">Ocupação Média da Frota (Pax/Partida)</h4>
            </div>
            <span className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 rounded-2xl border border-indigo-200 dark:border-indigo-900/30">
              <TrendingUp size={20} />
            </span>
          </div>

          <div className="w-full h-64 min-w-0 min-h-[260px] flex-1">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={averageOccupancyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-zinc-800/50" />
                <XAxis dataKey="hour" fontSize={8} fontWeight="bold" stroke="#94A3B8" />
                <YAxis fontSize={8} fontWeight="bold" stroke="#94A3B8" />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="occupancy" name="Ocupação Média" stroke="#6366F1" strokeWidth={3} dot={{ stroke: '#6366F1', strokeWidth: 2, r: 3 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Gráfico de Linhas: Variação do Faturamento Diário ao Longo da Última Semana */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                <DollarSign size={18} />
              </span>
              <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">
                  Evolução Semanal de Receita
                </p>
                <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-zinc-100 uppercase italic">
                  Variação do Faturamento Diário (Última Semana)
                </h3>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <motion.div 
              whileHover={{ scale: 1.04, y: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="px-4 py-2 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-800 cursor-default"
            >
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Total Acumulado 7 Dias</p>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {weeklySummary.totalRev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.04, y: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="px-4 py-2 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-800 cursor-default"
            >
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Média Diária</p>
              <p className="text-sm font-black text-slate-800 dark:text-zinc-100">
                {weeklySummary.avgDailyRev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.04, y: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="px-4 py-2 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-800 cursor-default"
            >
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Viagens Realizadas</p>
              <p className="text-sm font-black text-yellow-600">
                {weeklySummary.totalTrips} viagens
              </p>
            </motion.div>
          </div>
        </div>

        <div className="w-full h-72 min-w-0 min-h-[280px] pt-2">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={weeklyDailyRevenueData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-zinc-800/50" />
              <XAxis 
                dataKey="label" 
                fontSize={9} 
                fontWeight="bold" 
                stroke="#94A3B8" 
                tickLine={false}
              />
              <YAxis 
                fontSize={9} 
                fontWeight="bold" 
                stroke="#94A3B8" 
                tickLine={false}
                tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} 
              />
              <Tooltip content={<WeeklyRevenueTooltip />} />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                name="Faturamento Diário" 
                stroke="#10B981" 
                strokeWidth={3.5} 
                dot={{ fill: '#10B981', stroke: '#065F46', strokeWidth: 2, r: 4 }} 
                activeDot={{ r: 7, fill: '#34D399' }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-sm">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 flex items-center gap-2"><Bus size={18} className="text-yellow-600"/> Monitoramento Diário</h3>
            <motion.div 
              layout
              animate={{ 
                maxWidth: isSearchFocused ? '24rem' : '16rem',
                scale: isSearchFocused ? 1.02 : 1
              }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="flex-1 w-full relative"
            >
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isSearchFocused ? 'text-yellow-500' : 'text-slate-400'}`} size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar viagem..." 
                    className={`w-full pl-10 pr-8 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 text-[9px] font-black uppercase outline-none shadow-inner dark:text-zinc-200 transition-all border-2 ${
                      isSearchFocused 
                        ? 'border-yellow-400 ring-2 ring-yellow-400/20 bg-white dark:bg-zinc-950 shadow-md' 
                        : 'border-transparent'
                    }`}
                    value={searchTerm}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-full"
                    title="Limpar busca"
                  >
                    <X size={12} />
                  </button>
                )}
            </motion.div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 px-3 py-1 rounded-full text-[8px] font-black uppercase text-slate-400 shrink-0">
                <Clock size={12}/> AGORA: {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
         </div>
         <div className="space-y-4">
             {activeTodayTrips.length === 0 ? (
                 <div className="py-12 text-center text-[10px] font-black text-slate-300 uppercase italic tracking-widest">Nenhuma programação localizada.</div>
             ) : (
                activeTodayTrips.map(trip => {
                    const r = routes.find(ro => ro.id === trip.route_id);
                    return (
                        <div key={trip.id} className={`flex flex-col md:flex-row md:items-center justify-between p-6 rounded-3xl border transition-all ${trip.status === 'Em Rota' ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/30 shadow-md' : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-800'}`}>
                            <div className="flex items-center gap-4">
                                <span className="bg-slate-900 text-yellow-400 font-mono font-black px-4 py-2 rounded-2xl text-lg border-2 border-slate-800">{trip.departure_time}</span>
                                <div>
                                    <p className="text-xs font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none mb-1">{r?.origin} <ArrowRight size={12} className="inline"/> {r?.destination}</p>
                                    <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase">Veículo #{trip.bus_number} • {trip.driver_name}</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-center">
                                {trip.status === 'Em Rota' && (
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Rec. Acumulada</p>
                                        <p className="text-sm font-black text-emerald-600">R$ {(Object.values(trip.passengers || {}).reduce((acc: number, p: any) => acc + (p.pagantes + p.vale_transporte + (p.imp_card*0.7)) * (r?.price||0), 0) as number).toFixed(2)}</p>
                                    </div>
                                )}
                                <span className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase ${trip.status === 'Em Rota' ? 'bg-yellow-400 text-slate-900 animate-pulse' : trip.status === 'Concluída' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 dark:bg-zinc-700 text-slate-500'}`}>{trip.status}</span>
                            </div>
                        </div>
                    )
                })
             )}
         </div>
      </div>

      {/* Painel de Análises Integrado na Visão Geral */}
      <div className="pt-4 border-t border-slate-200/60 dark:border-zinc-800">
        <AnalyticsPanel 
          allTrips={allTrips} 
          routes={routes} 
          companies={companies} 
          isMobile={isMobile}
        />
      </div>
      </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
