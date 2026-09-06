import React, { useState, useEffect, useMemo } from 'react';
import { db, supabase } from '../services/database';
import { Trip, BusRoute, TicketSale, PassengerDetails, Company, City, RoleConfig, TicketingConfig, VehicleClass, User, Vehicle } from '../types';
import { Bus, CheckCircle2, AlertTriangle, Fuel, Gauge, FileText, DollarSign, Droplets, Lightbulb, Disc, Sparkles, Save, Loader2, Plus, UserPlus, X, Briefcase, Hash, MapPin, Building2, Info, UserCheck, Users, PlayCircle, Clock, Zap, Armchair, Send, Printer, Layout, ArrowRight } from 'lucide-react';
import { useTicketSales } from '../hooks/useTicketSales';

interface DailyLogManagerProps {
  currentUser: User | null;
  vehicles: Vehicle[];
  drivers: User[];
  companies: Company[];
  cities: City[];
  routes: BusRoute[];
  trips: Trip[];
  roleConfigs: RoleConfig[];
  ticketingConfig: TicketingConfig | null;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}

const VEHICLE_CLASSES: { id: VehicleClass, label: string }[] = [
    { id: 'CONVENCIONAL', label: 'Convencional' },
    { id: 'CONVENCIONAL_DD', label: 'Convencional DD' },
    { id: 'EXECUTIVO', label: 'Executivo' },
    { id: 'EXECUTIVO_DD', label: 'Executivo DD' },
    { id: 'LEITO', label: 'Leito' },
    { id: 'LEITO_DD', label: 'Leito DD' },
    { id: 'SEMI_LEITO', label: 'Semi-Leito' },
    { id: 'SEMI_LEITO_DD', label: 'Semi-Leito DD' },
    { id: 'URBANO', label: 'Urbano' },
    { id: 'CAMA', label: 'Cama' }
];

