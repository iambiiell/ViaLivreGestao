import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { BusRoute, RouteStatus, Company, City, User, LedColor, RouteSection, TicketingConfig, Trip, TicketSale, BusStation } from '../types';
import { Plus, Navigation, Trash2, X, Pencil, Save, Clock, ListChecks, Type, Search, LayoutGrid, Palette, Zap, Binary, Hash, ArrowRight, BarChart3, Users, DollarSign, Activity, FileSpreadsheet, Crosshair, Minimize2, MapPin, Bus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../services/database';
import { useConfirmDialog, ConfirmDialogModal } from './ConfirmDialog';

interface RouteManagerProps {
  routes: BusRoute[];
  companies: Company[];
  cities: City[];
  trips: Trip[];
  currentUser: User | null;
  ticketingConfig: TicketingConfig | null;
  busStations?: BusStation[];
  onAddRoute: (route: BusRoute) => void;
  onUpdateRoute: (route: BusRoute) => void;
  onDeleteRoute: (id: string) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

type ModalTab = 'geral' | 'secoes' | 'horario' | 'letreiro';

const DEFAULT_SIGN_ITEM = { text: 'VIALIVRE GESTÃO', modo: 'FIXO' as const, cor: 'AMBAR' as const };

const initialForm: Partial<BusRoute> = {
  prefixo_linha: '',
  origin: '',
  destination: '',
  price: 0,
  toll: 0,
  fees: 0,
  duration_minutes: 0,
  status: RouteStatus.ACTIVE,
  sections: [],
  schedule: { weekdays: [], saturday: [], sunday: [] },
  letreiro_principal: '',
  letreiro_principal_modo: 'FIXO',
  letreiro_principal_cor: 'AMBAR',
  via1: '',
  via1_modo: 'FIXO',
  via1_cor: 'AMBAR',
  via2: '',
  via2_modo: 'FIXO',
  via2_cor: 'AMBAR',
  via3: '',
  via3_modo: 'FIXO',
  via3_cor: 'AMBAR',
  route_type: 'URBANO',
  payment_type: 'QUALQUER_UM',
  payment_methods_accepted: ['DINHEIRO', 'PIX', 'CREDITO', 'DEBITO'],
  estimated_travel_time_text: ''
};

const RouteManager: React.FC<RouteManagerProps> = ({ 
  routes = [], 
  companies = [], 
  cities = [], 
  ticketingConfig,
  trips = [],
  busStations = [],
  onAddRoute, 
  onUpdateRoute, 
  onDeleteRoute, 
  addToast 
}) => {
  const [formData, setFormData] = useState<Partial<BusRoute>>(initialForm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('geral');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<'IDA' | 'VOLTA'>('IDA');
  const [selectedScope, setSelectedScope] = useState<string>('');
  const [showAllScopes, setShowAllScopes] = useState<boolean>(false);
  const [currentSignIdx, setCurrentSignIdx] = useState(0);
  const [newTimes, setNewTimes] = useState({ weekdays: '', saturday: '', sunday: '' });
  const [bulkInput, setBulkInput] = useState({ weekdays: '', saturday: '', sunday: '' });
  const [showBulk, setShowBulk] = useState({ weekdays: false, saturday: false, sunday: false });
  const [focusedRouteId, setFocusedRouteId] = useState<string | null>(null);

  const { isOpen: isConfirmOpen, options: confirmOptions, confirm, handleClose: handleConfirmClose } = useConfirmDialog();

  const handleDeleteRouteClick = async (route: BusRoute) => {
    const ok = await confirm({
      title: 'Excluir Itinerário',
      message: `Tem certeza que deseja excluir o itinerário ${route.prefixo_linha} (${route.origin} x ${route.destination})? Esta operação é permanente.`,
      confirmText: 'Excluir Itinerário',
      type: 'danger'
    });
    if (ok) {
      onDeleteRoute(route.id);
      addToast("Itinerário excluído com sucesso!", "success");
      if (focusedRouteId === route.id) setFocusedRouteId(null);
    }
  };

  // Statistics State
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsRoute, setStatsRoute] = useState<BusRoute | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [routeMetrics, setRouteMetrics] = useState({
    totalTrips: 0,
    totalPassengers: 0,
    totalRevenue: 0,
    recentSales: [] as TicketSale[]
  });

  const activeSigns = useMemo(() => {
    const items = [
      { text: formData.letreiro_principal || '', modo: formData.letreiro_principal_modo || 'FIXO', cor: 'BRANCO' },
      { text: formData.via1 || '', modo: formData.via1_modo || 'FIXO', cor: 'BRANCO' },
      { text: formData.via2 || '', modo: formData.via2_modo || 'FIXO', cor: 'BRANCO' },
      { text: formData.via3 || '', modo: formData.via3_modo || 'FIXO', cor: 'BRANCO' }
    ].filter(s => s.text && s.text.trim() !== "");
    return items.length > 0 ? items : [{ text: 'VIALIVRE GESTÃO', modo: 'FIXO' as const, cor: 'BRANCO' as const }];
  }, [formData]);

  useEffect(() => {
    if (activeTab !== 'letreiro') return;
    const current = activeSigns[currentSignIdx % activeSigns.length];
    const duration = current.modo === 'FIXO' ? 3000 : 8000;
    const timer = setTimeout(() => { 
      setCurrentSignIdx(prev => (prev + 1) % activeSigns.length); 
    }, duration);
    return () => clearTimeout(timer);
  }, [currentSignIdx, activeSigns, activeTab]);

  useEffect(() => {
    if (statsRoute) {
      loadRouteStats(statsRoute.id);
    }
  }, [statsRoute]);

  const loadRouteStats = async (routeId: string) => {
    setStatsLoading(true);
    try {
      const allSales = await db.getSales();
      const routeTrips = trips.filter(t => t.route_id === routeId);
      const tripIds = new Set(routeTrips.map(t => t.id));
      
      const routeSales = allSales.filter(s => tripIds.has(s.trip_id) || s.route_id === routeId);
      
      const revenue = routeSales.reduce((acc, s) => acc + (s.total_price || 0), 0);
      
      setRouteMetrics({
        totalTrips: routeTrips.length,
        totalPassengers: routeSales.length,
        totalRevenue: revenue,
        recentSales: routeSales.slice(-5).reverse()
      });
    } catch (e) {
      addToast("Erro ao carregar estatísticas.", "error");
    } finally {
      setStatsLoading(false);
    }
  };

  const filteredRoutes = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return routes.filter(r => 
      r.prefixo_linha.toLowerCase().includes(search) ||
      r.destination.toLowerCase().includes(search) ||
      r.origin.toLowerCase().includes(search)
    ).sort((a, b) => a.prefixo_linha.localeCompare(b.prefixo_linha, undefined, { numeric: true }));
  }, [routes, searchTerm]);

  const allServiceClasses = useMemo(() => {
    const base = [
      'Convencional', 'Convencional DD', 'Executivo', 'Executivo DD', 
      'Leito', 'Leito DD', 'Semi-Leito', 'Semi-Leito DD', 'Urbano', 'Cama'
    ];
    if (ticketingConfig?.custom_vehicle_classes) {
      ticketingConfig.custom_vehicle_classes.forEach(cvc => {
        if (!base.includes(cvc.label)) {
          base.push(cvc.label);
        }
      });
    }
    return base.sort();
  }, [ticketingConfig]);

  const getLedColorClass = (color: LedColor) => {
    switch (color) {
      case 'AMBAR': return 'text-yellow-500';
      case 'BRANCO': return 'text-slate-100';
      case 'VERDE': return 'text-emerald-400';
      default: return 'text-yellow-500';
    }
  };

  const addTime = (dayType: 'weekdays' | 'saturday' | 'sunday') => {
    const time = newTimes[dayType];
    if (!time) return;

    const formattedTime = /^\d:\d{2}$/.test(time) ? `0${time}` : time;
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(formattedTime)) {
      addToast("Formato inválido. Use HH:MM", "error");
      return;
    }

    const currentSchedule = [...(formData.schedule?.[dayType] || [])];
    if (currentSchedule.some(t => t.time === formattedTime && t.direction === selectedDirection && t.section_name === (selectedScope || undefined))) return;

    const newSchedule = {
      ...formData.schedule!,
      [dayType]: [...currentSchedule, { time: formattedTime, direction: selectedDirection, section_name: selectedScope || undefined }]
    };

    setFormData(prev => ({ ...prev, schedule: newSchedule }));
    setNewTimes(prev => ({ ...prev, [dayType]: '' }));
  };

  const addBulkTimes = (dayType: 'weekdays' | 'saturday' | 'sunday') => {
    const rawInput = bulkInput[dayType];
    if (!rawInput) return;

    const candidates = rawInput
      .split(/[\s,;\n]+/)
      .map(t => t.trim())
      .filter(Boolean);

    if (candidates.length === 0) {
      addToast("Nenhum horário detectado na entrada em massa.", "warning");
      return;
    }

    const currentSchedule = [...(formData.schedule?.[dayType] || [])];
    const updatedList = [...currentSchedule];
    let addedCount = 0;
    let formatError = false;

    candidates.forEach(time => {
      let formattedTime = time;
      if (/^\d:\d{2}$/.test(formattedTime)) {
        formattedTime = `0${formattedTime}`;
      }

      if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(formattedTime)) {
        if (!updatedList.some(t => t.time === formattedTime && t.direction === selectedDirection && t.section_name === (selectedScope || undefined))) {
          updatedList.push({
            time: formattedTime,
            direction: selectedDirection,
            section_name: selectedScope || undefined
          });
          addedCount++;
        }
      } else {
        formatError = true;
      }
    });

    if (addedCount > 0) {
      const newSchedule = {
        ...formData.schedule!,
        [dayType]: updatedList.sort((a, b) => a.time.localeCompare(b.time))
      };
      setFormData(prev => ({ ...prev, schedule: newSchedule }));
      setBulkInput(prev => ({ ...prev, [dayType]: '' }));
      setShowBulk(prev => ({ ...prev, [dayType]: false }));
      addToast(`${addedCount} horário(s) adicionado(s) em massa!`, "success");
    } else {
      if (formatError) {
        addToast("Formato inválido encontrado nos horários informados. Use HH:MM separados por espaço/vírgula.", "error");
      } else {
        addToast("Nenhum horário novo ou válido foi adicionado.", "warning");
      }
    }
  };

  const handleAddSection = () => {
    const nameInput = document.getElementById('new-section-name') as HTMLInputElement;
    const originInput = document.getElementById('sec-origin') as HTMLInputElement;
    const destInput = document.getElementById('sec-dest') as HTMLInputElement;
    
    const name = nameInput?.value.toUpperCase();
    if (!name) {
        addToast("Informe o nome da seção", "warning");
        return;
    }
    
    const newSection: RouteSection = {
        name,
        origin: originInput?.value.toUpperCase() || formData.origin || '',
        destination: destInput?.value.toUpperCase() || formData.destination || '',
        price: formData.price || 0
    };
    
    setFormData(prev => ({ ...prev, sections: [...(prev.sections || []), newSection] }));
    if (nameInput) nameInput.value = '';
  };

  const removeTime = (dayType: 'weekdays' | 'saturday' | 'sunday', time: string, direction: 'IDA' | 'VOLTA', section_name?: string) => {
    const currentSchedule = formData.schedule?.[dayType] || [];
    const newSchedule = {
      ...formData.schedule!,
      [dayType]: currentSchedule.filter(t => !(t.time === time && t.direction === direction && t.section_name === section_name))
    };
    setFormData({ ...formData, schedule: newSchedule });
  };

  const handleCurrencyChange = (value: string, field: keyof BusRoute) => {
    const numericValue = value.replace(/\D/g, '');
    const floatValue = parseFloat(numericValue) / 100;
    setFormData({ ...formData, [field]: floatValue });
  };

  const formatCurrencyValue = (value: number | undefined) => {
    if (value === undefined || value === null) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleOpenModal = (route?: BusRoute) => {
    setSelectedScope('');
    setShowAllScopes(false);
    if (route) {
        setEditingId(route.id);
        const data = { ...initialForm, ...route };
        setFormData(data);
    } else {
        setEditingId(null);
        setFormData(initialForm);
    }
    setActiveTab('geral');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.prefixo_linha || !formData.company_id || !formData.origin || !formData.destination) {
      addToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }
    if ((formData.route_type === 'RODOVIARIA' || formData.route_type === 'INTERMUNICIPAL') && 
        (!formData.origin_station_id || !formData.origin_station_platform || !formData.destination_station_id || !formData.destination_station_platform)) {
      addToast("Os campos de Rodoviária e Plataforma são obrigatórios para rotas rodoviárias/intermunicipais.", "error");
      return;
    }
    const route = { ...formData } as BusRoute;
    if (editingId) {
      onUpdateRoute({ ...route, id: editingId });
    } else {
      onAddRoute(route);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border-2 border-yellow-400 gap-4">
        <div className="flex-1 w-full">
            <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic">Gestão de Itinerários</h2>
            <div className="mt-6 relative max-w-md">
              <Search className="absolute left-4 top-4 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por linha ou destino..." 
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 text-[10px] font-black outline-none dark:text-zinc-300 shadow-inner" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="bg-yellow-400 text-slate-900 px-8 py-4 rounded-2xl font-black uppercase text-[10px] shadow-xl border-2 border-slate-900 active:scale-95 transition-all flex items-center gap-2"
        >
          <Plus size={18}/> Novo Itinerário
        </button>
      </div>

      {focusedRouteId ? (() => {
        const route = routes.find(r => r.id === focusedRouteId);
        if (!route) return null;
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 p-8 md:p-12 rounded-[3rem] border-4 border-yellow-400 shadow-2xl space-y-8"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b-2 border-yellow-400/30">
              <div className="flex items-center gap-4">
                <div className="h-16 px-6 bg-slate-900 text-yellow-400 rounded-2xl flex items-center justify-center font-black text-2xl border-2 border-slate-800 shadow-lg">{route.prefixo_linha}</div>
                <div>
                  <span className="text-[10px] font-black bg-yellow-400 text-slate-900 px-3 py-1 rounded-full uppercase">Modo de Foco Ativo</span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-zinc-100 uppercase italic mt-2">{route.origin} x {route.destination}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase mt-1">Tipo: {route.route_type} • Status: {route.status}</p>
                </div>
              </div>
              <button 
                onClick={() => setFocusedRouteId(null)}
                className="px-6 py-4 bg-slate-900 dark:bg-zinc-800 text-yellow-400 rounded-2xl font-black uppercase text-xs shadow-xl flex items-center gap-2 border-2 border-slate-800 hover:bg-black transition-all"
              >
                <Minimize2 size={18} /> Sair do Modo de Foco
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tarifa & Info */}
              <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-500"/> Tarifas e Custos
                </h4>
                <div className="space-y-2 text-sm font-bold">
                  <div className="flex justify-between"><span className="text-slate-500">Tarifa Base:</span><span>R$ {(route.price || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Pedágio:</span><span>R$ {(route.toll || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Taxas:</span><span>R$ {(route.fees || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between pt-3 border-t border-slate-200 dark:border-zinc-800 text-emerald-600 font-black text-base">
                    <span>Total:</span><span>R$ {((route.price || 0) + (route.toll || 0) + (route.fees || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Plataformas e Estações */}
              <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <MapPin size={16} className="text-yellow-500"/> Plataformas e Partida
                </h4>
                <div className="space-y-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
                  <p><span className="text-slate-400 uppercase">Origem:</span> {route.origin} {route.origin_station_platform ? `(Plat: ${route.origin_station_platform})` : ''}</p>
                  <p><span className="text-slate-400 uppercase">Destino:</span> {route.destination} {route.destination_station_platform ? `(Plat: ${route.destination_station_platform})` : ''}</p>
                  <p><span className="text-slate-400 uppercase">Duração Estimada:</span> {route.duration_minutes} min</p>
                </div>
              </div>

              {/* Veículos / Frota */}
              <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Bus size={16} className="text-blue-500"/> Status da Frota / Veículos
                </h4>
                <div className="space-y-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
                  <p className="text-emerald-600 font-black uppercase">Operação Ativa e Sincronizada</p>
                  <p className="text-[10px] text-slate-400">Linha habilitada para emissão de bilhetes e controle de catraca.</p>
                </div>
              </div>
            </div>

            {/* Paradas e Horários */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <MapPin size={16} className="text-indigo-500"/> Paradas e Seções ({route.stops?.length || 0})
                </h4>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar p-2">
                  {route.stops && route.stops.length > 0 ? (
                    route.stops.map((stop, i) => (
                      <span key={i} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-[10px] font-black text-slate-800 dark:text-zinc-200 uppercase">
                        {i + 1}. {stop}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">Nenhuma parada intermediária cadastrada.</p>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Clock size={16} className="text-yellow-500"/> Horários Cadastrados
                </h4>
                <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar text-xs font-bold">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">Dias Úteis:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {route.schedule?.weekdays?.map((s, idx) => (
                        <span key={idx} className="px-2 py-1 bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 rounded-md text-[10px] font-mono">{s.time} ({s.direction})</span>
                      )) || <span className="text-slate-400 italic text-[10px]">Nenhum horário</span>}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">Sábados:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {route.schedule?.saturday?.map((s, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-400/20 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-mono">{s.time} ({s.direction})</span>
                      )) || <span className="text-slate-400 italic text-[10px]">Nenhum horário</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })() : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoutes.map(route => (
            <div key={route.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border-2 border-yellow-400 shadow-sm hover:shadow-xl transition-all h-full flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 min-w-fit px-4 bg-slate-900 text-yellow-400 rounded-2xl flex items-center justify-center font-black text-xl border-2 border-slate-800 shrink-0">{route.prefixo_linha}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black dark:text-white uppercase italic leading-tight break-words">{route.origin} x {route.destination}</h3>
                    <p className="text-[8px] font-black text-slate-400 uppercase">{route.route_type}</p>
                    {route.origin_station_platform && route.destination_station_platform && (
                      <p className="text-[9px] font-bold text-yellow-600 dark:text-yellow-400 mt-1 uppercase">
                        Plat: {route.origin_station_platform} ➔ {route.destination_station_platform}
                      </p>
                    )}
                  </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t dark:border-zinc-800 mt-auto">
                  <div className="flex flex-col">
                      <span className="text-[8px] font-black text-black dark:text-white uppercase">Tarifa Final</span>
                      <span className="text-emerald-600 font-black">R$ {((route.price || 0) + (route.toll || 0) + (route.fees || 0)).toFixed(2)}</span>
                  </div>
                  <div className="flex gap-1 items-center">
                      <button onClick={() => setFocusedRouteId(route.id)} className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 rounded-xl transition-all" title="Modo de Foco"><Crosshair size={18} /></button>
                      <button onClick={() => { setStatsRoute(route); setShowStatsModal(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 rounded-xl transition-all" title="Estatísticas"><BarChart3 size={18} /></button>
                      <button onClick={() => handleOpenModal(route)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all" title="Editar"><Pencil size={18} /></button>
                      <button onClick={() => handleDeleteRouteClick(route)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all" title="Excluir"><Trash2 size={18} /></button>
                  </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialogModal isOpen={isConfirmOpen} options={confirmOptions} onClose={handleConfirmClose} />

      {/* Statistics Modal */}
      <AnimatePresence>
        {showStatsModal && statsRoute && (
          <div className="modal-container route-stats-popup fixed inset-0 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 z-[200] backdrop-blur-md">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl"
            >
              <div className="max-h-[90vh] overflow-y-auto w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-[3rem] shadow-2xl flex flex-col border-4 border-indigo-400 overflow-hidden">
                <div className="p-8 border-b-2 border-indigo-400 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic">Estatísticas da Rota</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{statsRoute.prefixo_linha} - {statsRoute.origin} x {statsRoute.destination}</p>
                    </div>
                    <button onClick={() => { setShowStatsModal(false); setStatsRoute(null); }} className="text-slate-400 hover:rotate-90 transition-transform"><X size={32}/></button>
                </div>

                <div className="p-8 space-y-8 bg-white dark:bg-zinc-950 flex-1">
                  {statsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Activity className="animate-spin text-indigo-500" size={48} />
                      <p className="text-sm font-black text-slate-400 uppercase italic">Calculando métricas...</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* Metrics Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 text-center">
                          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Activity size={24} />
                          </div>
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Viagens Realizadas</p>
                          <p className="text-2xl font-black text-slate-900 dark:text-zinc-100">{routeMetrics.totalTrips}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 text-center">
                          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Users size={24} />
                          </div>
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Passageiros</p>
                          <p className="text-2xl font-black text-slate-900 dark:text-zinc-100">{routeMetrics.totalPassengers}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 text-center">
                          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <DollarSign size={24} />
                          </div>
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Receita Gerada</p>
                          <p className="text-2xl font-black text-emerald-600 italic">R$ {routeMetrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>

                      {/* Recent Sales List */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <ListChecks size={14} /> Vendas Recentes nesta Rota
                        </h4>
                        <div className="space-y-2">
                          {routeMetrics.recentSales.length === 0 ? (
                             <div className="text-center py-8 bg-slate-50 dark:bg-zinc-900 rounded-2xl text-slate-400 text-[10px] font-black uppercase italic">Nenhuma venda registrada para esta rota</div>
                          ) : (
                            routeMetrics.recentSales.map(sale => (
                              <div key={sale.id} className="bg-slate-50 dark:bg-zinc-900 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 flex justify-between items-center transition-all hover:border-indigo-400">
                                <div>
                                  <p className="text-[10px] font-black text-slate-900 dark:text-zinc-100 uppercase">{sale.passenger_name}</p>
                                  <p className="text-[8px] font-black text-slate-400 uppercase">{new Date(sale.created_at).toLocaleDateString()} {sale.departure_time || ''}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-emerald-600">R$ {(Number(sale.total_price || 0)).toFixed(2)}</p>
                                  <p className="text-[8px] font-black text-slate-500 uppercase">{sale.payment_method}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 border-t-2 border-indigo-400 bg-slate-50 dark:bg-zinc-900 flex justify-center">
                    <button onClick={() => { setShowStatsModal(false); setStatsRoute(null); }} className="px-12 py-4 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl border-2 border-indigo-900 flex items-center justify-center gap-2">Fechar Relatório</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col h-[85vh] border-4 border-yellow-400 overflow-hidden">
            <div className="p-8 border-b-2 border-yellow-400 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic">Configuração de Linha</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:rotate-90 transition-transform"><X size={32}/></button>
            </div>

            <div className="flex bg-slate-50 dark:bg-zinc-900 px-4 border-b-2 border-yellow-400 overflow-x-auto no-scrollbar">
                {[
                    { id: 'geral', label: 'Cadastro', icon: Navigation },
                    { id: 'secoes', label: 'Seções', icon: ListChecks },
                    { id: 'horario', label: 'Grade Horária', icon: Clock },
                    { id: 'letreiro', label: 'Painel Digital', icon: Type }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as ModalTab)} className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase transition-all border-b-4 ${activeTab === tab.id ? 'border-yellow-400 text-yellow-600' : 'border-transparent text-slate-400'}`}>
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-zinc-950">
                {activeTab === 'geral' && (
                    <div className="space-y-6 animate-in fade-in">
                        {/* primeira linha: Empresa Operadora */}
                        <div className="w-full">
                            <label className="block text-[10px] font-black text-black dark:text-white uppercase mb-1 ml-2">Empresa Operadora *</label>
                            <select className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-white" value={formData.company_id || ''} onChange={e => setFormData({...formData, company_id: e.target.value})}>
                                <option value="">Selecione a empresa...</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        {/* segunda linha: Cód. Linha, Tipo de Estrada/Serviço e Tempo de Viagem */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-black dark:text-white uppercase mb-1 ml-2">Cód. Linha *</label>
                                <input className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formData.prefixo_linha || ''} onChange={e => setFormData({...formData, prefixo_linha: e.target.value})} placeholder="501" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-black dark:text-white uppercase mb-1 ml-2">Tipo de Estrada/Serviço *</label>
                                <select 
                                    className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-white" 
                                    value={formData.route_type || 'URBANO'} 
                                    onChange={e => setFormData({
                                        ...formData, 
                                        route_type: e.target.value as any,
                                        origin_station_id: undefined,
                                        origin_station_platform: undefined,
                                        destination_station_id: undefined,
                                        destination_station_platform: undefined
                                    })}
                                >
                                    <option value="URBANO">Urbano / Municipal</option>
                                    <option value="RODOVIARIA">Rodoviário</option>
                                    <option value="INTERMUNICIPAL">Intermunicipal / Linha</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-black dark:text-white uppercase mb-1 ml-2">Tempo de Viagem</label>
                                <input 
                                    className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 pointer-events-auto" 
                                    value={formData.estimated_travel_time_text || ''} 
                                    onChange={e => setFormData({...formData, estimated_travel_time_text: e.target.value})} 
                                    placeholder="Ex: 1h 30m ou 45 min" 
                                />
                            </div>
                        </div>

                        {/* terceira linha: Ponto de Origem, Rodoviária de Origem e Plataforma Origem */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-black dark:text-white uppercase mb-1 ml-2">Ponto de Origem *</label>
                                <input className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formData.origin || ''} onChange={e => setFormData({...formData, origin: e.target.value})} placeholder="ORIGEM" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-yellow-500 uppercase mb-1 ml-2">
                                  Rodoviária de Origem {formData.route_type === 'RODOVIARIA' || formData.route_type === 'INTERMUNICIPAL' ? '*' : '(Opcional)'}
                                </label>
                                <select 
                                    className="w-full px-5 py-4 border-2 border-yellow-500 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-white" 
                                    value={formData.origin_station_id || ''} 
                                    onChange={e => {
                                        const statId = e.target.value;
                                        setFormData({
                                            ...formData, 
                                            origin_station_id: statId,
                                            origin_station_platform: ''
                                        });
                                    }}
                                >
                                    <option value="">Selecione...</option>
                                    {busStations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-yellow-500 uppercase mb-1 ml-2">
                                  Plataforma Origem {formData.route_type === 'RODOVIARIA' || formData.route_type === 'INTERMUNICIPAL' ? '*' : '(Opcional)'}
                                </label>
                                <select 
                                    className="w-full px-5 py-4 border-2 border-yellow-500 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-white pb-3" 
                                    value={formData.origin_station_platform || ''} 
                                    onChange={e => setFormData({...formData, origin_station_platform: e.target.value})}
                                >
                                    <option value="">Selecione...</option>
                                    {(busStations.find(x => x.id === formData.origin_station_id)?.platforms || '')
                                      .split(',')
                                      .map(p => p.trim())
                                      .filter(Boolean)
                                      .map((p, idx) => <option key={`origin-platform-${p}-${idx}`} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* quarta linha: Ponto de Destino, Rodoviária de Destino e Plataforma Destino */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-black dark:text-white uppercase mb-1 ml-2">Ponto de Destino *</label>
                                <input className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formData.destination || ''} onChange={e => setFormData({...formData, destination: e.target.value})} placeholder="DESTINO" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-yellow-500 uppercase mb-1 ml-2">
                                  Rodoviária de Destino {formData.route_type === 'RODOVIARIA' || formData.route_type === 'INTERMUNICIPAL' ? '*' : '(Opcional)'}
                                </label>
                                <select 
                                    className="w-full px-5 py-4 border-2 border-yellow-500 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-white" 
                                    value={formData.destination_station_id || ''} 
                                    onChange={e => {
                                        const statId = e.target.value;
                                        setFormData({
                                            ...formData, 
                                            destination_station_id: statId,
                                            destination_station_platform: ''
                                        });
                                    }}
                                >
                                    <option value="">Selecione...</option>
                                    {busStations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-yellow-500 uppercase mb-1 ml-2">
                                  Plataforma Destino {formData.route_type === 'RODOVIARIA' || formData.route_type === 'INTERMUNICIPAL' ? '*' : '(Opcional)'}
                                </label>
                                <select 
                                    className="w-full px-5 py-4 border-2 border-yellow-500 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-white pb-3" 
                                    value={formData.destination_station_platform || ''} 
                                    onChange={e => setFormData({...formData, destination_station_platform: e.target.value})}
                                >
                                    <option value="">Selecione...</option>
                                    {(busStations.find(x => x.id === formData.destination_station_id)?.platforms || '')
                                      .split(',')
                                      .map(p => p.trim())
                                      .filter(Boolean)
                                      .map((p, idx) => <option key={`dest-platform-${p}-${idx}`} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* última linha: Tarifa Base, Pedágio, Taxa de Embarque e Tarifa Final */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-black dark:text-white uppercase mb-1 ml-2">Tarifa Base R$ *</label>
                                <input type="text" className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formatCurrencyValue(formData.price)} onChange={e => handleCurrencyChange(e.target.value, 'price')} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-black dark:text-white uppercase mb-1 ml-2">Pedágio R$</label>
                                <input type="text" className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formatCurrencyValue(formData.toll)} onChange={e => handleCurrencyChange(e.target.value, 'toll')} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-black dark:text-white uppercase mb-1 ml-2">Taxa de Embarque R$</label>
                                <input type="text" className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formatCurrencyValue(formData.boarding_fee)} onChange={e => handleCurrencyChange(e.target.value, 'boarding_fee')} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Tarifa Final R$</label>
                                <div className="w-full px-5 py-4 border-2 border-emerald-400 dark:border-emerald-600 rounded-2xl font-black bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
                                    {formatCurrencyValue((formData.price || 0) + (formData.toll || 0) + (formData.boarding_fee || 0) + (formData.fees || 0))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'horario' && (
                    <div className="space-y-8 animate-in fade-in">
                        {/* Seletor de Escopo do Horário */}
                        <div className="bg-amber-50 dark:bg-zinc-900/50 p-6 rounded-[2rem] border-2 border-yellow-400 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h4 className="text-sm font-black uppercase text-slate-800 dark:text-zinc-100">Escopo da Grade Horária</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Selecione se o horário adicionado refere-se à Rota Integral ou a uma Seção cadastrada</p>
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                                <select 
                                    className="px-6 py-4 bg-white dark:bg-zinc-800 border-2 border-yellow-400 rounded-2xl font-black text-xs uppercase text-slate-900 dark:text-white shadow-md outline-none cursor-pointer flex-1 md:flex-none min-w-[260px]"
                                    value={selectedScope}
                                    onChange={e => setSelectedScope(e.target.value)}
                                >
                                    <option value="">🎯 Rota Integral</option>
                                    {formData.sections && formData.sections.map((sec, idx) => (
                                        <option key={`opt-sec-${idx}`} value={sec.name}>
                                            📍 Seção {String(idx + 1).padStart(2, '0')}: {sec.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                                    <button 
                                        type="button"
                                        onClick={() => setSelectedScope('')}
                                        className={`px-4 py-3 rounded-xl font-black text-[9px] uppercase transition-all shrink-0 ${selectedScope === '' ? 'bg-yellow-400 text-slate-900 border-2 border-slate-950 shadow-md' : 'bg-white dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700'}`}
                                    >
                                        Rota Integral
                                    </button>
                                    {formData.sections && formData.sections.map((sec, idx) => (
                                        <button 
                                            type="button"
                                            key={`pill-sec-${idx}`}
                                            onClick={() => setSelectedScope(sec.name)}
                                            className={`px-4 py-3 rounded-xl font-black text-[9px] uppercase transition-all shrink-0 truncate max-w-[150px] ${selectedScope === sec.name ? 'bg-yellow-400 text-slate-900 border-2 border-slate-950 shadow-md' : 'bg-white dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700'}`}
                                            title={sec.name}
                                        >
                                            Seção {idx + 1}: {sec.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {['weekdays', 'saturday', 'sunday'].map(dayId => (
                            <div key={dayId} className="bg-slate-50 dark:bg-zinc-900 rounded-[2.5rem] p-8 border-2 border-slate-200 dark:border-zinc-800">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <h4 className="text-xl font-black text-indigo-500 uppercase">{dayId === 'weekdays' ? 'Dias Úteis' : dayId === 'saturday' ? 'Sábados' : 'Domingos'}</h4>
                                        {(() => {
                                            const totalCount = ((formData.schedule?.[dayId as keyof typeof formData.schedule] as any[]) || [])
                                                .filter(t => t.direction === selectedDirection && (t.section_name || '') === (selectedScope || ''))
                                                .length;
                                            return (
                                                <span className="px-3 py-1 bg-yellow-400 text-slate-900 border-2 border-slate-950 dark:border-zinc-800 font-extrabold text-[10px] rounded-full uppercase shadow-sm">
                                                    {totalCount} horário{totalCount !== 1 ? 's' : ''}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select 
                                            className="px-3 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-black text-[10px] dark:text-white"
                                            value={selectedDirection}
                                            onChange={e => setSelectedDirection(e.target.value as 'IDA' | 'VOLTA')}
                                        >
                                            <option value="IDA">IDA</option>
                                            <option value="VOLTA">VOLTA</option>
                                        </select>
                                        <input 
                                            type="time" 
                                            className="px-6 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-black text-xl dark:text-white w-40"
                                            value={newTimes[dayId as keyof typeof newTimes]}
                                            onChange={e => setNewTimes(prev => ({ ...prev, [dayId]: e.target.value }))}
                                        />
                                        <button onClick={() => addTime(dayId as any)} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg" title="Adicionar Horário Único"><Plus size={16}/></button>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowBulk(prev => ({ ...prev, [dayId]: !prev[dayId] }))} 
                                            className={`p-3 rounded-xl shadow-lg transition-all ${showBulk[dayId as keyof typeof showBulk] ? 'bg-yellow-400 text-slate-900 border-2 border-slate-950' : 'bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:text-zinc-300 text-slate-700'}`}
                                            title="Importação em Massa"
                                        >
                                            <FileSpreadsheet size={16}/>
                                        </button>
                                    </div>
                                </div>

                                {showBulk[dayId as keyof typeof showBulk] && (
                                    <div className="mb-6 p-5 bg-white dark:bg-zinc-800 border-2 border-dashed border-yellow-400 rounded-3xl animate-in fade-in zoom-in-95">
                                        <div className="flex justify-between items-center mb-3">
                                            <label className="text-[11px] font-black uppercase text-indigo-500 tracking-wider">Importação Rápida em Massa ({selectedScope ? `Seção: ${selectedScope}` : 'Rota Integral'})</label>
                                            <button 
                                                type="button" 
                                                onClick={() => setShowBulk(prev => ({ ...prev, [dayId]: false }))} 
                                                className="text-[9px] font-black text-red-500 uppercase hover:underline"
                                            >
                                                Fechar
                                            </button>
                                        </div>
                                        <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase font-bold mb-3">Insira horários separados por espaço, vírgula ou quebra de linha. Exemplo: 06:15, 07:30, 08:45, 10:00</p>
                                        <div className="flex gap-3">
                                            <textarea 
                                                rows={2}
                                                className="flex-1 px-4 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-black text-[11px] dark:text-white uppercase placeholder-slate-300 focus:border-yellow-400 outline-none transition-all resize-none"
                                                placeholder="Ex: 06:00, 08:30, 12:15, 15:45, 20:00"
                                                value={bulkInput[dayId as keyof typeof bulkInput]}
                                                onChange={e => setBulkInput(prev => ({ ...prev, [dayId]: e.target.value }))}
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => addBulkTimes(dayId as any)}
                                                className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-wider shadow-lg transition-all self-end"
                                            >
                                                Importar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-3">
                                    {(formData.schedule?.[dayId as keyof typeof formData.schedule] || [])
                                      .filter(t => t.direction === selectedDirection && (t.section_name || '') === (selectedScope || ''))
                                      .map((item, idx) => (
                                        <div key={idx} className="px-5 py-3 bg-white dark:bg-zinc-800 rounded-xl border-2 shadow-sm flex flex-col min-w-[120px] justify-between transition-all hover:border-yellow-400">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-xl font-black font-mono dark:text-zinc-100">{item.time}</span>
                                                <button onClick={() => removeTime(dayId as any, item.time, item.direction, item.section_name)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                                            </div>
                                            <span className={`text-[8px] font-black uppercase mt-1 ${item.section_name ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                {item.section_name ? `Seção: ${item.section_name}` : 'Rota Integral'}
                                            </span>
                                        </div>
                                    ))}
                                    {(formData.schedule?.[dayId as keyof typeof formData.schedule] || [])
                                      .filter(t => t.direction === selectedDirection && (t.section_name || '') === (selectedScope || '')).length === 0 && (
                                        <p className="text-[10px] font-black text-slate-400 uppercase italic py-2">Nenhum horário cadastrado para {selectedScope ? `seção "${selectedScope}"` : 'rota integral'} nesta direção.</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {activeTab === 'secoes' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="bg-slate-50 dark:bg-zinc-900 p-8 rounded-[2.5rem] border-2 border-slate-200 dark:border-zinc-800">
                            <h4 className="text-xl font-black text-indigo-500 uppercase mb-6 flex items-center gap-2"><Plus size={20}/> Nova Seção</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="lg:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Nome da Seção</label>
                                    <div className="flex gap-2">
                                        <input 
                                            id="new-section-name"
                                            className="flex-1 px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-white dark:bg-zinc-800 dark:text-zinc-100 placeholder:text-slate-300" 
                                            placeholder="EX: SEÇÃO CENTRO"
                                            onKeyPress={e => {
                                                if (e.key === 'Enter') {
                                                    handleAddSection();
                                                }
                                            }}
                                        />
                                        <button 
                                            onClick={() => handleAddSection()}
                                            className="px-6 py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-[10px] border-2 border-slate-900"
                                        >
                                            Adicionar
                                        </button>
                                    </div>
                                    <p className="mt-2 text-[8px] font-black text-slate-400 uppercase ml-2 italic">Preencha o nome e clique em Adicionar ou pressione ENTER</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Origem</label>
                                    <input className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold dark:text-white" defaultValue={formData.origin || ''} id="sec-origin" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Destino</label>
                                    <input className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold dark:text-white" defaultValue={formData.destination || ''} id="sec-dest" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {(formData.sections || []).length === 0 ? (
                                <div className="text-center py-12 border-4 border-dashed border-slate-100 dark:border-zinc-900 rounded-[3rem]">
                                    <ListChecks size={48} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-sm font-black text-slate-300 uppercase">Nenhuma seção cadastrada</p>
                                </div>
                            ) : (
                                (formData.sections || []).map((section, idx) => (
                                    <div key={idx} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 flex justify-between items-center group hover:border-yellow-400 transition-all">
                                        <div className="flex items-center gap-6">
                                            <div className="w-10 h-10 bg-slate-900 text-yellow-400 rounded-full flex items-center justify-center font-black">{idx + 1}</div>
                                            <div>
                                                <h5 className="font-black text-sm uppercase italic dark:text-white">{section.name}</h5>
                                                <p className="text-[10px] font-black text-slate-400 uppercase">{section.origin} <ArrowRight size={10} className="inline mx-1"/> {section.destination}</p>
                                                <div className="mt-1 flex gap-2">
                                                    <span className="text-[7px] font-black text-slate-400 uppercase bg-slate-100 dark:bg-zinc-800 px-2 rounded">Pedágio: R$ {(formData.toll || 0).toFixed(2)}</span>
                                                    <span className="text-[7px] font-black text-slate-400 uppercase bg-slate-100 dark:bg-zinc-800 px-2 rounded">Taxas: R$ {((formData.boarding_fee || 0) + (formData.fees || 0)).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Preço Final Seção</p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-sm font-black text-slate-400">R$</span>
                                                    <input 
                                                        type="number"
                                                        step="0.01"
                                                        value={section.price}
                                                        onChange={e => {
                                                            const newSections = [...(formData.sections || [])];
                                                            newSections[idx] = { ...section, price: parseFloat(e.target.value) || 0 };
                                                            setFormData({ ...formData, sections: newSections });
                                                        }}
                                                        className="w-32 px-4 py-2 text-right font-black text-lg text-emerald-600 dark:text-emerald-400 bg-slate-50 dark:bg-zinc-850 border-2 border-emerald-400 dark:border-emerald-600 hover:border-emerald-500 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm transition-all"
                                                    />
                                                </div>
                                                <p className="text-[7px] font-black text-indigo-500 uppercase mt-1">
                                                    Equiv. Base: R$ {Math.max(0, (section.price || 0) - (formData.toll || 0) - (formData.boarding_fee || 0) - (formData.fees || 0)).toFixed(2)}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    const newSections = [...(formData.sections || [])];
                                                    newSections.splice(idx, 1);
                                                    setFormData({ ...formData, sections: newSections });
                                                }}
                                                className="p-3 bg-red-50 text-red-600 rounded-xl transition-all hover:bg-red-600 hover:text-white"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'letreiro' && (
                    <div className="space-y-8 animate-in fade-in">
                        {/* Digital Sign Preview */}
                        <div className="bg-slate-950 p-6 md:p-8 rounded-[3.5rem] border-8 border-slate-800 shadow-2xl relative overflow-hidden group">
                           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none"></div>
                           
                           {/* Style tag for marquee animation */}
                           <style dangerouslySetInnerHTML={{__html: `
                             @keyframes letreiro-marquee {
                               0% { transform: translateX(100%); }
                               100% { transform: translateX(-100%); }
                             }
                             .letreiro-rolante {
                               display: inline-block;
                               white-space: nowrap;
                               animation: letreiro-marquee 10s linear infinite;
                             }
                           `}} />

                           <div className="relative z-10 flex flex-row items-center min-h-[140px] w-full font-pixel gap-4">
                               {/* Cód. Linha Block on the left side */}
                               {formData.exibir_codigo_letreiro && formData.prefixo_linha && (
                                   <div className="flex-shrink-0 flex items-center justify-center px-4 py-4 md:px-6 md:py-6 border-r-4 border-dashed border-slate-800 max-h-[120px] bg-slate-900 rounded-2xl select-none">
                                       <span 
                                           className="text-5xl md:text-6xl font-normal tracking-wider text-yellow-400 font-pixel"
                                           style={{ textShadow: '0 0 16px #facc15' }}
                                       >
                                           {formData.prefixo_linha}
                                       </span>
                                   </div>
                               )}
                               
                               {/* Rest of space for Destination slides */}
                               <div className="flex-1 overflow-hidden relative flex items-center justify-start min-h-[120px] w-full">
                                   <AnimatePresence mode="wait">
                                       <div 
                                          key={currentSignIdx}
                                          className="w-full flex items-center justify-start font-pixel text-yellow-400"
                                       >
                                          {activeSigns[currentSignIdx % activeSigns.length].modo === 'ROLANTE' ? (
                                              <div className="w-full overflow-hidden text-left py-2">
                                                  <span 
                                                     className="letreiro-rolante text-6xl sm:text-7xl md:text-8xl font-bold uppercase tracking-wider text-yellow-400 font-pixel"
                                                     style={{ textShadow: '0 0 20px #facc15' }}
                                                  >
                                                      {activeSigns[currentSignIdx % activeSigns.length].text}
                                                  </span>
                                              </div>
                                          ) : (
                                              <span 
                                                 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold uppercase tracking-wider text-yellow-400 font-pixel text-left text-ellipsis overflow-hidden px-2"
                                                 style={{ textShadow: '0 0 20px #facc15' }}
                                              >
                                                  {activeSigns[currentSignIdx % activeSigns.length].text}
                                              </span>
                                          )}
                                       </div>
                                   </AnimatePresence>
                               </div>
                           </div>
                           
                           <div className="mt-2 flex gap-2 justify-center">
                               {activeSigns.map((_, i) => (
                                   <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === (currentSignIdx % activeSigns.length) ? 'w-8 bg-slate-100 shadow-[0_0_10px_rgba(241,245,249,0.8)]' : 'w-2 bg-slate-800'}`}></div>
                               ))}
                           </div>
                           
                           <div className="absolute bottom-4 right-8 text-[8px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                               <Zap size={10} /> Digital Signage Pro
                           </div>
                        </div>

                        {/* Controles do Preview do Painel */}
                        <div className="bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 p-6 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex flex-col justify-center">
                                <label className="text-xs font-black uppercase dark:text-white">Exibir Cód. Linha no Letreiro</label>
                                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Insere o código '{formData.prefixo_linha || 'N/A'}' no letreiro digital da rota</p>
                            </div>
                            <div className="mt-3 md:mt-0 flex gap-2">
                                <button 
                                    type="button"
                                    onClick={() => setFormData({...formData, exibir_codigo_letreiro: true})}
                                    className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${formData.exibir_codigo_letreiro ? 'bg-yellow-400 text-slate-900 shadow-md border-2 border-slate-900' : 'bg-white dark:bg-zinc-800 text-slate-400 border border-slate-200'}`}
                                >
                                    Exibir Código
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setFormData({...formData, exibir_codigo_letreiro: false})}
                                    className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${!formData.exibir_codigo_letreiro ? 'bg-yellow-400 text-slate-900 shadow-md border-2 border-slate-900' : 'bg-white dark:bg-zinc-800 text-slate-400 border border-slate-200'}`}
                                >
                                    Não Exibir
                                </button>
                            </div>
                        </div>

                        {/* Sign Configuration */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-full bg-slate-50 dark:bg-zinc-900 p-8 rounded-[2.5rem] border-2 border-yellow-400">
                                <h4 className="text-sm font-black uppercase italic mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                                   <Type size={18} className="text-yellow-500" /> Letreiro Principal
                                </h4>
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                    <div className="lg:col-span-9">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Mensagem Principal</label>
                                        <input 
                                            className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-white dark:bg-zinc-800 dark:text-zinc-100" 
                                            value={formData.letreiro_principal || ''} 
                                            onChange={e => setFormData({...formData, letreiro_principal: e.target.value.toUpperCase()})}
                                            placeholder="DESTINO FINAL"
                                        />
                                    </div>
                                    <div className="lg:col-span-3">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Efeito</label>
                                        <select className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold bg-white dark:bg-zinc-800 dark:text-zinc-100" value={formData.letreiro_principal_modo} onChange={e => setFormData({...formData, letreiro_principal_modo: e.target.value as any})}>
                                            <option value="FIXO">FIXO</option>
                                            <option value="ROLANTE">ROLANTE</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-[2.5rem] border-2 border-slate-100 dark:border-zinc-800">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
                                       <Binary size={14} /> Via Alternativa {i}
                                    </h4>
                                    <div className="space-y-4">
                                        <input 
                                            className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold bg-white dark:bg-zinc-800 dark:text-zinc-100" 
                                            value={(formData as any)[`via${i}`] || ''} 
                                            onChange={e => setFormData({...formData, [`via${i}`]: e.target.value.toUpperCase()})}
                                            placeholder={`FRASE VIA ${i}`}
                                        />
                                        <div className="flex flex-col gap-2">
                                            <select className="w-full px-5 py-3 border-2 border-slate-100 dark:border-zinc-700 rounded-xl font-bold bg-white dark:bg-zinc-800 dark:text-zinc-100 text-[10px]" value={(formData as any)[`via${i}_modo`]} onChange={e => setFormData({...formData, [`via${i}_modo`]: e.target.value})}>
                                                <option value="FIXO">FIXO</option>
                                                <option value="ROLANTE">ROLANTE</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-8 border-t-2 border-yellow-400 bg-slate-50 dark:bg-zinc-900 flex gap-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                <button onClick={handleSave} className="flex-[2] py-4 bg-yellow-400 text-slate-900 rounded-[2rem] font-black uppercase text-xs shadow-xl border-2 border-slate-900 flex items-center justify-center gap-2"><Save size={20}/> Gravar Itinerário</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteManager;
