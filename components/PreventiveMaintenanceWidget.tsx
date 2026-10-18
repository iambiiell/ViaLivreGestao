import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wrench, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Bus, 
  Gauge, 
  Calendar, 
  ArrowRight, 
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { Vehicle, MaintenanceRecord, Trip } from '../types';
import { db } from '../services/database';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { motion } from 'framer-motion';

interface PreventiveMaintenanceWidgetProps {
  vehicles: Vehicle[];
  allTrips?: Trip[];
  systemSettings?: any;
  onNavigateToMaintenance?: () => void;
}

type FilterMode = 'ALL' | 'KM' | 'DATE';

interface VehicleMaintenanceStatus {
  vehicle: Vehicle;
  currentKm: number;
  kmThreshold: number;
  kmRemaining: number;
  kmPercent: number; // 0 to 100+ %
  kmStatus: 'OK' | 'WARNING' | 'EXPIRED';
  
  lastDateStr: string;
  nextDateStr: string;
  daysRemaining: number;
  dateStatus: 'OK' | 'WARNING' | 'EXPIRED';
  
  overallStatus: 'OK' | 'WARNING' | 'EXPIRED';
  criticalReason: string;
}

export const PreventiveMaintenanceWidget: React.FC<PreventiveMaintenanceWidgetProps> = ({
  vehicles = [],
  allTrips = [],
  systemSettings,
  onNavigateToMaintenance
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar histórico de manutenções para cruzar com veículos
  useEffect(() => {
    let isMounted = true;
    const fetchMaintenance = async () => {
      setIsLoading(true);
      try {
        const logs = await db.fetchAll<MaintenanceRecord>('maintenance' as any);
        if (isMounted && Array.isArray(logs)) {
          setMaintenanceLogs(logs);
        }
      } catch (err) {
        console.warn('Erro ao carregar registros de manutenção no widget:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchMaintenance();
    return () => { isMounted = false; };
  }, []);

  // Calcular quilometragem estimada por veículo a partir dos hodômetros de viagens e logs
  const vehicleMileageMap = useMemo(() => {
    const map = new Map<string, number>();
    
    // 1. Base a partir de odômetros das viagens
    allTrips.forEach(trip => {
      const vId = trip.bus_number;
      if (vId) {
        const endOdo = trip.final_odometer || trip.initial_odometer || 0;
        const current = map.get(vId) || 0;
        if (endOdo > current) map.set(vId, endOdo);
      }
    });

    return map;
  }, [allTrips]);

  // Processar o status de preventiva de cada veículo
  const fleetStatusList = useMemo<VehicleMaintenanceStatus[]>(() => {
    const defaultIntervalMonths = 6;
    const defaultKmThreshold = Number(systemSettings?.maintenance_km_threshold) || 10000;
    const today = new Date();

    return vehicles.map(v => {
      // 1. Análise por Quilometragem
      const reportedKm = (v as any).current_km || (v as any).odometer || 0;
      const tripKm = vehicleMileageMap.get(v.prefix) || vehicleMileageMap.get(v.id) || 0;
      const currentKm = Math.max(reportedKm, tripKm, (v.current_turnstile_count || 0) * 1.5 || 0);

      // Logs de preventiva deste veículo
      const vLogs = maintenanceLogs.filter(l => l.vehicle_id === v.id && l.service_type === 'PREVENTIVA');
      const sortedLogs = [...vLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastPreventive = sortedLogs[0];

      const kmThreshold = defaultKmThreshold;
      // Quilometragem percorrida desde a última manutenção preventiva
      const kmSinceLast = lastPreventive 
        ? Math.max(0, currentKm % kmThreshold) 
        : currentKm;
      
      const kmRemaining = Math.max(0, kmThreshold - kmSinceLast);
      const kmPercent = Math.min(150, Math.round((kmSinceLast / kmThreshold) * 100));

      let kmStatus: 'OK' | 'WARNING' | 'EXPIRED' = 'OK';
      if (kmRemaining === 0 || kmPercent >= 100) {
        kmStatus = 'EXPIRED';
      } else if (kmRemaining <= 1500 || kmPercent >= 85) {
        kmStatus = 'WARNING';
      }

      // 2. Análise por Data
      const intervalMonths = systemSettings?.maintenance_intervals?.[v.vehicle_type] || defaultIntervalMonths;
      let lastDate: Date;
      let lastDateStr = 'Sem registro';

      if (lastPreventive && lastPreventive.date) {
        lastDate = new Date(lastPreventive.date);
        lastDateStr = new Date(lastPreventive.date).toLocaleDateString('pt-BR');
      } else if (v.last_inspection) {
        lastDate = new Date(v.last_inspection);
        lastDateStr = new Date(v.last_inspection).toLocaleDateString('pt-BR');
      } else {
        // Se nunca realizou, data de 6 meses atrás (considerado vencido)
        lastDate = new Date(today);
        lastDate.setMonth(lastDate.getMonth() - intervalMonths - 1);
        lastDateStr = 'Nunca realizada';
      }

      const nextDate = new Date(lastDate);
      nextDate.setMonth(nextDate.getMonth() + intervalMonths);
      const nextDateStr = nextDate.toLocaleDateString('pt-BR');

      const diffTime = nextDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let dateStatus: 'OK' | 'WARNING' | 'EXPIRED' = 'OK';
      if (daysRemaining < 0) {
        dateStatus = 'EXPIRED';
      } else if (daysRemaining <= 15) {
        dateStatus = 'WARNING';
      }

      // 3. Status Geral baseado no filtro ou combinado
      let overallStatus: 'OK' | 'WARNING' | 'EXPIRED' = 'OK';
      let criticalReason = '';

      if (filterMode === 'KM') {
        overallStatus = kmStatus;
        criticalReason = kmStatus === 'EXPIRED' 
          ? `Limite de ${kmThreshold.toLocaleString('pt-BR')} km excedido` 
          : kmStatus === 'WARNING' 
            ? `Restam apenas ${kmRemaining.toLocaleString('pt-BR')} km` 
            : 'Quilometragem dentro do limite';
      } else if (filterMode === 'DATE') {
        overallStatus = dateStatus;
        criticalReason = dateStatus === 'EXPIRED' 
          ? `Vencido há ${Math.abs(daysRemaining)} dias` 
          : dateStatus === 'WARNING' 
            ? `Vence em ${daysRemaining} dias (${nextDateStr})` 
            : 'Prazo em dia';
      } else {
        // Modo Combinado
        if (kmStatus === 'EXPIRED' || dateStatus === 'EXPIRED') {
          overallStatus = 'EXPIRED';
          criticalReason = kmStatus === 'EXPIRED' && dateStatus === 'EXPIRED'
            ? `Vencido por KM (${kmPercent}%) e Data (${nextDateStr})`
            : kmStatus === 'EXPIRED'
              ? `Limite de ${kmThreshold.toLocaleString('pt-BR')} km atingido`
              : `Prazo vencido há ${Math.abs(daysRemaining)} dias`;
        } else if (kmStatus === 'WARNING' || dateStatus === 'WARNING') {
          overallStatus = 'WARNING';
          criticalReason = kmStatus === 'WARNING'
            ? `Restam ${kmRemaining.toLocaleString('pt-BR')} km`
            : `Vence em ${daysRemaining} dias (${nextDateStr})`;
        } else {
          overallStatus = 'OK';
          criticalReason = 'Manutenção preventiva em dia';
        }
      }

      return {
        vehicle: v,
        currentKm,
        kmThreshold,
        kmRemaining,
        kmPercent,
        kmStatus,
        lastDateStr,
        nextDateStr,
        daysRemaining,
        dateStatus,
        overallStatus,
        criticalReason
      };
    });
  }, [vehicles, maintenanceLogs, vehicleMileageMap, systemSettings, filterMode]);

  // Contagens para os cards e gráfico geral de status da frota
  const statusSummary = useMemo(() => {
    const total = fleetStatusList.length;
    const ok = fleetStatusList.filter(f => f.overallStatus === 'OK').length;
    const warning = fleetStatusList.filter(f => f.overallStatus === 'WARNING').length;
    const expired = fleetStatusList.filter(f => f.overallStatus === 'EXPIRED').length;

    const okPercent = total > 0 ? Math.round((ok / total) * 100) : 0;
    const warningPercent = total > 0 ? Math.round((warning / total) * 100) : 0;
    const expiredPercent = total > 0 ? Math.round((expired / total) * 100) : 0;

    return { total, ok, warning, expired, okPercent, warningPercent, expiredPercent };
  }, [fleetStatusList]);

  // Dados para o Gráfico de Barras: Distribuição Geral da Frota
  const statusDistributionData = useMemo(() => [
    {
      category: 'Em Dia',
      count: statusSummary.ok,
      percent: statusSummary.okPercent,
      fill: '#10B981', // Verde esmeralda
      description: 'Prazos e KM dentro da margem segura'
    },
    {
      category: 'Próxima do Vencimento',
      count: statusSummary.warning,
      percent: statusSummary.warningPercent,
      fill: '#EAB308', // Amarelo alerta
      description: 'Menos de 15 dias ou 1.500 km restantes'
    },
    {
      category: 'Vencida / Atrasada',
      count: statusSummary.expired,
      percent: statusSummary.expiredPercent,
      fill: '#EF4444', // Vermelho crítico
      description: 'Prazo ou KM excedidos, revisão imediata'
    }
  ], [statusSummary]);

  // Top veículos mais críticos para o Gráfico de Barras Horizontal
  const criticalVehiclesData = useMemo(() => {
    // Ordenar: primeiro expirados, depois warning, depois ok
    const sorted = [...fleetStatusList].sort((a, b) => {
      const score = (item: VehicleMaintenanceStatus) => {
        if (item.overallStatus === 'EXPIRED') return 3000 + (100 - item.daysRemaining) + item.kmPercent;
        if (item.overallStatus === 'WARNING') return 2000 + (15 - item.daysRemaining) + item.kmPercent;
        return item.kmPercent;
      };
      return score(b) - score(a);
    });

    return sorted.slice(0, 6).map(item => ({
      prefix: `#${item.vehicle.prefix}`,
      model: item.vehicle.model || 'Ônibus',
      plate: item.vehicle.plate || '',
      percent: Math.min(100, item.kmPercent),
      daysLeft: item.daysRemaining,
      kmRemaining: item.kmRemaining,
      status: item.overallStatus,
      criticalReason: item.criticalReason,
      fill: item.overallStatus === 'EXPIRED' ? '#EF4444' : item.overallStatus === 'WARNING' ? '#EAB308' : '#10B981'
    }));
  }, [fleetStatusList]);

  // Veículos que exigem atenção imediata (lista rápida)
  const urgentVehicles = useMemo(() => {
    return fleetStatusList
      .filter(f => f.overallStatus === 'EXPIRED' || f.overallStatus === 'WARNING')
      .slice(0, 4);
  }, [fleetStatusList]);

  const handleGoToMaintenance = () => {
    if (onNavigateToMaintenance) {
      onNavigateToMaintenance();
    } else {
      window.dispatchEvent(new CustomEvent('change-view', { detail: 'maintenance' }));
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 dark:border-zinc-800 shadow-sm space-y-6">
      {/* Cabeçalho do Widget */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-yellow-400 text-slate-900 flex items-center justify-center font-black shadow-md border-2 border-slate-900 shrink-0">
            <Wrench size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase italic tracking-tight">
                Manutenção Preventiva da Frota
              </h3>
              {statusSummary.expired > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 animate-pulse">
                  <ShieldAlert size={12} /> {statusSummary.expired} Vencidas
                </span>
              )}
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">
              Controle de vencimentos por quilometragem percorrida e calendário
            </p>
          </div>
        </div>

        {/* Filtros e Ação */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Seletor de Modo */}
          <div className="flex bg-slate-50 dark:bg-zinc-950 p-1 rounded-2xl border border-slate-100 dark:border-zinc-800 text-[9px] font-black uppercase tracking-wider">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-2 rounded-xl transition-all ${
                filterMode === 'ALL'
                  ? 'bg-white text-slate-900 border border-slate-200/90 dark:bg-zinc-800 dark:text-white dark:border-zinc-700 shadow-sm font-black'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              Geral (KM + Data)
            </button>
            <button
              onClick={() => setFilterMode('KM')}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1 ${
                filterMode === 'KM'
                  ? 'bg-yellow-400 text-slate-950 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <Gauge size={12} /> Por KM
            </button>
            <button
              onClick={() => setFilterMode('DATE')}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1 ${
                filterMode === 'DATE'
                  ? 'bg-yellow-400 text-slate-950 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <Calendar size={12} /> Por Data
            </button>
          </div>

          <button
            onClick={handleGoToMaintenance}
            className="px-4 py-2.5 bg-slate-950 dark:bg-zinc-800 hover:bg-slate-900 dark:hover:bg-zinc-700 text-white rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm border border-slate-800 shrink-0"
            title="Ir para o módulo completo de oficina e manutenções"
          >
            Gerenciar Oficina <ChevronRight size={13} className="text-yellow-400" />
          </button>
        </div>
      </div>

      {/* Cards Indicadores de Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Frota */}
        <div className="bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
          <div className="flex items-center justify-between text-slate-400 dark:text-zinc-500 mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest">Frota Monitorada</span>
            <Bus size={15} />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
            {statusSummary.total} <span className="text-xs font-bold text-slate-400">veículos</span>
          </p>
          <span className="text-[9px] font-bold text-slate-400">100% sob monitoramento</span>
        </div>

        {/* Em Dia */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest">Em Dia</span>
            <CheckCircle2 size={15} />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">
            {statusSummary.ok} <span className="text-xs font-bold opacity-80">({statusSummary.okPercent}%)</span>
          </p>
          <span className="text-[9px] font-bold text-emerald-700/80 dark:text-emerald-400/80">Dentro dos prazos</span>
        </div>

        {/* Próximas do Vencimento */}
        <div className="bg-yellow-50/70 dark:bg-yellow-950/20 p-4 rounded-2xl border border-yellow-200 dark:border-yellow-900/30">
          <div className="flex items-center justify-between text-yellow-700 dark:text-yellow-400 mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest">Atenção</span>
            <Clock size={15} />
          </div>
          <p className="text-2xl font-black text-yellow-700 dark:text-yellow-400 leading-tight">
            {statusSummary.warning} <span className="text-xs font-bold opacity-80">({statusSummary.warningPercent}%)</span>
          </p>
          <span className="text-[9px] font-bold text-yellow-800/80 dark:text-yellow-400/80">&lt; 15 dias ou &lt; 1.500 km</span>
        </div>

        {/* Vencidas */}
        <div className="bg-red-50/70 dark:bg-red-950/20 p-4 rounded-2xl border border-red-200 dark:border-red-900/30">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400 mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest">Vencidas</span>
            <AlertTriangle size={15} />
          </div>
          <p className="text-2xl font-black text-red-600 dark:text-red-400 leading-tight">
            {statusSummary.expired} <span className="text-xs font-bold opacity-80">({statusSummary.expiredPercent}%)</span>
          </p>
          <span className="text-[9px] font-bold text-red-700/80 dark:text-red-400/80">Revisão obrigatória</span>
        </div>
      </div>

      {/* Seção Gráfica: 2 Gráficos de Barras lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Gráfico 1: Barras Verticais de Distribuição da Frota */}
        <div className="bg-slate-50/50 dark:bg-zinc-800/30 p-5 rounded-3xl border border-slate-100 dark:border-zinc-800 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                Panorama Geral da Frota
              </p>
              <h4 className="text-xs font-black text-slate-800 dark:text-zinc-100 uppercase italic">
                Distribuição de Status de Manutenção
              </h4>
            </div>
            <span className="text-[9px] font-black uppercase text-slate-400 bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700">
              {statusSummary.total} ônibus
            </span>
          </div>

          <div className="w-full h-56 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-zinc-800" />
                <XAxis 
                  dataKey="category" 
                  fontSize={8} 
                  fontWeight="bold" 
                  stroke="#94A3B8" 
                  tickLine={false} 
                />
                <YAxis 
                  fontSize={8} 
                  fontWeight="bold" 
                  stroke="#94A3B8" 
                  tickLine={false}
                  allowDecimals={false} 
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 text-white p-3 rounded-2xl shadow-xl text-[10px] font-black uppercase backdrop-blur-md border border-slate-800">
                          <p className="text-yellow-400 font-black mb-1">{data.category}</p>
                          <p className="text-white text-xs">{data.count} veículos ({data.percent}% da frota)</p>
                          <p className="text-slate-400 text-[8px] font-bold mt-1">{data.description}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {statusDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Barras Horizontais com Proximidade de Limite dos Veículos */}
        <div className="bg-slate-50/50 dark:bg-zinc-800/30 p-5 rounded-3xl border border-slate-100 dark:border-zinc-800 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                Ciclo Preventivo por Veículo
              </p>
              <h4 className="text-xs font-black text-slate-800 dark:text-zinc-100 uppercase italic">
                Consumo do Limite Preventivo (% KM / Prazo)
              </h4>
            </div>
            <span className="text-[9px] font-black uppercase text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 px-2 py-1 rounded-lg border border-yellow-200 dark:border-yellow-900/40">
              Top Críticos
            </span>
          </div>

          <div className="w-full h-56 min-h-[220px]">
            {criticalVehiclesData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[10px] font-black uppercase text-slate-300">
                Nenhum veículo cadastrado para exibição.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={criticalVehiclesData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" className="dark:stroke-zinc-800" />
                  <XAxis 
                    type="number" 
                    domain={[0, 100]} 
                    fontSize={8} 
                    fontWeight="bold" 
                    stroke="#94A3B8" 
                    tickFormatter={(v) => `${v}%`} 
                  />
                  <YAxis 
                    type="category" 
                    dataKey="prefix" 
                    fontSize={9} 
                    fontWeight="bold" 
                    stroke="#64748B" 
                    tickLine={false} 
                    width={45}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 text-white p-3 rounded-2xl shadow-xl text-[10px] font-black uppercase backdrop-blur-md border border-slate-800">
                            <p className="text-yellow-400 font-black mb-1">{data.prefix} • {data.model}</p>
                            <p className="text-white">Limite Utilizado: {data.percent}%</p>
                            <p className="text-slate-300 text-[9px] mt-0.5">Diagnóstico: {data.criticalReason}</p>
                            <p className="text-emerald-400 text-[8px] mt-0.5">Placa: {data.plate || 'S/N'}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="percent" radius={[0, 6, 6, 0]}>
                    {criticalVehiclesData.map((entry, index) => (
                      <Cell key={`cell-crit-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Alertas Críticos de Veículos */}
      {urgentVehicles.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-amber-500" /> Veículos em Destaque para Manutenção Preventiva
            </span>
            <button
              onClick={handleGoToMaintenance}
              className="text-[9px] font-black uppercase text-yellow-600 dark:text-yellow-400 hover:underline flex items-center gap-1"
            >
              Ver todos os detalhes <ArrowRight size={11} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {urgentVehicles.map(item => (
              <div 
                key={item.vehicle.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  item.overallStatus === 'EXPIRED'
                    ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
                    : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                    item.overallStatus === 'EXPIRED'
                      ? 'bg-red-500 text-white'
                      : 'bg-yellow-400 text-slate-900'
                  }`}>
                    #{item.vehicle.prefix}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 dark:text-zinc-100 uppercase truncate">
                      {item.vehicle.model || 'Ônibus Urbano'} • <span className="text-slate-400">{item.vehicle.plate}</span>
                    </p>
                    <p className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-tight truncate mt-0.5">
                      {item.criticalReason}
                    </p>
                    <div className="flex items-center gap-3 text-[8px] font-black text-slate-400 uppercase mt-1">
                      <span>KM: {item.currentKm.toLocaleString('pt-BR')} km</span>
                      <span>•</span>
                      <span>Próx: {item.nextDateStr}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGoToMaintenance}
                  className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider shrink-0 transition-all ${
                    item.overallStatus === 'EXPIRED'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-yellow-400 hover:bg-yellow-500 text-slate-900'
                  }`}
                >
                  {item.overallStatus === 'EXPIRED' ? 'Revisar Já' : 'Agendar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PreventiveMaintenanceWidget;
