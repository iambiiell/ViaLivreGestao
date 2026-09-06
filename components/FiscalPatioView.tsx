import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BusFront, 
  Ticket, 
  DollarSign, 
  Users, 
  Calendar, 
  Search, 
  CreditCard, 
  Hash, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Eye, 
  MapPin, 
  Fuel, 
  Gauge, 
  ClipboardCheck, 
  AlertCircle,
  TrendingUp,
  Wallet,
  UserCheck
} from 'lucide-react';
import { Trip, BusRoute, Vehicle, Company, User, TicketSale } from '../types';
import { db, supabase } from '../services/database';
import TripSelectionModal from './TripSelectionModal';

interface FiscalPatioViewProps {
  trips: Trip[];
  routes: BusRoute[];
  vehicles: Vehicle[];
  companies: Company[];
  currentUser: User | null;
  addToast?: (message: string, type?: 'success' | 'white' | 'error') => void;
}

export const FiscalPatioView: React.FC<FiscalPatioViewProps> = ({
  trips = [],
  routes = [],
  vehicles = [],
  companies = [],
  currentUser,
  addToast
}) => {
  const [filterDate, setFilterDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>('ALL');
  const [viewScope, setViewScope] = useState<'MY_ROUTES' | 'ALL_ROUTES'>('MY_ROUTES');
  const [tickets, setTickets] = useState<TicketSale[]>([]);
  const [selectedTripDetails, setSelectedTripDetails] = useState<Trip | null>(null);
  const [boardingMapTrip, setBoardingMapTrip] = useState<Trip | null>(null);

  // Load ticket sales for real-time calculation
  useEffect(() => {
    let isMounted = true;
    const loadTickets = async () => {
      try {
        const sales = await db.fetchAll<TicketSale>('ticket_sales');
        if (sales && isMounted) {
          setTickets(sales);
        }
      } catch (err) {
        console.error('Error fetching ticket sales in Fiscal view:', err);
      }
    };

    loadTickets();
    const interval = setInterval(loadTickets, 10000);

    const channel = supabase
      ? supabase
          .channel('fiscal-ticket-sales')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_sales' }, (payload: any) => {
            if (payload.eventType === 'INSERT') {
              const newSale = payload.new as TicketSale;
              setTickets(prev => [newSale, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as TicketSale;
              setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
            }
          })
          .subscribe()
      : null;

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Filter trips assigned to this Fiscal or all routes based on scope and date
  const fiscalTrips = useMemo(() => {
    const currentFiscalId = currentUser?.id;
    const currentFiscalName = (currentUser?.full_name || currentUser?.name || '').trim().toLowerCase();

    return trips.filter(t => {
      // Date filter
      if (t.trip_date !== filterDate) return false;

      // Scope filter: My assigned routes vs all routes
      if (viewScope === 'MY_ROUTES') {
        const isAssigned = (
          (t.fiscal_id && t.fiscal_id === currentFiscalId) ||
          (t.fiscal_name && t.fiscal_name.trim().toLowerCase() === currentFiscalName)
        );
        // If the fiscal is not explicitly assigned to any trip for today, fallback gracefully to company trips
        if (!isAssigned) {
          const hasAnyAssigned = trips.some(otherT => 
            otherT.trip_date === filterDate && (
              otherT.fiscal_id === currentFiscalId ||
              (otherT.fiscal_name && otherT.fiscal_name.trim().toLowerCase() === currentFiscalName)
            )
          );
          if (hasAnyAssigned) return false;
        }
      }

      // Route dropdown filter
      if (selectedRouteFilter !== 'ALL' && t.route_id !== selectedRouteFilter) {
        return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const route = routes.find(r => r.id === t.route_id);
        const matchRoute = route && (
          route.prefixo_linha?.toLowerCase().includes(term) ||
          route.origin?.toLowerCase().includes(term) ||
          route.destination?.toLowerCase().includes(term)
        );
        const matchBus = t.bus_number?.toLowerCase().includes(term);
        const matchDriver = t.driver_name?.toLowerCase().includes(term);
        const matchConductor = t.conductor_name?.toLowerCase().includes(term);

        if (!matchRoute && !matchBus && !matchDriver && !matchConductor) return false;
      }

      return true;
    }).sort((a, b) => (a.departure_time || '00:00').localeCompare(b.departure_time || '00:00'));
  }, [trips, routes, filterDate, viewScope, selectedRouteFilter, searchTerm, currentUser]);

  // Aggregate global metrics for the Fiscal Dashboard
  const summaryMetrics = useMemo(() => {
    let totalPassengers = 0;
    let totalTicketsSold = 0;
    let totalRevenue = 0;
    const uniqueVehicles = new Set<string>();
    const paymentBreakdown: { [method: string]: { count: number; total: number } } = {
      'DINHEIRO': { count: 0, total: 0 },
      'PIX': { count: 0, total: 0 },
      'CREDITO': { count: 0, total: 0 },
      'DEBITO': { count: 0, total: 0 },
      'VALE_TRANSPORTE': { count: 0, total: 0 },
      'IMPCARD': { count: 0, total: 0 },
      'GRATUIDADE': { count: 0, total: 0 }
    };

    fiscalTrips.forEach(trip => {
      if (trip.bus_number) uniqueVehicles.add(trip.bus_number);

      // Ticket sales for this trip
      const tripTickets = tickets.filter(t => t.trip_id === trip.id);
      totalTicketsSold += tripTickets.length;

      // Passengers calculation
      let tripPax = 0;
      if (trip.passengers) {
        Object.values(trip.passengers).forEach((p: any) => {
          tripPax += (p.pagantes || 0) + (p.vale_transporte || 0) + (p.imp_card || 0) + (p.gratuitos || 0);
        });
      } else if (trip.occupied_seats) {
        tripPax += trip.occupied_seats;
      } else if (trip.initial_turnstile && trip.final_turnstile) {
        tripPax += Math.max(0, trip.final_turnstile - trip.initial_turnstile);
      } else {
        tripPax += tripTickets.length;
      }
      totalPassengers += tripPax;

      // Payment Breakdown
      if (tripTickets.length > 0) {
        tripTickets.forEach(tk => {
          let method = (tk.payment_method || 'DINHEIRO').toUpperCase().replace(/[ ]/g, '_');
          if (method === 'CARTAO' || method === 'CARD') method = 'CREDITO';
          if (!paymentBreakdown[method]) {
            paymentBreakdown[method] = { count: 0, total: 0 };
          }
          paymentBreakdown[method].count += 1;
          paymentBreakdown[method].total += (tk.total_price || 0);
          totalRevenue += (tk.total_price || 0);
        });
      } else {
        // Fallback to trip summary fields if individual tickets not yet populated
        if (trip.payment_breakdown) {
          Object.entries(trip.payment_breakdown).forEach(([methodKey, val]) => {
            const m = methodKey.toUpperCase().replace(/[ ]/g, '_');
            if (!paymentBreakdown[m]) {
              paymentBreakdown[m] = { count: 0, total: 0 };
            }
            const count = trip.payment_counts?.[methodKey] || (Number(val) > 0 ? 1 : 0);
            paymentBreakdown[m].count += count;
            paymentBreakdown[m].total += Number(val) || 0;
            totalRevenue += Number(val) || 0;
          });
        } else {
          if ((trip.cash_total || 0) > 0) {
            paymentBreakdown['DINHEIRO'].total += (trip.cash_total || 0);
            paymentBreakdown['DINHEIRO'].count += 1;
            totalRevenue += (trip.cash_total || 0);
          }
          if ((trip.card_pix_total || 0) > 0) {
            paymentBreakdown['PIX'].total += (trip.card_pix_total || 0);
            paymentBreakdown['PIX'].count += 1;
            totalRevenue += (trip.card_pix_total || 0);
          }
        }
        if ((trip.gratuity_total || 0) > 0) {
          paymentBreakdown['GRATUIDADE'].count += trip.gratuity_total;
        }
      }
    });

    return {
      totalTrips: fiscalTrips.length,
      totalPassengers,
      totalTicketsSold,
      totalRevenue,
      activeVehiclesCount: uniqueVehicles.size,
      paymentBreakdown
    };
  }, [fiscalTrips, tickets]);

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto">
      {/* Modal de Mapa de Assentos / Ocupação */}
      <TripSelectionModal 
        isOpen={!!boardingMapTrip}
        onClose={() => setBoardingMapTrip(null)}
        trips={fiscalTrips}
        routes={routes}
        vehicles={vehicles}
        currentUser={currentUser}
        activeTripId={boardingMapTrip?.id || null}
        tickets={tickets}
        onStartTrip={() => {}}
        onFinalizeSection={() => {}}
      />

      {/* Header do Fiscal de Pátio */}
      <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] border-4 border-yellow-400 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="bg-yellow-400 text-slate-900 px-3.5 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                <ShieldCheck size={14} /> Fiscal de Pátio
              </span>
              <span className="bg-white/10 text-yellow-300 border border-white/10 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider">
                Modo Fiscalização & Auditoria
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acesso Restrito:</span>
              <p className="text-xs font-black text-white/90">Somente Leitura e Supervisão</p>
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black uppercase italic tracking-tighter mb-1">
            Controle de Linhas e Pátio
          </h2>
          <p className="text-xs font-bold text-slate-300 max-w-2xl">
            Acompanhamento em tempo real das rotas, veículos alocados, fluxo de passageiros, passagens emitidas e arrecadação por meio de pagamento.
          </p>

          <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-white/10 text-xs">
            <div className="bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-sm border border-white/10">
              <p className="text-[9px] font-black text-yellow-400 uppercase mb-0.5">Fiscal Responsável</p>
              <p className="text-sm font-black italic">{currentUser?.full_name || currentUser?.name || 'Fiscal de Pátio'}</p>
            </div>
            <div className="bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-sm border border-white/10">
              <p className="text-[9px] font-black text-yellow-400 uppercase mb-0.5">Matrícula</p>
              <p className="text-sm font-black italic">{currentUser?.registration_id || 'N/A'}</p>
            </div>
            <div className="bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-sm border border-white/10">
              <p className="text-[9px] font-black text-yellow-400 uppercase mb-0.5">Pátio / Unidade</p>
              <p className="text-sm font-black italic">{currentUser?.unidade || 'Central de Operações'}</p>
            </div>
          </div>
        </div>
        <BusFront size={160} className="absolute -right-8 -bottom-10 text-white/5 rotate-12 pointer-events-none" />
      </div>

      {/* Cards de Métricas Consolidadas do Fiscal */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider">Viagens / Rotas</span>
            <div className="w-8 h-8 rounded-xl bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
              <BusFront size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{summaryMetrics.totalTrips}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{summaryMetrics.activeVehiclesCount} Veículo(s) em Operação</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider">Passageiros</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{summaryMetrics.totalPassengers}</p>
          <p className="text-[9px] font-bold text-blue-500 uppercase mt-1">Fluxo Consolidado</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider">Passagens Vendidas</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Ticket size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{summaryMetrics.totalTicketsSold}</p>
          <p className="text-[9px] font-bold text-indigo-500 uppercase mt-1">Bilhetes Emitidos</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider">Receita das Rotas</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            R$ {summaryMetrics.totalRevenue.toFixed(2)}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Arrecadação Total</p>
        </div>
      </div>

      {/* Resumo Global de Formas de Pagamento no Pátio */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Wallet size={14} className="text-yellow-500" />
            Consolidado Geral por Forma de Pagamento
          </p>
          <span className="text-[9px] font-black uppercase bg-slate-100 dark:bg-zinc-800 text-slate-500 px-3 py-1 rounded-full">
            Data: {new Date(filterDate + 'T00:00:00').toLocaleDateString('pt-BR')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { key: 'DINHEIRO', label: 'Dinheiro', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40' },
            { key: 'PIX', label: 'PIX', icon: Hash, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800/40' },
            { key: 'CREDITO', label: 'Crédito', icon: CreditCard, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/40' },
            { key: 'DEBITO', label: 'Débito', icon: CreditCard, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40' },
            { key: 'VALE_TRANSPORTE', label: 'Vale Transporte', icon: Ticket, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40' },
            { key: 'GRATUIDADE', label: 'Gratuidades', icon: UserCheck, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/40' }
          ].map(pm => {
            const data = summaryMetrics.paymentBreakdown[pm.key] || { count: 0, total: 0 };
            const Icon = pm.icon;
            return (
              <div key={pm.key} className={`p-3.5 rounded-2xl border ${pm.color} flex flex-col justify-between`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider">{pm.label}</span>
                  <Icon size={14} />
                </div>
                <div>
                  <p className="text-base font-black">
                    {pm.key === 'GRATUIDADE' ? `${data.count} pax` : `R$ ${data.total.toFixed(2)}`}
                  </p>
                  <p className="text-[8px] font-bold opacity-80 uppercase">
                    {data.count} {data.count === 1 ? 'venda/registro' : 'vendas/registros'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Barra de Filtros Operacionais */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setViewScope('MY_ROUTES')}
              className={`px-5 py-2.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
                viewScope === 'MY_ROUTES'
                  ? 'bg-yellow-400 text-slate-900 shadow-md font-black'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-slate-600'
              }`}
            >
              Minhas Rotas Atribuídas
            </button>
            <button
              onClick={() => setViewScope('ALL_ROUTES')}
              className={`px-5 py-2.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
                viewScope === 'ALL_ROUTES'
                  ? 'bg-slate-900 text-white shadow-md font-black'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-slate-600'
              }`}
            >
              Todas as Rotas do Sistema
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Data */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-zinc-700">
              <Calendar size={16} className="text-yellow-500" />
              <input 
                type="date"
                className="bg-transparent font-black text-xs text-slate-900 dark:text-white outline-none cursor-pointer"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
              />
            </div>

            {/* Filtro de Rota */}
            <select
              className="bg-slate-50 dark:bg-zinc-800 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-zinc-700 font-black text-xs text-slate-900 dark:text-white outline-none"
              value={selectedRouteFilter}
              onChange={e => setSelectedRouteFilter(e.target.value)}
            >
              <option value="ALL">Todas as Linhas</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.prefixo_linha} - {r.origin} » {r.destination}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Campo de Busca Rápida */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Buscar por prefixo de linha, origem, destino, viatura ou motorista..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl font-bold text-xs text-slate-900 dark:text-white border-2 border-transparent focus:border-yellow-400 outline-none transition-colors"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Lista Detalhada de Rotas e Viagens em Fiscalização */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <BusFront size={16} className="text-yellow-500" />
            Rotas em Fiscalização ({fiscalTrips.length})
          </h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase">
            Início ou Finalização de Viagem Bloqueadas para Fiscal
          </span>
        </div>

        {fiscalTrips.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 p-12 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-zinc-800 text-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={32} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
              Nenhuma rota encontrada para os critérios selecionados nesta data.
            </p>
            {viewScope === 'MY_ROUTES' && (
              <button 
                onClick={() => setViewScope('ALL_ROUTES')}
                className="mt-4 px-6 py-2.5 bg-yellow-400 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md hover:bg-yellow-500 transition-all"
              >
                Visualizar Todas as Rotas do Sistema
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {fiscalTrips.map(trip => {
              const route = routes.find(r => r.id === trip.route_id);
              const vehicle = vehicles.find(v => v.prefix === trip.bus_number);
              const isUrban = route?.route_type === 'URBANO';
              const tripTickets = tickets.filter(t => t.trip_id === trip.id);

              // Calculate passengers for this specific route trip
              let tripPaxCount = 0;
              let pagantesCount = 0;
              let gratuitasCount = trip.gratuity_total || 0;
              let vtCount = 0;

              if (trip.passengers) {
                Object.values(trip.passengers).forEach((p: any) => {
                  pagantesCount += (p.pagantes || 0);
                  gratuitasCount += (p.gratuitos || 0);
                  vtCount += (p.vale_transporte || 0) + (p.imp_card || 0);
                  tripPaxCount += (p.pagantes || 0) + (p.vale_transporte || 0) + (p.imp_card || 0) + (p.gratuitos || 0);
                });
              } else if (trip.occupied_seats) {
                tripPaxCount = trip.occupied_seats;
                pagantesCount = trip.occupied_seats;
              } else if (trip.initial_turnstile && trip.final_turnstile) {
                tripPaxCount = Math.max(0, trip.final_turnstile - trip.initial_turnstile);
              } else {
                tripPaxCount = tripTickets.length;
                pagantesCount = tripTickets.length;
              }

              // Route payment methods breakdown
              const routePayments: { [method: string]: { count: number; total: number } } = {};
              let routeTotalRevenue = 0;

              if (tripTickets.length > 0) {
                tripTickets.forEach(tk => {
                  let method = (tk.payment_method || 'DINHEIRO').toUpperCase().replace(/[ ]/g, '_');
                  if (method === 'CARTAO' || method === 'CARD') method = 'CREDITO';
                  if (!routePayments[method]) {
                    routePayments[method] = { count: 0, total: 0 };
                  }
                  routePayments[method].count += 1;
                  routePayments[method].total += (tk.total_price || 0);
                  routeTotalRevenue += (tk.total_price || 0);
                });
              } else {
                if (trip.payment_breakdown && Object.keys(trip.payment_breakdown).length > 0) {
                  Object.entries(trip.payment_breakdown).forEach(([methodKey, val]) => {
                    const m = methodKey.toUpperCase().replace(/[ ]/g, '_');
                    const count = trip.payment_counts?.[methodKey] || (Number(val) > 0 ? 1 : 0);
                    routePayments[m] = { count, total: Number(val) || 0 };
                    routeTotalRevenue += Number(val) || 0;
                  });
                } else {
                  if ((trip.cash_total || 0) > 0) {
                    routePayments['DINHEIRO'] = { count: 1, total: trip.cash_total || 0 };
                    routeTotalRevenue += trip.cash_total || 0;
                  }
                  if ((trip.card_pix_total || 0) > 0) {
                    routePayments['PIX_CARTAO'] = { count: 1, total: trip.card_pix_total || 0 };
                    routeTotalRevenue += trip.card_pix_total || 0;
                  }
                }
              }

              return (
                <div 
                  key={trip.id}
                  className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-md relative overflow-hidden transition-all hover:border-yellow-400"
                >
                  {/* Status Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                        trip.status === 'Em Rota' || trip.status === 'Em Andamento'
                          ? 'bg-emerald-500 text-white animate-pulse'
                          : trip.status === 'Concluída'
                          ? 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                          : 'bg-yellow-400 text-slate-900'
                      }`}>
                        <BusFront size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white tracking-wider bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-lg">
                            {route?.prefixo_linha || 'LINHA'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                            isUrban ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                          }`}>
                            {isUrban ? 'Urbano' : 'Rodoviário'}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                            trip.status === 'Em Rota' || trip.status === 'Em Andamento'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : trip.status === 'Concluída'
                              ? 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400'
                          }`}>
                            {trip.status}
                          </span>
                        </div>
                        <h4 className="text-lg font-black font-mono tracking-tight text-slate-900 dark:text-white uppercase mt-1">
                          {route?.origin || 'Origem'} <ArrowRight className="inline mx-1.5 text-yellow-500" size={16} /> {route?.destination || 'Destino'}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto">
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Horário de Partida</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white flex items-center justify-end gap-1">
                          <Clock size={14} className="text-yellow-500" />
                          {trip.departure_time || '--:--'}
                        </p>
                      </div>
                      {!isUrban && (
                        <button 
                          onClick={() => setBoardingMapTrip(trip)}
                          className="px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-yellow-400 hover:text-slate-900 text-slate-700 dark:text-zinc-200 rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <Eye size={14} /> Mapa Assentos
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grid de 3 Blocos: Veículo, Passageiros & Passagens, Equipe */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                    {/* Bloco 1: Veículo Alocado */}
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-800 space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <BusFront size={13} className="text-yellow-500" />
                        Dados do Veículo
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Prefixo:</span>
                        <span className="font-black text-sm text-slate-900 dark:text-white">
                          #{trip.bus_number || 'Sem Viatura'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Modelo / Carroceria:</span>
                        <span className="font-bold text-xs text-slate-800 dark:text-zinc-200">
                          {vehicle?.model || vehicle?.type || 'Convencional'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Capacidade:</span>
                        <span className="font-bold text-xs text-slate-800 dark:text-zinc-200">
                          {vehicle?.capacity || 40} Lugares
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-zinc-700/60 text-[10px]">
                        <span className="font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Fuel size={12} className="text-amber-500" /> Combustível:
                        </span>
                        <span className="font-black text-slate-800 dark:text-zinc-200">
                          {trip.fuel_level || 'CHEIO'}
                        </span>
                      </div>
                    </div>

                    {/* Bloco 2: Passageiros & Passagens */}
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-800 space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Users size={13} className="text-blue-500" />
                        Passageiros & Passagens
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Total Passageiros:</span>
                        <span className="font-black text-base text-blue-600 dark:text-blue-400">
                          {tripPaxCount} pax
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Passagens Vendidas:</span>
                        <span className="font-black text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                          <Ticket size={14} />
                          {tripTickets.length > 0 ? tripTickets.length : (trip.occupied_seats || tripPaxCount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-500 uppercase">Gratuidades:</span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          {gratuitasCount} pax
                        </span>
                      </div>
                      {isUrban && trip.initial_turnstile && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-zinc-700/60 text-[10px]">
                          <span className="font-bold text-slate-500 uppercase">Roleta (Ini / Fim):</span>
                          <span className="font-black text-slate-800 dark:text-zinc-200">
                            {trip.initial_turnstile} / {trip.final_turnstile || '---'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bloco 3: Equipe Operacional da Rota */}
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-800 space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-emerald-500" />
                        Equipe da Rota
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Fiscal:</span>
                        <span className="font-black text-xs text-yellow-600 dark:text-yellow-400 truncate max-w-[140px]">
                          {trip.fiscal_name || currentUser?.full_name || 'Fiscal de Pátio'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Motorista:</span>
                        <span className="font-bold text-xs text-slate-800 dark:text-zinc-200 truncate max-w-[140px]">
                          {trip.driver_name || 'Não atribuído'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Cobrador:</span>
                        <span className="font-bold text-xs text-slate-800 dark:text-zinc-200 truncate max-w-[140px]">
                          {trip.conductor_name || 'Sem Cobrador'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-zinc-700/60 text-[10px]">
                        <span className="font-bold text-slate-500 uppercase">Total Rota:</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          R$ {routeTotalRevenue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Detalhamento de Formas de Pagamento para Esta Rota */}
                  <div className="p-4 bg-slate-100/70 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-700/60 space-y-2">
                    <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Wallet size={12} className="text-yellow-500" />
                      Vendas e Pagamentos por Meio Nesta Rota
                    </p>
                    
                    {Object.keys(routePayments).length === 0 ? (
                      <p className="text-[10px] font-bold text-slate-400 italic">
                        Nenhum pagamento registrado até o momento para esta rota.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {Object.entries(routePayments).map(([method, data]) => (
                          <div 
                            key={method}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm text-xs"
                          >
                            <span className="text-[9px] font-black uppercase text-slate-500">
                              {method.replace(/_/g, ' ')}:
                            </span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400">
                              R$ {data.total.toFixed(2)}
                            </span>
                            <span className="text-[8px] bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-bold text-slate-400">
                              {data.count}x
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FiscalPatioView;
