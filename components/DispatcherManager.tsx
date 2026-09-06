import React, { useState, useEffect } from 'react';
import { supabase, db } from '../services/database';
import { User, Vehicle, BusRoute, IssueReport, AppNotification } from '../types';
import { 
  LayoutDashboard, 
  Bus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  User as UserIcon, 
  MapPin, 
  ShieldAlert,
  Loader2,
  Check,
  X,
  MessageSquare
} from 'lucide-react';

interface DispatcherManagerProps {
  currentUser: User | null;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}

const DispatcherManager: React.FC<DispatcherManagerProps> = ({ currentUser, addToast }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingLogs, setPendingLogs] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [recentOccurrences, setRecentOccurrences] = useState<IssueReport[]>([]);

  const [delayAlerts, setDelayAlerts] = useState<any[]>([]);

  const loadDispatcherData = async () => {
    setIsLoading(true);
    try {
      // Fetch pending logs
      const { data: logs } = await supabase
        .from('driver_logs')
        .select(`
          *, 
          users!driver_id(full_name, id), 
          vehicles!vehicle_id(prefix, plate, id)
        `)
        .eq('status', 'OPEN')
        .is('dispatcher_id', null)
        .order('created_at', { ascending: false });
      setPendingLogs(logs || []);

      // Fetch active trips
      const { data: trips } = await supabase
        .from('trips')
        .select(`
          *, 
          routes(name, start_point, end_point, prefixo_linha), 
          users(full_name), 
          vehicles(prefix)
        `)
        .eq('status', 'IN_PROGRESS');
      setActiveTrips(trips || []);

      // Fetch upcoming trips for delay alerts
      const { data: upcoming } = await supabase
        .from('trips')
        .select(`
          *, 
          routes(name, start_point, end_point, prefixo_linha), 
          users(full_name)
        `)
        .eq('status', 'PENDING')
        .eq('trip_date', new Date().toISOString().split('T')[0]);
      
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      const alerts = (upcoming || []).filter(t => {
        const [h, m] = (t.departure_time || '00:00').split(':').map(Number);
        const depMinutes = h * 60 + m;
        return currentMinutes > depMinutes; // Already late
      }).map(t => ({
        ...t,
        delay_minutes: currentMinutes - (Number(t.departure_time.split(':')[0]) * 60 + Number(t.departure_time.split(':')[1]))
      }));

      setDelayAlerts(alerts);

      // Fetch recent occurrences
      const { data: occurrences } = await supabase
        .from('occurrences')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      setRecentOccurrences(occurrences || []);

    } catch (error) {
      console.error("Erro ao carregar dados do despachante:", error);
      addToast("Erro ao carregar painel do despachante.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDispatcherData();
    
    // Assinaturas Realtime e listeners de janela
    const sub = db.subscribeTables(['driver_logs', 'occurrences', 'trips', 'vehicles'], () => {
      loadDispatcherData();
    });

    const handleRefresh = () => loadDispatcherData();
    window.addEventListener('vialivre-refresh-data', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('online', handleRefresh);

    return () => {
      sub.unsubscribe();
      window.removeEventListener('vialivre-refresh-data', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('online', handleRefresh);
    };
  }, []);

  const handleReleaseVehicle = async (log: any, approved: boolean) => {
    if (approved) {
        // Safety Check: 11h Rest Period
        try {
            const { data: lastTrips } = await supabase
                .from('trips')
                .select('*')
                .eq('driver_id', log.driver_id)
                .eq('finished', true)
                .order('actual_end_time', { ascending: false })
                .limit(1);

            if (lastTrips && lastTrips.length > 0 && lastTrips[0].actual_end_time) {
                const lastEnd = new Date(lastTrips[0].actual_end_time).getTime();
                const now = new Date().getTime();
                const restHours = (now - lastEnd) / (1000 * 60 * 60);

                if (restHours < 11) {
                    addToast(`ALERTA SEGURANÇA: Motorista em repouso insuficiente (${restHours.toFixed(1)}h/11h). Liberação negada.`, "error");
                    return;
                }
            }
        } catch (err) {
            console.error("Erro ao validar descanso do motorista:", err);
        }
    }

    try {
      const { error } = await supabase
        .from('driver_logs')
        .update({ 
          status: approved ? 'OPEN' : 'CANCELLED',
          dispatcher_id: currentUser?.id,
          released_at: new Date().toISOString(),
          vehicle_confirmed: approved
        })
        .eq('id', log.id);

      if (error) throw error;

      addToast(approved ? "Veículo liberado com sucesso!" : "Solicitação cancelada.", "success");
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      loadDispatcherData();
    } catch (error) {
      if ((error as any).status === 429) {
        addToast("Cota de API excedida. Tente novamente em instantes.", "warning");
      } else {
        addToast("Erro ao processar liberação.", "error");
      }
    }
  };

  const handleReplaceBus = async (trip: any) => {
    const newPrefix = prompt("Digite o novo prefixo do veículo:");
    if (!newPrefix) return;
    const reason = prompt("Digite o motivo da substituição:");
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('trips')
        .update({ 
          replacement_bus_number: newPrefix,
          occurrence_type: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', trip.id);

      if (error) throw error;
      addToast("Veículo substituído com sucesso!", "success");
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      loadDispatcherData();
    } catch (error) {
      if ((error as any).status === 429) {
        addToast("Cota de API excedida. Tente novamente em instantes.", "warning");
      } else {
        addToast("Erro ao substituir veículo.", "error");
      }
    }
  };

  const handleCloseTrip = async (trip: any) => {
    const pagantes = parseInt(prompt("Quantidade de passageiros PAGANTES:", "0") || "0");
    const vt = parseInt(prompt("Quantidade de passageiros VT:", "0") || "0");
    const gratuidade = parseInt(prompt("Quantidade de GRATUIDADES:", "0") || "0");

    try {
      const { error } = await supabase
        .from('trips')
        .update({ 
          status: 'Concluída',
          finished: true,
          actual_end_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          passenger_count: { pagantes, vt, gratuidade },
          updated_at: new Date().toISOString()
        })
        .eq('id', trip.id);

      if (error) throw error;
      addToast("Viagem encerrada com sucesso!", "success");
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      loadDispatcherData();
    } catch (error) {
      if ((error as any).status === 429) {
        addToast("Cota de API excedida. Tente novamente em instantes.", "warning");
      } else {
        addToast("Erro ao encerrar viagem.", "error");
      }
    }
  };

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500 pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black uppercase italic text-slate-900 dark:text-white flex items-center gap-3">
              <LayoutDashboard size={32} className="text-yellow-500" />
              Painel do Despachante
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Frota e Operações em Tempo Real</p>
          </div>
          <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-2 rounded-2xl border dark:border-zinc-800 shadow-sm">
            <div className="flex flex-col items-end px-4">
              <span className="text-[10px] font-black text-slate-400 uppercase">Status do Sistema</span>
              <span className="text-xs font-black text-emerald-500 uppercase flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Operacional
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* COLUNA 1: PENDÊNCIAS DE LIBERAÇÃO */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-zinc-800 overflow-hidden shadow-xl">
              <div className="p-6 border-b dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950">
                <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-white flex items-center gap-2">
                  <ShieldAlert size={18} className="text-red-500" />
                  Pendências de Liberação
                </h3>
                <span className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-[10px] font-black">{pendingLogs.length}</span>
              </div>
              <div className="p-6">
                {pendingLogs.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle2 size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma divergência pendente</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingLogs.map(log => (
                      <div key={log.id} className="p-6 bg-slate-50 dark:bg-zinc-800/50 rounded-3xl border border-slate-200 dark:border-zinc-700 hover:border-yellow-400 transition-all group">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white dark:bg-zinc-700 rounded-xl flex items-center justify-center shadow-sm">
                                <Bus size={20} className="text-slate-600 dark:text-zinc-300" />
                              </div>
                              <div>
                                <h4 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-xs">Código da Linha: {log.line_code || '---'}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Placa do Veículo: {log.vehicles?.plate || log.vehicle_plate || '---'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 dark:text-zinc-400 uppercase">
                              <UserIcon size={14} /> Nome do Motorista: {log.users?.full_name || log.driver_name}
                            </div>
                            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20">
                              <p className="text-[9px] font-black text-red-500 uppercase mb-1 flex items-center gap-1">
                                <AlertTriangle size={12} /> Tipo de Ocorrência: {log.occurrence_type || 'Divergência'}
                              </p>
                              <p className="text-xs font-bold text-slate-700 dark:text-zinc-300 italic">Notas: "{log.rejection_reason || log.notes}"</p>
                            </div>
                          </div>
                          <div className="flex md:flex-col gap-2 justify-center">
                            <button 
                              onClick={() => handleReleaseVehicle(log.id, true)}
                              className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-2"
                            >
                              <Check size={16} /> Liberar
                            </button>
                            <button 
                              onClick={() => handleReleaseVehicle(log.id, false)}
                              className="px-6 py-3 bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl font-black uppercase text-[10px] hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                            >
                              <X size={16} /> Recusar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-zinc-800 overflow-hidden shadow-xl">
              <div className="p-6 border-b dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950">
                <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-white flex items-center gap-2">
                  <Clock size={18} className="text-blue-500" />
                  Viagens em Curso
                </h3>
                <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black">{activeTrips.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-zinc-950/50 text-[9px] font-black uppercase text-slate-400 border-b dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-4">Linha</th>
                      <th className="px-6 py-4">Motorista</th>
                      <th className="px-6 py-4">Carro</th>
                      <th className="px-6 py-4">Início</th>
                      <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                    {activeTrips.map(trip => (
                      <tr key={trip.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-all">
                        <td className="px-6 py-4">
                          <p className="text-xs font-black text-slate-800 dark:text-zinc-100 uppercase">{(trip.routes?.name || 'NÃO INFORMADO').toUpperCase()}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">{(trip.routes?.start_point || '').toUpperCase()} x {(trip.routes?.end_point || '').toUpperCase()}</p>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-black text-slate-600 dark:text-zinc-400 uppercase">{(trip.users?.full_name || 'NÃO INFORMADO').toUpperCase()}</td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-900 text-yellow-400 px-2 py-1 rounded-lg font-mono font-black text-[10px]">{(trip.vehicles?.prefix || trip.bus_number || '---').toUpperCase()}</span>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">{trip.departure_time}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleReplaceBus(trip)}
                              className="p-3 bg-yellow-400 text-slate-900 rounded-xl font-black uppercase text-[8px] shadow-md hover:bg-yellow-500 transition-all"
                              title="Substituir Frota"
                            >
                              Substituir
                            </button>
                            <button 
                              onClick={() => handleCloseTrip(trip)}
                              className="p-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[8px] shadow-md hover:bg-emerald-600 transition-all"
                              title="Fechar Viagem"
                            >
                              Fechar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {activeTrips.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma viagem em curso no momento</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* COLUNA 2: OCORRÊNCIAS E ALERTAS */}
          <div className="space-y-8">
            {/* ALERTAS DE ATRASO */}
            <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-red-100 dark:border-red-900/20 overflow-hidden shadow-xl animate-pulse">
              <div className="p-6 border-b border-red-50 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 flex justify-between items-center">
                <h3 className="text-sm font-black uppercase italic text-red-600 flex items-center gap-2">
                  <Clock size={18} />
                  Alertas de Atraso
                </h3>
                <span className="px-3 py-1 bg-red-600 text-white rounded-lg text-[10px] font-black">{delayAlerts.length}</span>
              </div>
              <div className="p-6 space-y-4">
                {delayAlerts.map(alert => (
                  <div key={alert.id} className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-red-100 dark:border-red-900/20 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[12px] font-black text-red-600 uppercase italic">-{alert.delay_minutes} min</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase">{alert.departure_time}</span>
                    </div>
                    <p className="text-xs font-black text-slate-800 dark:text-zinc-100 uppercase mb-1">{(alert.routes?.name || '---').toUpperCase()}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase italic">{(alert.users?.full_name || 'MOTORISTA NÃO ATRIBUÍDO').toUpperCase()}</p>
                  </div>
                ))}
                {delayAlerts.length === 0 && (
                  <div className="py-8 text-center text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                    <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500 opacity-20" />
                    Sem atrasos registrados
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-zinc-800 overflow-hidden shadow-xl">
              <div className="p-6 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
                <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-white flex items-center gap-2">
                  <MessageSquare size={18} className="text-yellow-500" />
                  Últimas Ocorrências
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {recentOccurrences.map(occ => (
                  <div key={occ.id} className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border-l-4 border-yellow-400 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-[8px] font-black uppercase">{occ.type}</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase">{new Date((occ as any).created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 uppercase mb-2">{occ.description}</p>
                    <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase">
                      <MapPin size={12} /> Local: {(occ as any).location || 'Não informado'}
                    </div>
                  </div>
                ))}
                {recentOccurrences.length === 0 && (
                  <div className="py-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Sem ocorrências recentes</div>
                )}
              </div>
            </section>

            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <ShieldAlert size={120} />
              </div>
              <h4 className="text-xl font-black uppercase italic mb-4 relative z-10">Protocolo de Emergência</h4>
              <p className="text-xs font-bold text-slate-400 uppercase mb-6 relative z-10">Em caso de acidentes graves ou falha total de comunicação, acione o suporte central imediatamente.</p>
              <button 
                onClick={() => {
                    window.open('https://wa.me/5521995421447?text=Olá,%20preciso%20de%20suporte%20no%20sistema%20Viação%20Nicolau%20Transportes%20S/A', '_blank');
                }}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase text-xs shadow-xl transition-all relative z-10 flex items-center justify-center gap-2"
              >
                <AlertTriangle size={18} /> Acionar Suporte
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispatcherManager;