const DailyLogManager: React.FC<DailyLogManagerProps> = ({ 
  currentUser, 
  vehicles, 
  drivers,
  companies,
  cities,
  routes,
  trips = [],
  roleConfigs,
  ticketingConfig,
  addToast 
}) => {
  const isOperational = currentUser?.role === 'DRIVER' || currentUser?.role === 'CONDUCTOR';
  const [activeTab, setActiveTab] = useState<'departure' | 'arrival' | 'operation'>(isOperational ? 'operation' : 'departure');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState(currentUser?.id || '');
  const [selectedFiscalId, setSelectedFiscalId] = useState('');

  // Operation View State
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [manualPaymentMethod, setManualPaymentMethod] = useState('');
  const [selectedSectionIdx, setSelectedSectionIdx] = useState<number | null>(null);

  const activeTrip = useMemo(() => trips.find(t => t.id === activeTripId), [trips, activeTripId]);
  const activeRoute = useMemo(() => activeTrip ? routes.find(r => r.id === activeTrip.route_id) : null, [activeTrip, routes]);

  const { 
    sales, 
    isLoading: isSalesLoading, 
    saleAlert, 
    fetchSales, 
    processBordoSale 
  } = useTicketSales(activeTripId, currentUser, activeRoute);

  useEffect(() => {
    // Pre-define driver, vehicle and fiscal based on schedule
    if (trips.length > 0 && currentUser) {
      const today = new Date().toISOString().split('T')[0];
      // Find today's trip for this user
      const todayTrip = trips.find(t => 
        t.trip_date === today && 
        (t.driver_id === currentUser.id || t.conductor_id === currentUser.id)
      );

      if (todayTrip) {
        if (!selectedDriverId) setSelectedDriverId(currentUser.id);
        
        // Find vehicle by bus_number (prefix)
        const vehicle = vehicles.find(v => v.prefix === todayTrip.bus_number);
        if (vehicle && !selectedVehicleId) {
          setSelectedVehicleId(vehicle.id);
        }

        // Pre-define fiscal if available in trip
        if (todayTrip.fiscal_id && !selectedFiscalId) {
          setSelectedFiscalId(todayTrip.fiscal_id);
        }
      }
    }
  }, [trips, currentUser, vehicles, selectedDriverId, selectedVehicleId, selectedFiscalId]);

  useEffect(() => {
    const sub = db.subscribeTables(['driver_logs', 'trips', 'ticket_sales', 'notifications', 'vehicles'], () => {
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
    });
    return () => sub.unsubscribe();
  }, []);

  const handleProcessBordoSale = async () => {
    if (!activeTripId || !manualPaymentMethod) return;
    
    const result = await processBordoSale(manualPaymentMethod, selectedSectionIdx);
    
    if (result?.success) {
        addToast("Venda de bordo registrada com sucesso!", "success");
        setManualPaymentMethod('');
        setSelectedSectionIdx(null);
    } else if (result?.error) {
        addToast(result.error, "error");
    }
  };

  const handleStartTrip = async (trip: Trip) => {
    const now = new Date();
    setIsLoading(true);
    try {
        await db.update('trips', { 
            id: trip.id,
            status: 'Em Rota', 
            actual_start_time: now.toISOString() 
        } as any);

        // Automatic Exit Log
        const vehicle = vehicles.find(v => v.prefix === trip.bus_number);
        await db.create('driver_logs', {
            driver_id: currentUser?.id,
            user_id: currentUser?.id,
            created_by: currentUser?.id,
            vehicle_id: vehicle?.id,
            odometer_start: trip.initial_odometer || (vehicle as any)?.odometer || (vehicle as any)?.current_km || 0,
            created_at: now.toISOString(),
            status: 'OPEN',
            system_id: currentUser?.system_id || db.getSystemId(),
            notes: `Início automático via DailyLogManager - Viagem ${trip.id}`
        });
        
        // Calculate delay
        const planned = new Date(`${trip.trip_date}T${trip.departure_time}`);
        const diffMinutes = (now.getTime() - planned.getTime()) / (1000 * 60);
        
        if (diffMinutes > 15) { // More than 15 min delay
            await db.create('notifications', {
                title: 'Aviso de Atraso',
                message: `O veículo ${trip.bus_number} da rota ${activeRoute?.prefixo_linha} está com atraso de ${Math.round(diffMinutes)} minutos na partida.`,
                type: 'WARNING',
                category: 'SCHEDULE',
                target_role: 'PASSENGER',
                is_read: false,
                user_id: currentUser?.id,
                created_by: currentUser?.id,
                system_id: currentUser?.system_id || db.getSystemId(),
                created_at: now.toISOString()
            });
            addToast("Notificação de atraso enviada aos passageiros.", "warning");
        }

        setActiveTripId(trip.id);
        addToast("Viagem iniciada com sucesso!", "success");
    } catch (e: any) {
        addToast(e.message, "error");
    } finally {
        setIsLoading(false);
    }
  };

  // Confirmation State
  const [isVehicleConfirmed, setIsVehicleConfirmed] = useState<boolean | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const allVehicleClasses = useMemo(() => {
    const base = [...VEHICLE_CLASSES];
    if (ticketingConfig?.custom_vehicle_classes) {
      ticketingConfig.custom_vehicle_classes.forEach(cvc => {
        if (!base.some(b => b.id === cvc.id)) {
          base.push(cvc as any);
        }
      });
    }
    return base;
  }, [ticketingConfig?.custom_vehicle_classes]);
  
  // Departure State
  const [odometerStart, setOdometerStart] = useState<number | ''>('');
  const [fuelLevel, setFuelLevel] = useState('FULL');
  const [tireOk, setTireOk] = useState(false);
  const [lightsOk, setLightsOk] = useState(false);
  const [oilWaterOk, setOilWaterOk] = useState(false);
  const [cleaningOk, setCleaningOk] = useState(false);
  const [damageReportStart, setDamageReportStart] = useState('');

  // Arrival State
  const [odometerEnd, setOdometerEnd] = useState<number | ''>('');
  const [damageReport, setDamageReport] = useState('');
  const [tollExpenses, setTollExpenses] = useState<number | ''>('');

  // Turnstile state
  const [turnstileStart, setTurnstileStart] = useState<number | ''>('');
  const [turnstileEnd, setTurnstileEnd] = useState<number | ''>('');

  const selectedVehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicleId), [vehicles, selectedVehicleId]);
  const isUrbanVehicle = useMemo(() => selectedVehicle?.vehicle_class === 'URBANO', [selectedVehicle]);

  useEffect(() => {
    if (selectedVehicleId && activeTab === 'departure') {
        const vehicle = vehicles.find(v => v.id === selectedVehicleId);
        if (vehicle) {
            // We usually fetch the last odometer from driver_logs or vehicle master.
            // For now, let's assume vehicle object has or we can use current_turnstile_count
            if (vehicle.current_turnstile_count !== undefined) {
                setTurnstileStart(vehicle.current_turnstile_count);
            }
        }
    }
  }, [selectedVehicleId, activeTab, vehicles]);

  const handleDepartureSubmit = async () => {
    if (!selectedDriverId || selectedDriverId === '') return addToast("Selecione um motorista.", "error");
    if (!selectedVehicleId || selectedVehicleId === '') return addToast("Selecione um veículo.", "error");
    if (!selectedFiscalId || selectedFiscalId === '') return addToast("Selecione o fiscal de pátio.", "error");
    if (isVehicleConfirmed === false && !rejectionReason) return addToast("Informe o motivo da divergência do veículo.", "warning");
    if (odometerStart === '' || odometerStart < 0) return addToast("Informe o KM inicial válido.", "warning");

    setIsLoading(true);
    try {
      const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
      const selectedDriver = drivers.find(d => d.id === selectedDriverId);
      
      const payload: any = {
        driver_id: selectedDriverId,
        user_id: currentUser?.id,
        created_by: currentUser?.id,
        vehicle_id: selectedVehicleId,
        fiscal_id: selectedFiscalId,
        odometer_start: Number(odometerStart),
        turnstile_start: turnstileStart !== '' ? Number(turnstileStart) : null,
        fuel_level_start: fuelLevel,
        tire_condition_ok: tireOk,
        lights_condition_ok: lightsOk,
        oil_water_ok: oilWaterOk,
        internal_cleaning_ok: cleaningOk,
        damage_details: damageReportStart,
        vehicle_confirmed: isVehicleConfirmed,
        rejection_reason: rejectionReason,
        system_id: currentUser?.system_id || db.getSystemId(),
        created_at: new Date().toISOString(),
        status: 'OPEN',
        // Requested fields for Dispatcher
        line_code: 'LOG-DEP', // Default or derived if possible
        vehicle_plate: selectedVehicle?.plate || '',
        driver_name: selectedDriver?.full_name || '',
        occurrence_type: isVehicleConfirmed === false ? 'Divergência de Veículo' : 'Normal',
        notes: rejectionReason || 'Saída de pátio confirmada'
      };

      await db.create('driver_logs', payload);

      // Notify dispatcher if vehicle rejected
      if (isVehicleConfirmed === false) {
        await db.create('notifications', {
          title: 'Divergência de Veículo',
          message: `O motorista ${drivers.find(d => d.id === selectedDriverId)?.full_name} rejeitou o veículo ${vehicles.find(v => v.id === selectedVehicleId)?.prefix}. Motivo: ${rejectionReason}`,
          type: 'WARNING',
          category: 'MAINTENANCE',
          target_role: 'DISPATCHER',
          is_read: false,
          user_id: currentUser?.id,
          created_by: currentUser?.id,
          system_id: currentUser?.system_id || db.getSystemId(),
          created_at: new Date().toISOString()
        });
        addToast("Despachante notificado sobre a divergência.", "warning");
      }

      addToast("Checklist de Saída registrado com sucesso!", "success");
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      setOdometerStart('');
      setTireOk(false);
      setLightsOk(false);
      setOilWaterOk(false);
      setCleaningOk(false);
      setDamageReportStart('');
      setIsVehicleConfirmed(null);
      setRejectionReason('');
    } catch (error: any) {
      console.error("Erro ao salvar checklist de saída:", error);
      addToast(error?.message || "Erro ao salvar dados.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleArrivalSubmit = async () => {
    if (!selectedDriverId || selectedDriverId === '') return addToast("Selecione um motorista.", "error");
    if (!selectedVehicleId || selectedVehicleId === '') return addToast("Selecione um veículo.", "error");
    if (odometerEnd === '' || odometerEnd < 0) return addToast("Informe o KM final válido.", "warning");
    
    if (odometerStart !== '' && Number(odometerEnd) < Number(odometerStart)) {
        return addToast("KM Final não pode ser menor que o KM Inicial.", "error");
    }

    setIsLoading(true);
    try {
      const payload: any = {
        driver_id: selectedDriverId,
        user_id: currentUser?.id,
        created_by: currentUser?.id,
        vehicle_id: selectedVehicleId,
        odometer_end: Number(odometerEnd),
        turnstile_end: turnstileEnd !== '' ? Number(turnstileEnd) : null,
        damage_details: damageReport,
        toll_expenses: Number(tollExpenses) || 0,
        system_id: currentUser?.system_id || db.getSystemId(),
        created_at: new Date().toISOString(),
        type: 'ARRIVAL'
      };

      await db.create('driver_logs', payload);

      // Sync turnstile back to vehicle if provided
      if (turnstileEnd !== '' && selectedVehicleId) {
        await db.update('vehicles', { id: selectedVehicleId, current_turnstile_count: Number(turnstileEnd) } as any);
      }

      addToast("Fechamento de Viagem registrado com sucesso!", "success");
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      setOdometerEnd('');
      setTurnstileEnd('');
      setDamageReport('');
      setTollExpenses('');
    } catch (error: any) {
      console.error("Erro ao salvar fechamento:", error);
      addToast(error?.message || "Erro ao salvar dados.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500 pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-black uppercase italic text-slate-900 dark:text-white">Diário de Bordo</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle de Jornada e Veículos</p>
            </div>
            <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-2xl overflow-x-auto no-scrollbar">
                {isOperational && (
                    <button 
                        onClick={() => setActiveTab('operation')} 
                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'operation' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                    >
                        Operação
                    </button>
                )}
                <button 
                    onClick={() => setActiveTab('departure')} 
                    className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'departure' ? 'bg-yellow-400 text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                >
                    Saída
                </button>
                <button 
                    onClick={() => setActiveTab('arrival')} 
                    className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'arrival' ? 'bg-yellow-400 text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                >
                    Chegada
                </button>
            </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2.5rem] shadow-xl border-2 border-slate-100 dark:border-zinc-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Motorista</label>
                    <div className="relative">
                        <FileText className="absolute left-4 top-4 text-slate-400" size={20}/>
                        <select 
                            value={selectedDriverId || ''} 
                            onChange={e => setSelectedDriverId(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold uppercase text-xs outline-none focus:border-yellow-400 transition-all dark:text-white appearance-none"
                        >
                            <option value="">Selecione o Colaborador...</option>
                            {drivers.filter(d => d.role === 'DRIVER' || d.role === 'CONDUCTOR' || d.job_title?.includes('Motorista') || d.job_title?.includes('Cobrador')).map(d => (
                                <option key={d.id} value={d.id}>{d.full_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Veículo</label>
                    <div className="relative">
                        <Bus className="absolute left-4 top-4 text-slate-400" size={20}/>
                        <select 
                            value={selectedVehicleId || ''} 
                            onChange={e => setSelectedVehicleId(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold uppercase text-xs outline-none focus:border-yellow-400 transition-all dark:text-white appearance-none"
                        >
                            <option value="">Selecione o Veículo...</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>{v.prefix} - {v.plate} ({allVehicleClasses.find(c => c.id === v.vehicle_class)?.label || v.vehicle_class})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Fiscal de Pátio</label>
                    <div className="relative">
                        <UserCheck className="absolute left-4 top-4 text-slate-400" size={20}/>
                        <select 
                            value={selectedFiscalId || ''} 
                            onChange={e => setSelectedFiscalId(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold uppercase text-xs outline-none focus:border-yellow-400 transition-all dark:text-white appearance-none"
                        >
                            <option value="">Selecione o Fiscal...</option>
                            {drivers.filter(d => d.role === 'FISCAL' || d.job_title?.includes('Fiscal')).map(d => (
                                <option key={d.id} value={d.id}>{d.full_name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {activeTab === 'operation' ? (
                <div className="space-y-8 animate-in fade-in duration-500">
                    {saleAlert && (
                        <div className="fixed top-24 right-8 z-[100] bg-indigo-600 text-white p-6 rounded-3xl shadow-2xl border-4 border-white animate-bounce flex items-center gap-4">
                            <Zap className="text-yellow-300 fill-current" size={32}/>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Alerta de Venda</p>
                                <p className="text-xl font-black italic">Nova passagem: Poltrona {saleAlert.seat}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Driver Side */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                                    <Layout size={24}/>
                                </div>
                                <h3 className="text-xl font-black uppercase italic text-slate-900 dark:text-white">Área do Motorista</h3>
                            </div>

                            {!activeTripId ? (
                                <div className="bg-slate-50 dark:bg-zinc-900 rounded-[2.5rem] p-8 border-2 border-slate-100 dark:border-zinc-800">
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">Viagens do Dia</p>
                                    <div className="space-y-4">
                                        {trips
                                          .filter(t => !isOperational || t.driver_id === currentUser?.id || t.conductor_id === currentUser?.id)
                                          .sort((a,b) => a.departure_time.localeCompare(b.departure_time))
                                          .map(trip => {
                                             const route = routes.find(r => r.id === trip.route_id);
                                             return (
                                                 <div key={trip.id} className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-700 flex items-center justify-between group hover:border-indigo-400 transition-all">
                                                     <div className="flex items-center gap-4">
                                                         <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center text-slate-400">
                                                            <Clock size={24}/>
                                                         </div>
                                                         <div>
                                                             <p className="text-sm font-black dark:text-white uppercase leading-none mb-1">{route?.origin} <ArrowRight className="inline mx-1 text-indigo-500" size={14}/> {route?.destination}</p>
                                                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Partida Prevista: {trip.departure_time}</p>
                                                         </div>
                                                     </div>
                                                     <button 
                                                        onClick={() => handleStartTrip(trip)}
                                                        className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center gap-2"
                                                     >
                                                        Partida <Send size={14}/>
                                                     </button>
                                                 </div>
                                             );
                                          })
                                        }
                                        {trips.length === 0 && <p className="text-xs text-slate-400 italic text-center py-10">Nenhuma viagem agendada...</p>}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-indigo-600 text-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden">
                                        <div className="absolute right-[-20px] top-[-20px] opacity-10 rotate-12">
                                            <Bus size={150} />
                                        </div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">Viagem em Curso</h4>
                                        <h2 className="text-3xl font-black italic mb-2 leading-none uppercase tracking-tighter">
                                            {activeRoute?.origin} <ArrowRight className="inline mx-2" size={24}/> {activeRoute?.destination}
                                        </h2>
                                        <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Veículo: {activeTrip?.bus_number} • Motorista: {currentUser?.full_name}</p>
                                        
                                        <div className="mt-8 flex gap-4">
                                            <button 
                                                onClick={() => setActiveTripId(null)}
                                                className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
                                            >
                                                Trocar Viagem
                                            </button>
                                        </div>
                                    </div>

                                    {/* Road Driver Specific: Manifest & Seat Map */}
                                    {activeRoute?.route_type === 'RODOVIARIA' && (
                                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-zinc-800 shadow-xl">
                                                <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 flex items-center gap-2"><Users size={16}/> Manifesto de Passageiros</h4>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="border-b border-slate-100 dark:border-zinc-800">
                                                                <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Nome</th>
                                                                <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Documento</th>
                                                                <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Nascimento</th>
                                                                <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Seat</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/50">
                                                            {sales.map(sale => (
                                                                <tr key={sale.id} className="group">
                                                                    <td className="py-4 text-xs font-black text-slate-700 dark:text-zinc-300 uppercase">{sale.passenger_name}</td>
                                                                    <td className="py-4 text-xs font-bold text-slate-400 tracking-tighter">{sale.passenger_cpf}</td>
                                                                    <td className="py-4 text-xs font-bold text-slate-400">{sale.passenger_birth}</td>
                                                                    <td className="py-4 text-center">
                                                                        <span className="w-8 h-8 bg-slate-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-[10px] font-black dark:text-white border border-slate-200 dark:border-zinc-700 mx-auto">
                                                                            {sale.seat_number}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-zinc-800 shadow-xl">
                                                <h4 className="text-[10px] font-black uppercase text-slate-400 mb-8 flex items-center gap-2"><Armchair size={16}/> Mapa de Assentos Dinâmico</h4>
                                                <div className="relative bg-slate-50 dark:bg-zinc-950 p-12 rounded-[2.5rem] border-4 border-slate-100 dark:border-zinc-800">
                                                    {/* Bus Body Decoration */}
                                                    <div className="absolute top-0 left-0 w-full h-8 bg-slate-200 dark:bg-zinc-800 rounded-t-[2.5rem] flex items-center justify-center">
                                                        <div className="w-12 h-1 bg-slate-300 dark:bg-zinc-700 rounded-full"/>
                                                    </div>

                                                    <div className="grid grid-cols-4 gap-4">
                                                        {Array.from({ length: 44 }).map((_, i) => {
                                                            const seatNum = i + 1;
                                                            const isSold = sales.some(s => s.seat_number === seatNum);
                                                            return (
                                                                <div 
                                                                    key={i} 
                                                                    className={`aspect-square rounded-xl flex items-center justify-center text-[10px] font-black border-2 transition-all ${isSold ? 'bg-red-500 border-red-600 text-white shadow-lg scale-95' : 'bg-emerald-100 border-emerald-400 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-800'}`}
                                                                >
                                                                    {seatNum}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Conductor Side */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
                                    <DollarSign size={24}/>
                                </div>
                                <h3 className="text-xl font-black uppercase italic text-slate-900 dark:text-white">Área do Cobrador</h3>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-zinc-800 shadow-xl">
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">Trechos e Tarifas</p>
                                 <div className="space-y-4">
                                    {(activeRoute?.sections || []).length > 0 ? activeRoute?.sections?.map((section, idx) => (
                                        <button 
                                            key={idx} 
                                            onClick={() => setSelectedSectionIdx(idx)}
                                            className={`w-full p-6 rounded-3xl border-2 transition-all flex items-center justify-between text-left ${selectedSectionIdx === idx ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-500/20' : 'bg-slate-50 border-slate-100 dark:bg-zinc-800 dark:border-zinc-700 hover:border-emerald-300'}`}
                                        >
                                            <div>
                                                <p className="text-sm font-black dark:text-white uppercase leading-none mb-1">{section.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{section.origin} ➜ {section.destination}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-emerald-500 leading-none mb-1">R$ {section.price.toFixed(2)}</p>
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">TARIFA TRECHO</p>
                                            </div>
                                        </button>
                                    )) : (
                                        <div className="bg-slate-50 dark:bg-zinc-800 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-700 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-black dark:text-white uppercase leading-none mb-1">Tarifa Integral</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Linha {activeRoute?.prefixo_linha || '000'}</p>
                                            </div>
                                            <p className="text-lg font-black text-emerald-500">R$ {activeRoute?.price.toFixed(2) || '0.00'}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8 pt-8 border-t-2 border-slate-50 dark:border-zinc-800">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 ml-2">Forma de Pagamento</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {(ticketingConfig?.payment_methods_config || []).map(method => (
                                            <button 
                                                key={method.id}
                                                onClick={() => setManualPaymentMethod(method.id)}
                                                className={`p-4 rounded-2xl border-2 text-[9px] font-black uppercase transition-all flex flex-col items-center gap-2 ${manualPaymentMethod === method.id ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg scale-95' : 'bg-slate-50 border-slate-100 text-slate-500 dark:bg-zinc-800 dark:border-zinc-700'}`}
                                            >
                                                {method.label === 'DINHEIRO' ? <DollarSign size={18}/> : method.label === 'PIX' ? <Zap size={18}/> : <FileText size={18}/>}
                                                {method.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button 
                                        disabled={isLoading || !manualPaymentMethod || !activeTripId || (activeRoute?.sections && activeRoute.sections.length > 0 && selectedSectionIdx === null)}
                                        onClick={handleProcessBordoSale}
                                        className="w-full mt-8 py-5 bg-slate-900 text-white dark:bg-zinc-100 dark:text-slate-900 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                                        Processar Recebimento Bordo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'departure' ? (
                <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                    <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-3xl border-2 border-dashed border-slate-200 dark:border-zinc-800 mb-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 text-center tracking-widest">Confirmação de Veículo</h4>
                        <div className="flex flex-col items-center gap-4">
                            <p className="text-xs font-bold text-slate-600 dark:text-zinc-300">Você confirma a saída com o veículo selecionado acima?</p>
                            <div className="flex gap-4">
                                <button 
                                  onClick={() => setIsVehicleConfirmed(true)}
                                  className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] transition-all ${isVehicleConfirmed === true ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700'}`}
                                >
                                  Sim, Confirmar
                                </button>
                                <button 
                                  onClick={() => setIsVehicleConfirmed(false)}
                                  className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] transition-all ${isVehicleConfirmed === false ? 'bg-red-500 text-white shadow-lg' : 'bg-white dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700'}`}
                                >
                                  Não, Divergência
                                </button>
                            </div>
                            {isVehicleConfirmed === false && (
                                <div className="w-full mt-4 animate-in zoom-in duration-300">
                                    <label className="block text-[10px] font-black text-red-500 uppercase mb-2 ml-2">Motivo da Divergência / Ocorrência</label>
                                    <textarea 
                                      value={rejectionReason || ''}
                                      onChange={e => setRejectionReason(e.target.value)}
                                      className="w-full p-4 bg-white dark:bg-zinc-900 border-2 border-red-200 rounded-2xl font-bold outline-none focus:border-red-500 transition-all dark:text-white resize-none h-24"
                                      placeholder="Descreva o motivo da troca ou problema..."
                                    />
                                    <p className="text-[8px] text-red-400 mt-2 italic font-bold uppercase tracking-widest">* O despachante será notificado automaticamente para liberação de novo veículo.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                            <CheckCircle2 size={20}/>
                        </div>
                        <h3 className="text-lg font-black uppercase italic text-slate-800 dark:text-white">Checklist de Saída</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">KM Inicial</label>
                            <div className="relative">
                                <Gauge className="absolute left-4 top-4 text-slate-400" size={20}/>
                                <input 
                                    type="number" 
                                    value={odometerStart || ''} 
                                    onChange={e => setOdometerStart(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-yellow-400 transition-all dark:text-white"
                                    placeholder="000000"
                                />
                            </div>
                        </div>
                        {isUrbanVehicle && (
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Catraca Inicial</label>
                                <div className="relative">
                                    <Users className="absolute left-4 top-4 text-slate-400" size={20}/>
                                    <input 
                                        type="number" 
                                        value={turnstileStart || ''} 
                                        onChange={e => setTurnstileStart(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-yellow-400 transition-all dark:text-white"
                                        placeholder="0000"
                                    />
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Nível de Combustível</label>
                            <div className="relative">
                                <Fuel className="absolute left-4 top-4 text-slate-400" size={20}/>
                                <select 
                                    value={fuelLevel || ''} 
                                    onChange={e => setFuelLevel(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-yellow-400 transition-all dark:text-white appearance-none"
                                >
                                    <option value="FULL">Cheio (100%)</option>
                                    <option value="3/4">3/4</option>
                                    <option value="1/2">1/2</option>
                                    <option value="1/4">1/4</option>
                                    <option value="RESERVE">Reserva</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <button 
                            onClick={() => setTireOk(!tireOk)}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${tireOk ? 'bg-emerald-50 border-emerald-400 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-zinc-800 dark:border-zinc-700'}`}
                        >
                            <Disc size={24}/>
                            <span className="text-[10px] font-black uppercase">Pneus OK</span>
                        </button>
                        <button 
                            onClick={() => setLightsOk(!lightsOk)}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${lightsOk ? 'bg-emerald-50 border-emerald-400 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-zinc-800 dark:border-zinc-700'}`}
                        >
                            <Lightbulb size={24}/>
                            <span className="text-[10px] font-black uppercase">Luzes OK</span>
                        </button>
                        <button 
                            onClick={() => setOilWaterOk(!oilWaterOk)}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${oilWaterOk ? 'bg-emerald-50 border-emerald-400 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-zinc-800 dark:border-zinc-700'}`}
                        >
                            <Droplets size={24}/>
                            <span className="text-[10px] font-black uppercase">Óleo/Água OK</span>
                        </button>
                        <button 
                            onClick={() => setCleaningOk(!cleaningOk)}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${cleaningOk ? 'bg-emerald-50 border-emerald-400 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-zinc-800 dark:border-zinc-700'}`}
                        >
                            <Sparkles size={24}/>
                            <span className="text-[10px] font-black uppercase">Limpeza OK</span>
                        </button>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Relatório de Avarias / Incidentes (Saída)</label>
                        <div className="relative">
                            <AlertTriangle className="absolute left-4 top-4 text-slate-400" size={20}/>
                            <textarea 
                                value={damageReportStart || ''} 
                                onChange={e => setDamageReportStart(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-yellow-400 transition-all dark:text-white resize-none h-24"
                                placeholder="Descreva problemas pré-existentes..."
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleDepartureSubmit}
                        disabled={isLoading}
                        className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all mt-8"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                        Registrar Saída
                    </button>
                </div>
            ) : (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                            <FileText size={20}/>
                        </div>
                        <h3 className="text-lg font-black uppercase italic text-slate-800 dark:text-white">Fechamento de Viagem</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">KM Final</label>
                            <div className="relative">
                                <Gauge className="absolute left-4 top-4 text-slate-400" size={20}/>
                                <input 
                                    type="number" 
                                    value={odometerEnd || ''} 
                                    onChange={e => setOdometerEnd(e.target.value === '' ? '' : Number(e.target.value))}
                                    onBlur={() => {
                                        if (odometerStart !== '' && odometerEnd !== '' && Number(odometerEnd) < Number(odometerStart)) {
                                            addToast(`Atenção: KM Final (${odometerEnd}) menor que Inicial (${odometerStart})`, "warning");
                                        }
                                    }}
                                    className={`w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 rounded-2xl font-bold outline-none transition-all dark:text-white ${odometerStart !== '' && odometerEnd !== '' && Number(odometerEnd) < Number(odometerStart) ? 'border-red-500 animate-shake' : 'border-slate-200 dark:border-zinc-700 focus:border-yellow-400'}`}
                                    placeholder="000000"
                                />
                                {odometerStart !== '' && (
                                    <p className="text-[9px] font-black uppercase text-slate-400 mt-2 ml-2 tracking-widest">
                                        KM Inicial (Saída): <span className="text-indigo-500">{odometerStart}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                        {isUrbanVehicle && (
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Catraca Final</label>
                                <div className="relative">
                                    <Users className="absolute left-4 top-4 text-slate-400" size={20}/>
                                    <input 
                                        type="number" 
                                        value={turnstileEnd || ''} 
                                        onChange={e => setTurnstileEnd(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-yellow-400 transition-all dark:text-white"
                                        placeholder="0000"
                                    />
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Gastos com Pedágio (R$)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-4 text-slate-400" size={20}/>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={tollExpenses || ''} 
                                    onChange={e => setTollExpenses(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-yellow-400 transition-all dark:text-white"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Relatório de Avarias / Incidentes</label>
                        <div className="relative">
                            <AlertTriangle className="absolute left-4 top-4 text-slate-400" size={20}/>
                            <textarea 
                                value={damageReport || ''} 
                                onChange={e => setDamageReport(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-yellow-400 transition-all dark:text-white resize-none h-32"
                                placeholder="Descreva qualquer problema ocorrido..."
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleArrivalSubmit}
                        disabled={isLoading}
                        className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-3 hover:bg-blue-700 transition-all mt-8"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>}
                        Finalizar Viagem
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* MODAL CADASTRO RÁPIDO MOTORISTA REMOVED */}
    </div>
  );
};

export default DailyLogManager;
