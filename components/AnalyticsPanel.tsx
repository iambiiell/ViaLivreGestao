import React, { useState, useMemo, useRef } from 'react';
import { Trip, BusRoute, Company } from '../types';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Route as RouteIcon, 
  Calendar, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Bus, 
  Award,
  Sparkles,
  Layers,
  Download,
  Loader2,
  FileText
} from 'lucide-react';
import { motion } from 'framer-motion';
import { exportElementToPDF } from '../utils/pdfExport';

interface AnalyticsPanelProps {
  allTrips: Trip[];
  routes: BusRoute[];
  companies: Company[];
  isMobile?: boolean;
}

const Custom30DaysTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
      <div className="bg-slate-950/95 dark:bg-zinc-900/95 text-white p-4 rounded-2xl border border-slate-800 dark:border-zinc-700 shadow-2xl text-[10px] font-bold uppercase backdrop-blur-md min-w-[200px]">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
          <span className="text-yellow-400 font-black tracking-wider flex items-center gap-1.5">
            <Calendar size={12} /> {data.fullDate}
          </span>
          <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
            {data.dayOfWeek}
          </span>
        </div>
        <div className="space-y-1.5 font-medium">
          <div className="flex justify-between items-center text-yellow-400 font-black text-xs">
            <span>Total Pax:</span>
            <span>{data.totalPax.toLocaleString('pt-BR')} pax</span>
          </div>
          <div className="flex justify-between items-center text-emerald-400 font-bold">
            <span>Receita:</span>
            <span>R$ {data.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="h-px bg-slate-800 my-1"></div>
          <div className="flex justify-between items-center text-slate-300 text-[9px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> Pagantes:</span>
            <span>{data.pagantes.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300 text-[9px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Vale Transporte:</span>
            <span>{data.valeTransporte.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300 text-[9px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400"></span> Cartão / Impresso:</span>
            <span>{data.impCard.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400 text-[9px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500"></span> Gratuidades:</span>
            <span>{data.gratuitos.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400 text-[9px] pt-1">
            <span>Viagens no dia:</span>
            <span className="font-mono">{data.tripsCount}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const CustomRouteTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
      <div className="bg-slate-950/95 dark:bg-zinc-900/95 text-white p-4 rounded-2xl border border-slate-800 dark:border-zinc-700 shadow-2xl text-[10px] font-bold uppercase backdrop-blur-md min-w-[210px]">
        <p className="text-yellow-400 font-black text-xs mb-1 flex items-center gap-1.5">
          <Bus size={13} /> {data.routePrefix} - {data.routeName}
        </p>
        <p className="text-slate-400 text-[9px] mb-2">{data.companyName}</p>
        <div className="space-y-1 font-medium border-t border-slate-800 pt-2">
          <div className="flex justify-between text-yellow-400">
            <span>Passageiros:</span>
            <span className="font-mono font-bold">{data.totalPax.toLocaleString('pt-BR')} pax</span>
          </div>
          <div className="flex justify-between text-emerald-400">
            <span>Faturamento:</span>
            <span className="font-mono font-bold">R$ {data.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-blue-300">
            <span>Ocupação Média:</span>
            <span className="font-mono font-bold">{data.avgOccupancy} pax/partida</span>
          </div>
          <div className="flex justify-between text-slate-400 text-[9px]">
            <span>Viagens Realizadas:</span>
            <span className="font-mono">{data.tripsCount}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  allTrips = [],
  routes = [],
  companies = [],
  isMobile = false
}) => {
  const [filterCompanyId, setFilterCompanyId] = useState<string>('');
  const [daysRange, setDaysRange] = useState<number>(30); // 7, 15 ou 30 dias
  const [routeMetric, setRouteMetric] = useState<'pax' | 'revenue' | 'occupancy'>('pax');
  const [chartViewMode, setChartViewMode] = useState<'total' | 'detailed'>('total');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!panelRef.current) return;
    setIsGeneratingPDF(true);
    try {
      await exportElementToPDF(panelRef.current, {
        fileName: `analise_desempenho_${daysRange}d_${new Date().toISOString().split('T')[0]}.pdf`,
        title: `ViaLivre • Análise de Desempenho (${daysRange} Dias)`,
      });
    } catch (e) {
      console.error('Erro ao exportar PDF de análises:', e);
      alert('Erro ao gerar relatório em PDF das análises.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // 1. Dados dos últimos 30 dias de passageiros
  const thirtyDaysData = useMemo(() => {
    const dataPoints: {
      dateStr: string;
      label: string;
      fullDate: string;
      dayOfWeek: string;
      totalPax: number;
      pagantes: number;
      valeTransporte: number;
      impCard: number;
      gratuitos: number;
      revenue: number;
      tripsCount: number;
    }[] = [];

    const today = new Date();
    const weekDaysShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // Gera lista para os últimos X dias
    for (let i = daysRange - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const [year, month, day] = dateStr.split('-');
      const dayOfWeek = weekDaysShort[d.getDay()];
      
      const label = i === 0 ? 'Hoje' : `${day}/${month}`;
      const fullDate = `${day}/${month}/${year}`;

      dataPoints.push({
        dateStr,
        label,
        fullDate,
        dayOfWeek,
        totalPax: 0,
        pagantes: 0,
        valeTransporte: 0,
        impCard: 0,
        gratuitos: 0,
        revenue: 0,
        tripsCount: 0
      });
    }

    allTrips.forEach(trip => {
      if (!trip.trip_date) return;
      const tripDateStr = trip.trip_date.split('T')[0];
      const point = dataPoints.find(p => p.dateStr === tripDateStr);
      if (!point) return;

      const route = routes.find(r => r.id === trip.route_id);
      if (filterCompanyId && route?.company_id !== filterCompanyId) return;

      let tripPax = 0;
      let pagantes = 0;
      let valeTransporte = 0;
      let impCard = 0;
      let gratuitos = 0;
      let tripRevenue = 0;

      Object.values(trip.passengers || {}).forEach((p: any) => {
        const pag = Number(p.pagantes) || 0;
        const vt = Number(p.vale_transporte) || 0;
        const ic = Number(p.imp_card) || 0;
        const grat = Number(p.gratuitos) || 0;

        pagantes += pag;
        valeTransporte += vt;
        impCard += ic;
        gratuitos += grat;
        tripPax += (pag + vt + ic + grat);

        if (route) {
          tripRevenue += (pag + vt) * (route.price || 0);
          tripRevenue += ic * ((route.price || 0) * 0.7);
        }
      });

      point.totalPax += tripPax;
      point.pagantes += pagantes;
      point.valeTransporte += valeTransporte;
      point.impCard += impCard;
      point.gratuitos += gratuitos;
      point.revenue += tripRevenue;
      point.tripsCount += 1;
    });

    return dataPoints;
  }, [allTrips, routes, filterCompanyId, daysRange]);

  // 2. Rotas com melhor desempenho
  const routePerformanceData = useMemo(() => {
    const routeStats: Record<string, {
      routeId: string;
      routePrefix: string;
      routeName: string;
      companyName: string;
      totalPax: number;
      revenue: number;
      tripsCount: number;
      avgOccupancy: number;
    }> = {};

    // Considera viagens dentro da faixa de dias selecionada
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysRange);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    allTrips.forEach(trip => {
      if (!trip.trip_date) return;
      const tripDateStr = trip.trip_date.split('T')[0];
      if (tripDateStr < cutoffStr) return;

      const route = routes.find(r => r.id === trip.route_id);
      if (!route) return;
      if (filterCompanyId && route.company_id !== filterCompanyId) return;

      const company = companies.find(c => c.id === route.company_id);

      if (!routeStats[route.id]) {
        routeStats[route.id] = {
          routeId: route.id,
          routePrefix: route.prefixo_linha || 'L-' + route.id.slice(0, 4),
          routeName: `${route.origin} → ${route.destination}`,
          companyName: company?.name || 'Viação Geral',
          totalPax: 0,
          revenue: 0,
          tripsCount: 0,
          avgOccupancy: 0
        };
      }

      let tripPax = 0;
      let tripRev = 0;
      Object.values(trip.passengers || {}).forEach((p: any) => {
        const pag = Number(p.pagantes) || 0;
        const vt = Number(p.vale_transporte) || 0;
        const ic = Number(p.imp_card) || 0;
        const grat = Number(p.gratuitos) || 0;

        tripPax += (pag + vt + ic + grat);
        tripRev += (pag + vt) * (route.price || 0);
        tripRev += ic * ((route.price || 0) * 0.7);
      });

      routeStats[route.id].totalPax += tripPax;
      routeStats[route.id].revenue += tripRev;
      routeStats[route.id].tripsCount += 1;
    });

    // Se nenhuma viagem foi encontrada no período, preenche com as rotas cadastradas
    if (Object.keys(routeStats).length === 0) {
      routes
        .filter(r => !filterCompanyId || r.company_id === filterCompanyId)
        .slice(0, 5)
        .forEach(route => {
          const company = companies.find(c => c.id === route.company_id);
          routeStats[route.id] = {
            routeId: route.id,
            routePrefix: route.prefixo_linha || 'L-' + route.id.slice(0, 4),
            routeName: `${route.origin} → ${route.destination}`,
            companyName: company?.name || 'Viação Geral',
            totalPax: 0,
            revenue: 0,
            tripsCount: 0,
            avgOccupancy: 0
          };
        });
    }

    const list = Object.values(routeStats).map(item => ({
      ...item,
      avgOccupancy: item.tripsCount > 0 ? parseFloat((item.totalPax / item.tripsCount).toFixed(1)) : 0
    }));

    // Ordenação de acordo com a métrica selecionada
    if (routeMetric === 'pax') {
      list.sort((a, b) => b.totalPax - a.totalPax);
    } else if (routeMetric === 'revenue') {
      list.sort((a, b) => b.revenue - a.revenue);
    } else {
      list.sort((a, b) => b.avgOccupancy - a.avgOccupancy);
    }

    return list;
  }, [allTrips, routes, companies, filterCompanyId, daysRange, routeMetric]);

  // Resumo Geral das Análises
  const analyticsSummary = useMemo(() => {
    const totalPax = thirtyDaysData.reduce((acc, d) => acc + d.totalPax, 0);
    const totalRevenue = thirtyDaysData.reduce((acc, d) => acc + d.revenue, 0);
    const totalTrips = thirtyDaysData.reduce((acc, d) => acc + d.tripsCount, 0);
    const avgDailyPax = daysRange > 0 ? Math.round(totalPax / daysRange) : 0;
    
    // Dia de maior pico
    const peakDay = thirtyDaysData.reduce((max, d) => d.totalPax > max.totalPax ? d : max, thirtyDaysData[0] || { label: '---', totalPax: 0, fullDate: '---' });

    // Comparativo: primeira metade vs segunda metade do período
    const half = Math.floor(thirtyDaysData.length / 2);
    const firstHalfPax = thirtyDaysData.slice(0, half).reduce((acc, d) => acc + d.totalPax, 0);
    const secondHalfPax = thirtyDaysData.slice(half).reduce((acc, d) => acc + d.totalPax, 0);
    
    let paxTrendPercentage = 0;
    if (firstHalfPax > 0) {
      paxTrendPercentage = parseFloat((((secondHalfPax - firstHalfPax) / firstHalfPax) * 100).toFixed(1));
    }

    const topRoute = routePerformanceData[0] || null;

    return {
      totalPax,
      totalRevenue,
      totalTrips,
      avgDailyPax,
      peakDay,
      paxTrendPercentage,
      topRoute
    };
  }, [thirtyDaysData, daysRange, routePerformanceData]);

  return (
    <div ref={panelRef} className="space-y-8 animate-in fade-in duration-500">
      {/* Header do Painel de Análises com Filtros */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 dark:border-zinc-800 shadow-sm transition-colors">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2 bg-yellow-400 text-slate-950 rounded-xl shadow-sm flex items-center justify-center">
                <Sparkles size={16} />
              </span>
              <span className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase tracking-widest">
                Inteligência Operacional
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase italic leading-none">
              Painel de Análises & Desempenho
            </h2>
            <p className="text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider mt-2">
              Tendências de volume de passageiros nos últimos {daysRange} dias e ranking das melhores rotas
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Botão Gerar PDF */}
            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPDF}
              className="px-4 py-2.5 bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 text-white dark:text-zinc-100 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-700 dark:border-zinc-700 flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
              title="Gerar PDF do Painel de Análises"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 size={15} className="animate-spin text-yellow-400" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <Download size={15} className="text-yellow-400" />
                  <span>Gerar PDF</span>
                </>
              )}
            </button>

            {/* Seletor de Período */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-2xl border border-slate-200 dark:border-zinc-700/60">
              <button
                onClick={() => setDaysRange(7)}
                className={`px-3 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${
                  daysRange === 7 
                    ? 'bg-yellow-400 text-slate-950 shadow-sm' 
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                7 Dias
              </button>
              <button
                onClick={() => setDaysRange(15)}
                className={`px-3 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${
                  daysRange === 15 
                    ? 'bg-yellow-400 text-slate-950 shadow-sm' 
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                15 Dias
              </button>
              <button
                onClick={() => setDaysRange(30)}
                className={`px-3 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${
                  daysRange === 30 
                    ? 'bg-yellow-400 text-slate-950 shadow-sm' 
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                30 Dias
              </button>
            </div>

            {/* Filtro de Empresa */}
            <div className="bg-slate-50 dark:bg-zinc-800 p-2 rounded-2xl border border-slate-200 dark:border-zinc-700 flex items-center gap-2 h-11 shadow-sm flex-1 sm:flex-initial">
              <Building2 size={16} className="text-yellow-600 ml-1 shrink-0" />
              <select 
                className="bg-transparent text-[10px] font-black uppercase outline-none dark:text-zinc-300 pr-2 cursor-pointer w-full"
                value={filterCompanyId} 
                onChange={e => setFilterCompanyId(e.target.value)}
              >
                <option value="">Todo o Grupo</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Cards de Resumo com Animação motion.div ao passar o mouse */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-8">
          <motion.div 
            whileHover={{ scale: 1.025, y: -2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="bg-slate-50 dark:bg-zinc-800/60 p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800 flex items-center justify-between cursor-default transition-all shadow-sm"
          >
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
                Volume Total ({daysRange}d)
              </p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none tracking-tight">
                {analyticsSummary.totalPax.toLocaleString('pt-BR')}
              </h3>
              <div className="flex items-center gap-1 mt-2 text-[9px] font-bold">
                {analyticsSummary.paxTrendPercentage >= 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center">
                    <ArrowUpRight size={12} /> +{analyticsSummary.paxTrendPercentage}% tendência
                  </span>
                ) : (
                  <span className="text-red-500 flex items-center">
                    <ArrowDownRight size={12} /> {analyticsSummary.paxTrendPercentage}% tendência
                  </span>
                )}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-yellow-400 text-slate-950 shadow-md flex items-center justify-center border border-yellow-300">
              <Users size={22} />
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.025, y: -2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="bg-slate-50 dark:bg-zinc-800/60 p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800 flex items-center justify-between cursor-default transition-all shadow-sm"
          >
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
                Média Diária
              </p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none tracking-tight">
                {analyticsSummary.avgDailyPax.toLocaleString('pt-BR')}
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-2">
                Passageiros / dia
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white shadow-md flex items-center justify-center border border-indigo-400">
              <TrendingUp size={22} />
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.025, y: -2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="bg-slate-50 dark:bg-zinc-800/60 p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800 flex items-center justify-between cursor-default transition-all shadow-sm"
          >
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
                Receita Acumulada
              </p>
              <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-none tracking-tight">
                {analyticsSummary.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-2">
                {analyticsSummary.totalTrips} viagens no período
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white shadow-md flex items-center justify-center border border-emerald-400">
              <DollarSign size={22} />
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.025, y: -2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="bg-slate-50 dark:bg-zinc-800/60 p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800 flex items-center justify-between cursor-default transition-all shadow-sm"
          >
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
                Rota Mais Movimentada
              </p>
              <h3 className="text-sm font-black text-slate-800 dark:text-white leading-tight truncate max-w-[140px]">
                {analyticsSummary.topRoute ? analyticsSummary.topRoute.routePrefix : '---'}
              </h3>
              <p className="text-[9px] text-yellow-600 dark:text-yellow-400 font-bold uppercase mt-1 truncate max-w-[140px]">
                {analyticsSummary.topRoute ? `${analyticsSummary.topRoute.totalPax.toLocaleString('pt-BR')} pax` : 'Sem dados'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-yellow-400 shadow-md flex items-center justify-center border border-slate-800">
              <Award size={22} />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Gráfico Principal 1: Tendência do Volume de Passageiros nos Últimos 30 Dias */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 dark:border-zinc-800 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 rounded-2xl border border-yellow-200 dark:border-yellow-900/30">
              <Users size={20} />
            </span>
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">
                Série Histórica Diária
              </p>
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-zinc-100 uppercase italic">
                Tendências do Volume de Passageiros ({daysRange} Dias)
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setChartViewMode('total')}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                chartViewMode === 'total'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
              }`}
            >
              Volume Total
            </button>
            <button
              onClick={() => setChartViewMode('detailed')}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                chartViewMode === 'detailed'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
              }`}
            >
              Por Tipo (Pagantes/VT/Grat.)
            </button>
          </div>
        </div>

        <div className="w-full h-80 sm:h-96 min-w-0 min-h-[300px] pt-2">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            {chartViewMode === 'total' ? (
              <AreaChart data={thirtyDaysData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="paxTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EAB308" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#EAB308" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-zinc-800/50" />
                <XAxis 
                  dataKey="label" 
                  fontSize={isMobile ? 7 : 9} 
                  fontWeight="bold" 
                  stroke="#94A3B8" 
                  tickLine={false}
                  interval={isMobile ? 3 : 'preserveEnd'}
                />
                <YAxis 
                  fontSize={9} 
                  fontWeight="bold" 
                  stroke="#94A3B8" 
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                />
                <Tooltip content={<Custom30DaysTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="totalPax" 
                  name="Passageiros Transportados" 
                  stroke="#EAB308" 
                  strokeWidth={3.5} 
                  fillOpacity={1} 
                  fill="url(#paxTrendGradient)" 
                />
              </AreaChart>
            ) : (
              <AreaChart data={thirtyDaysData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-zinc-800/50" />
                <XAxis 
                  dataKey="label" 
                  fontSize={isMobile ? 7 : 9} 
                  fontWeight="bold" 
                  stroke="#94A3B8" 
                  tickLine={false}
                  interval={isMobile ? 3 : 'preserveEnd'}
                />
                <YAxis 
                  fontSize={9} 
                  fontWeight="bold" 
                  stroke="#94A3B8" 
                  tickLine={false}
                />
                <Tooltip content={<Custom30DaysTooltip />} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="pagantes" name="Pagantes" stackId="1" stroke="#EAB308" fill="#EAB308" />
                <Area type="monotone" dataKey="valeTransporte" name="Vale Transporte" stackId="1" stroke="#3B82F6" fill="#3B82F6" />
                <Area type="monotone" dataKey="impCard" name="Cartão / Impresso" stackId="1" stroke="#A855F7" fill="#A855F7" />
                <Area type="monotone" dataKey="gratuitos" name="Gratuidades" stackId="1" stroke="#64748B" fill="#64748B" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: Rotas de Ônibus com Melhor Desempenho */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico de Barras Top Rotas */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 rounded-2xl border border-indigo-200 dark:border-indigo-900/30">
                  <RouteIcon size={20} />
                </span>
                <div>
                  <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">
                    Ranking de Produtividade
                  </p>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-zinc-100 uppercase italic">
                    Rotas com Melhor Desempenho
                  </h3>
                </div>
              </div>

              {/* Métrica de Comparação */}
              <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase">
                <button
                  onClick={() => setRouteMetric('pax')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all ${
                    routeMetric === 'pax' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  Passageiros
                </button>
                <button
                  onClick={() => setRouteMetric('revenue')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all ${
                    routeMetric === 'revenue' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  Faturamento
                </button>
                <button
                  onClick={() => setRouteMetric('occupancy')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all ${
                    routeMetric === 'occupancy' ? 'bg-yellow-500 text-slate-950 shadow-sm' : 'text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  Ocupação
                </button>
              </div>
            </div>

            <div className="w-full h-80 sm:h-96 min-w-0 min-h-[300px] pt-2">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart
                  data={routePerformanceData.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 10, right: 25, left: 15, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" className="dark:stroke-zinc-800/50" />
                  <XAxis 
                    type="number" 
                    fontSize={9} 
                    fontWeight="bold" 
                    stroke="#94A3B8" 
                    tickLine={false}
                    tickFormatter={(v) => routeMetric === 'revenue' ? `R$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}` : `${v}`}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="routePrefix" 
                    fontSize={9} 
                    fontWeight="bold" 
                    stroke="#94A3B8" 
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip content={<CustomRouteTooltip />} />
                  <Bar 
                    dataKey={routeMetric === 'pax' ? 'totalPax' : routeMetric === 'revenue' ? 'revenue' : 'avgOccupancy'} 
                    name={routeMetric === 'pax' ? 'Total de Passageiros' : routeMetric === 'revenue' ? 'Faturamento Total' : 'Ocupação Média'} 
                    fill={routeMetric === 'pax' ? '#6366F1' : routeMetric === 'revenue' ? '#10B981' : '#EAB308'} 
                    radius={[0, 6, 6, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tabela / Cards de Ranking Detalhado */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="p-2.5 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 rounded-xl">
                  <Award size={18} />
                </span>
                <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase italic">
                  Tabela das Top Linhas
                </h4>
              </div>
              <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                Últimos {daysRange}d
              </span>
            </div>

            <div className="space-y-3">
              {routePerformanceData.slice(0, 5).map((route, index) => (
                <div 
                  key={route.routeId} 
                  className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-3 hover:bg-yellow-50/50 dark:hover:bg-yellow-950/10 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      index === 0 
                        ? 'bg-yellow-400 text-slate-950 shadow-sm ring-2 ring-yellow-400/40' 
                        : index === 1 
                        ? 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200' 
                        : index === 2 
                        ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300' 
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                    }`}>
                      {index + 1}º
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 dark:text-zinc-100 uppercase truncate">
                        {route.routePrefix}
                      </p>
                      <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase truncate max-w-[140px] sm:max-w-[180px]">
                        {route.routeName}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white">
                      {route.totalPax.toLocaleString('pt-BR')} <span className="text-[8px] font-normal text-slate-400">pax</span>
                    </p>
                    <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                      R$ {route.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Linhas ativas analisadas: {routePerformanceData.length}</span>
            <span className="text-yellow-600 dark:text-yellow-400 font-black">100% Sincronizado</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
