
import React, { useState, useEffect, useMemo } from 'react';
import { Vehicle, MaintenanceRecord, User } from '../types';
import { Wrench, Plus, Save, X, DollarSign, Calendar, Info, Trash2, Loader2, Bus, Search, AlertTriangle, FileText, TrendingUp, Filter, Settings } from 'lucide-react';
import { db, supabase } from '../services/database';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface MaintenanceManagerProps {
  vehicles: Vehicle[];
  currentUser: User;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  systemSettings?: any;
  onUpdateSettings?: (settings: any) => void;
}

const MaintenanceManager: React.FC<MaintenanceManagerProps> = ({ vehicles = [], currentUser, addToast, systemSettings, onUpdateSettings }) => {
  const [logs, setLogs] = useState<MaintenanceRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [costInput, setCostInput] = useState('0.00');
  const [formData, setFormData] = useState<Partial<MaintenanceRecord>>({
    date: new Date().toISOString().split('T')[0],
    cost: 0,
    performed_by: currentUser.full_name || 'Mecânico',
    vehicle_id: '',
    description: '',
    service_type: 'CORRETIVA'
  });

  const handleCostChange = (val: string) => {
    // Permite apenas dígitos e no máximo um ponto ou vírgula
    let cleanValue = val.replace(/[^0-9.,]/g, '');
    
    // Substitui vírgula por ponto para consistência e valida quantidade de separadores
    const parts = cleanValue.split(/[.,]/);
    if (parts.length > 2) {
      cleanValue = parts[0] + '.' + parts.slice(1).join('');
    }
    
    setCostInput(cleanValue);
    
    // Converte e atualiza o estado original com o valor numérico para persistência
    const normalized = cleanValue.replace(',', '.');
    const numericVal = parseFloat(normalized);
    setFormData(prev => ({
      ...prev,
      cost: isNaN(numericVal) ? 0 : numericVal
    }));
  };

  const handleCostBlur = () => {
    const normalized = costInput.replace(',', '.');
    const numericVal = parseFloat(normalized);
    if (isNaN(numericVal) || numericVal <= 0) {
      setCostInput('0.00');
      setFormData(prev => ({ ...prev, cost: 0 }));
    } else {
      setCostInput(numericVal.toFixed(2));
      setFormData(prev => ({ ...prev, cost: numericVal }));
    }
  };

  const loadLogs = async () => {
    setIsLoading(true);
    try {
        const maintenanceLogs = await db.fetchAll<MaintenanceRecord>('maintenance' as any);
        // Ordenar por data decrescente
        const sortedLogs = (maintenanceLogs || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setLogs(sortedLogs);
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
        const v = vehicles.find(veh => veh.id === log.vehicle_id);
        return (log.description || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
               (v?.prefix || '').toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a, b) => (a.description || '').localeCompare(b.description || ''));
  }, [logs, searchTerm, vehicles]);

  // Veículos com manutenção recente (últimos 30 dias)
  const recentMaintenanceVehicles = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recent = logs.filter(log => new Date(log.date) >= thirtyDaysAgo);
    const vehicleMap = new Map<string, MaintenanceRecord>();
    
    recent.forEach(log => {
      if (!vehicleMap.has(log.vehicle_id) || new Date(log.date) > new Date(vehicleMap.get(log.vehicle_id)!.date)) {
        vehicleMap.set(log.vehicle_id, log);
      }
    });

    return Array.from(vehicleMap.values())
      .map(log => ({
        vehicle: vehicles.find(v => v.id === log.vehicle_id),
        lastDate: log.date,
        description: log.description
      }))
      .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  }, [logs, vehicles]);

  // Alertas de manutenção preventiva (próximos 15 dias)
  const maintenanceAlerts = useMemo(() => {
    const alerts: any[] = [];
    vehicles.forEach(v => {
      const lastPreventive = logs.find(l => l.vehicle_id === v.id && l.service_type === 'PREVENTIVA');
      const intervalMonths = systemSettings?.maintenance_intervals?.[v.vehicle_type] || 6;
      
      if (lastPreventive) {
        const nextDate = new Date(lastPreventive.date);
        nextDate.setMonth(nextDate.getMonth() + intervalMonths);
        
        const today = new Date();
        const diffTime = nextDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 15 && diffDays >= 0) {
          alerts.push({ vehicle: v, daysLeft: diffDays, nextDate: nextDate.toISOString().split('T')[0] });
        }
      } else {
        // Se nunca teve preventiva, alerta
        alerts.push({ vehicle: v, daysLeft: 0, nextDate: 'IMEDIATO', missing: true });
      }
    });
    return alerts;
  }, [logs, vehicles]);

  // Dados para o gráfico de gastos (últimos 6 meses)
  const chartData = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyData: { [key: string]: number } = {};
    const typeData: { [key: string]: number } = {};

    logs.forEach(log => {
      const logDate = new Date(log.date);
      if (logDate >= sixMonthsAgo) {
        const monthYear = logDate.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
        monthlyData[monthYear] = (monthlyData[monthYear] || 0) + Number(log.cost);
        
        const type = log.service_type || 'OUTROS';
        typeData[type] = (typeData[type] || 0) + Number(log.cost);
      }
    });

    const barData = Object.entries(monthlyData).map(([name, total]) => ({ name, total }));
    const pieData = Object.entries(typeData).map(([name, value]) => ({ name, value }));

    return { barData, pieData };
  }, [logs]);

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [tempIntervals, setTempIntervals] = useState<{ [key: string]: number }>(systemSettings?.maintenance_intervals || {});

  const handleOpenConfig = () => {
    setTempIntervals(systemSettings?.maintenance_intervals || {});
    setIsConfigOpen(true);
  };

  const handleSaveConfig = async () => {
    if (onUpdateSettings) {
      setIsLoading(true);
      try {
        await onUpdateSettings({
          ...systemSettings,
          maintenance_intervals: tempIntervals
        });
        addToast("Intervalos de manutenção atualizados!");
        setIsConfigOpen(false);
      } catch (error) {
        addToast("Erro ao atualizar configurações.", "error");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOpenNew = () => {
    setFormData({
        date: new Date().toISOString().split('T')[0],
        cost: 0,
        performed_by: currentUser.full_name || 'Mecânico',
        vehicle_id: '',
        description: '',
        service_type: 'CORRETIVA'
    });
    setCostInput('0.00');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vehicle_id || !formData.description || !formData.cost) {
        addToast("Preencha Veículo, Descrição e Custo.", "error");
        return;
    }
    
    setIsLoading(true);
    try {
        await db.create('maintenance' as any, { ...formData } as any);
        setIsModalOpen(false);
        addToast("Manutenção registrada com sucesso!");
        await loadLogs();
    } catch (error) {
        addToast("Erro ao salvar manutenção.", "error");
    } finally {
        setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsLoading(true);
    try {
        await db.delete('maintenance' as any, id);
        addToast("Registro removido com sucesso!");
        window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
        await loadLogs();
    } catch (error) {
        console.error('Erro ao excluir registro de manutenção:', error);
        addToast("Erro ao remover registro.", "error");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in transition-all">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border dark:border-zinc-800 gap-4 transition-colors">
        <div className="flex-1 w-full">
          <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none transition-colors">Oficina & Reparos</h2>
          <div className="mt-6 relative max-w-md">
                <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Pesquisar por veículo ou descrição..." 
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black uppercase outline-none dark:text-zinc-300 shadow-inner"
                    value={searchTerm || ''}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={handleOpenConfig} className="flex-1 md:flex-none p-4 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-2xl hover:bg-slate-200 transition-all shadow-sm flex items-center justify-center gap-2">
            <Settings size={20} />
          </button>
          <button onClick={handleOpenNew} className="flex-[2] md:flex-none bg-slate-900 text-white dark:bg-yellow-400 dark:text-slate-900 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-xl hover:scale-105 transition-all">
            <Plus size={18} /> Novo Registro
          </button>
        </div>
      </div>

      {/* Alertas e Resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas de Preventiva */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-2xl">
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-zinc-100">Alertas de Preventiva</h3>
          </div>
          <div className="space-y-3">
            {maintenanceAlerts.length > 0 ? (
              maintenanceAlerts.map((alert, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-700">
                  <div className="flex items-center gap-3">
                    <Bus size={16} className="text-slate-400" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-700 dark:text-zinc-200">#{alert.vehicle.prefix}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">{alert.missing ? 'Sem registro de preventiva' : `Próxima: ${alert.nextDate.split('-').reverse().join('/')}`}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${alert.daysLeft === 0 ? 'bg-red-500 text-white' : 'bg-yellow-400 text-slate-900'}`}>
                    {alert.daysLeft === 0 ? 'Vencido' : `${alert.daysLeft} dias`}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[10px] font-bold text-slate-400 uppercase text-center py-4 italic">Nenhum alerta para os próximos 15 dias</p>
            )}
          </div>
        </div>

        {/* Veículos em Manutenção Recente */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl">
              <TrendingUp size={20} />
            </div>
            <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-zinc-100">Manutenções Recentes</h3>
          </div>
          <div className="space-y-3">
            {recentMaintenanceVehicles.slice(0, 4).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-[10px]">#{item.vehicle?.prefix}</div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-700 dark:text-zinc-200">{item.description}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">{item.lastDate.split('-').reverse().join('/')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Relatórios e Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
                <FileText size={20} />
              </div>
              <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-zinc-100">Gastos (Últimos 6 Meses)</h3>
            </div>
          </div>
          <div className="w-full h-64 min-w-0 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={chartData.barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border dark:border-zinc-800 shadow-sm">
          <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-zinc-100 mb-8">Distribuição por Tipo</h3>
          <div className="w-full h-64 min-w-0 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={chartData.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'][index % 6]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {chartData.pieData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'][idx % 6] }} />
                <span className="text-[8px] font-black uppercase text-slate-500">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border dark:border-zinc-800 shadow-sm flex items-center justify-between transition-colors">
              <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Investimento Total</p><h4 className="text-2xl font-black text-emerald-600">R$ {logs.reduce((acc, curr) => acc + Number(curr.cost), 0).toFixed(2)}</h4></div>
              <DollarSign className="text-emerald-500 opacity-20" size={32}/>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border dark:border-zinc-800 shadow-sm flex items-center justify-between transition-colors">
              <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Ordens de Serviço</p><h4 className="text-2xl font-black dark:text-white">{logs.length}</h4></div>
              <Wrench className="text-blue-500 opacity-20" size={32}/>
          </div>
          {isLoading && <div className="flex items-center gap-2 text-yellow-600 font-black uppercase text-[10px] animate-pulse"><Loader2 className="animate-spin"/> Sincronizando...</div>}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 overflow-hidden transition-colors overflow-x-auto">
          <table className="w-full text-left text-[10px]">
              <thead className="bg-slate-50 dark:bg-zinc-800 font-black uppercase text-slate-400 dark:text-zinc-500">
                  <tr>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Veículo</th>
                      <th className="px-6 py-4">Descrição do Serviço</th>
                      <th className="px-6 py-4">Custo</th>
                      <th className="px-6 py-4 text-right">Ação</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-zinc-800 transition-colors">
                  {filteredLogs.map(log => {
                      const v = vehicles.find(veh => veh.id === log.vehicle_id);
                      return (
                          <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                              <td className="px-6 py-4 font-bold dark:text-zinc-300">{log.date.split('-').reverse().join('/')}</td>
                              <td className="px-6 py-4 dark:text-zinc-300 font-black uppercase">#{v?.prefix || 'N/A'}</td>
                              <td className="px-6 py-4 dark:text-zinc-300 italic">"{log.description}"</td>
                              <td className="px-6 py-4 text-emerald-600 font-black">R$ {Number(log.cost).toFixed(2)}</td>
                              <td className="px-6 py-4 text-right">
                                  {deletingId === log.id ? (
                                    <div className="flex justify-end gap-2 animate-in fade-in slide-in-from-right-2">
                                      <button 
                                        onClick={() => { handleDelete(log.id); setDeletingId(null); }} 
                                        className="px-3 py-1 bg-red-600 text-white text-[8px] font-black uppercase rounded-lg shadow-lg active:scale-95 transition-all"
                                      >
                                        Sim
                                      </button>
                                      <button 
                                        onClick={() => setDeletingId(null)} 
                                        className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[8px] font-black uppercase rounded-lg hover:bg-slate-200 transition-all"
                                      >
                                        Não
                                      </button>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => setDeletingId(log.id)} 
                                      className="p-2 text-red-400 hover:text-red-600 transition-colors"
                                      title="Excluir Registro"
                                    >
                                      <Trash2 size={16}/>
                                    </button>
                                  )}
                              </td>
                          </tr>
                      )
                  })}
              </tbody>
          </table>
      </div>

      {isConfigOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] border dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic leading-none">Configurar Intervalos</h3>
                <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 dark:text-zinc-500 hover:rotate-90 transition-transform"><X size={32} /></button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto">
              <p className="text-[10px] font-bold text-black uppercase tracking-widest">Defina o intervalo (em meses) para a manutenção preventiva de cada tipo de veículo.</p>
              
              {Array.from(new Set(vehicles.map(v => v.vehicle_type))).map(type => (
                <div key={type}>
                  <label className="block text-[10px] font-black text-black uppercase mb-2 ml-2">{type || 'Geral'}</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      min="1"
                      className="flex-1 px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 transition-colors" 
                      value={tempIntervals[type || ''] ?? ''} 
                      onChange={e => setTempIntervals({...tempIntervals, [type || '']: parseInt(e.target.value) || 6})} 
                    />
                    <span className="text-[10px] font-black text-black uppercase">Meses</span>
                  </div>
                </div>
              ))}

              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsConfigOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest transition-colors">Cancelar</button>
                <button onClick={handleSaveConfig} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 hover:bg-black transition-all"><Save size={20}/> Salvar Config</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] border dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic leading-none">Novo Registro Técnico</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 dark:text-zinc-500 hover:rotate-90 transition-transform"><X size={32} /></button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Veículo (Prefixo)</label>
                    <select required className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formData.vehicle_id || ''} onChange={e => setFormData({...formData, vehicle_id: e.target.value})}>
                        <option value="">Selecione...</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>#{v.prefix} - {v.plate}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Tipo de Serviço</label>
                    <select required className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formData.service_type || ''} onChange={e => setFormData({...formData, service_type: e.target.value as any})}>
                        <option value="CORRETIVA">CORRETIVA</option>
                        <option value="PREVENTIVA">PREVENTIVA</option>
                        <option value="PNEUS">PNEUS</option>
                        <option value="OLEO">OLEO</option>
                        <option value="ELETRICA">ELETRICA</option>
                        <option value="OUTROS">OUTROS</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Data do Serviço</label>
                    <input type="date" className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Descrição / Peças Trocadas</label>
                    <textarea rows={3} className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ex: Troca de óleo e filtro de ar." />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Custo Total (R$)</label>
                    <input 
                      type="text" 
                      className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" 
                      value={costInput} 
                      onChange={e => handleCostChange(e.target.value)} 
                      onBlur={handleCostBlur}
                      placeholder="0.00"
                    />
                </div>
                <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                    <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 hover:bg-black transition-all"><Save size={20}/> Gravar Ordem</button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceManager;
