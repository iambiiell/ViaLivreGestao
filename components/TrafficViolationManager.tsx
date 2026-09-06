import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Search, 
  Plus, 
  Trash2, 
  Filter, 
  Calendar,
  User,
  Truck,
  FileText,
  DollarSign,
  CheckCircle,
  Clock,
  X,
  Phone
} from 'lucide-react';
import { UserFine, User as AppUser, Vehicle } from '../types';
import { db, generateUUID } from '../services/database';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateTime } from '../utils/dateFormatter';

interface TrafficViolationManagerProps {
  userFines: UserFine[];
  drivers: AppUser[];
  vehicles: Vehicle[];
  onAddViolation: (violation: UserFine) => void;
  onDeleteViolation: (id: string) => void;
  onUpdateViolation: (violation: UserFine) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

const TrafficViolationManager: React.FC<TrafficViolationManagerProps> = ({ 
  userFines = [], 
  drivers = [], 
  vehicles = [], 
  onAddViolation, 
  onDeleteViolation,
  onUpdateViolation,
  addToast
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PENDENTE' | 'PAGO' | 'RECURSO'>('TODOS');
  const [formData, setFormData] = useState<Partial<UserFine>>({
    status: 'PENDENTE',
    date_time: new Date().toISOString().slice(0, 16)
  });

  const filteredViolations = useMemo(() => {
    return userFines
      .filter(v => {
        const driver = drivers.find(d => d.id === v.user_id);
        const vehicle = vehicles.find(veh => veh.id === v.vehicle_id);
        const driverName = driver?.full_name || driver?.name || '';
        const vehiclePlate = vehicle?.plate || '';

        const matchesSearch = 
          driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (v.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (v.infraction_notice || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'TODOS' || v.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
  }, [userFines, searchTerm, statusFilter, drivers, vehicles]);

  const handleSave = async () => {
    if (!formData.user_id || !formData.date_time || !formData.description || !formData.infraction_notice) {
      addToast("Por favor, preencha todos os campos obrigatórios.", "error");
      return;
    }

    const newViolation: UserFine = {
      id: generateUUID(),
      user_id: formData.user_id,
      vehicle_id: formData.vehicle_id || '',
      infraction_notice: formData.infraction_notice || '',
      date_time: formData.date_time,
      description: formData.description || '',
      amount: formData.amount || 0,
      due_date: formData.due_date || new Date().toISOString().split('T')[0],
      points: formData.points || 0,
      status: formData.status as any,
      created_at: new Date().toISOString()
    };

    try {
      onAddViolation(newViolation);
      setIsModalOpen(false);
      setFormData({
        status: 'PENDENTE',
        date_time: new Date().toISOString().slice(0, 16)
      });
      addToast("Multa registrada com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar infração:", error);
      addToast("Erro ao salvar multa.", "error");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAGO': return 'bg-emerald-100 text-emerald-700';
      case 'RECURSO': return 'bg-blue-100 text-blue-700';
      case 'PENDENTE': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic flex items-center gap-3">
            <AlertTriangle className="text-red-500" /> Infrações de Trânsito
          </h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Gestão e Relatório de Ocorrências</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-slate-200 dark:shadow-none"
        >
          <Plus size={16} /> Nova Infração
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar motorista, placa ou descrição..." 
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-zinc-800 border-none text-[10px] font-black outline-none shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-2 rounded-2xl shadow-sm">
          <Filter size={18} className="text-slate-400 ml-2" />
          <select 
            className="flex-1 bg-transparent border-none text-[10px] font-black outline-none"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="TODOS">TODOS OS STATUS</option>
            <option value="PENDENTE">PENDENTE</option>
            <option value="PAGO">PAGO</option>
            <option value="RECURSO">RECURSO</option>
          </select>
        </div>
        <div className="bg-slate-900 rounded-2xl p-4 flex items-center justify-between text-white">
          <div>
            <p className="text-[8px] font-black uppercase opacity-50">Total de Infrações</p>
            <p className="text-xl font-black">{userFines.length}</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black uppercase opacity-50">Total em Multas</p>
            <p className="text-xl font-black">R$ {userFines.reduce((acc, v) => acc + (v.amount || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-[2.5rem] shadow-sm overflow-hidden border border-slate-100 dark:border-zinc-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-900/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data / Hora</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Auto</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Motorista</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Veículo</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pontos</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px) font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-700">
              {filteredViolations.map(v => {
                const driver = drivers.find(d => d.id === v.user_id);
                const vehicle = vehicles.find(veh => veh.id === v.vehicle_id);

                return (
                <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400" />
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">{formatDateTime(v.date_time)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase">{v.infraction_notice}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-slate-400" />
                      <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase">{driver?.full_name || '---'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Truck size={14} className="text-slate-400" />
                      <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase">{vehicle?.plate || '---'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 max-w-xs truncate">{v.description}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${v.points && v.points > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                      {v.points || 0} PTS
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${getStatusColor(v.status)}`}>
                        {v.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right flex gap-2 justify-end">
                    <button 
                        onClick={() => {
                            const driver = drivers.find(d => d.id === v.user_id);
                            if (driver?.phone) {
                                window.open(`https://wa.me/55${driver.phone.replace(/\D/g, '')}?text=Notificacao de multa: ${v.infraction_notice} - ${v.description}`, '_blank');
                            }
                        }}
                        className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                        title="Enviar via WhatsApp"
                    >
                        <Phone size={14}/>
                    </button>
                    <button 
                      onClick={() => onDeleteViolation(v.id)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )})}
              {filteredViolations.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-20">
                      <FileText size={48} />
                      <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma infração encontrada</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic">Registrar Nova Infração</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Preencha os detalhes da ocorrência</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Colaborador *</label>
                    <select 
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[11px] font-black outline-none focus:ring-2 ring-slate-900 transition-all"
                      value={formData.user_id || ''}
                      onChange={e => setFormData({...formData, user_id: e.target.value})}
                    >
                      <option value="">SELECIONE O COLABORADOR</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.full_name || d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Veículo (Opcional)</label>
                    <select 
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[11px] font-black outline-none focus:ring-2 ring-slate-900 transition-all"
                      value={formData.vehicle_id || ''}
                      onChange={e => setFormData({...formData, vehicle_id: e.target.value})}
                    >
                      <option value="">SELECIONE O VEÍCULO</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.prefix} - {v.plate}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Auto de Infração *</label>
                    <input 
                      type="text" 
                      className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 shadow-inner uppercase"
                      placeholder="EX: A0001234"
                      value={formData.infraction_notice || ''}
                      onChange={e => setFormData({...formData, infraction_notice: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Data e Hora da Infração *</label>
                    <input 
                      type="datetime-local" 
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[11px] font-black outline-none focus:ring-2 ring-slate-900 transition-all"
                      value={formData.date_time || ''}
                      onChange={e => setFormData({...formData, date_time: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Valor (R$)</label>
                      <input 
                        type="number" 
                        placeholder="0,00"
                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[11px] font-black outline-none focus:ring-2 ring-slate-900 transition-all"
                        value={formData.amount || ''}
                        onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Pontos</label>
                      <input 
                        type="number" 
                        placeholder="0"
                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[11px] font-black outline-none focus:ring-2 ring-slate-900 transition-all"
                        value={formData.points || ''}
                        onChange={e => setFormData({...formData, points: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Status</label>
                    <select 
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[11px] font-black outline-none focus:ring-2 ring-slate-900 transition-all"
                      value={formData.status || 'PENDENTE'}
                      onChange={e => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="PENDENTE">PENDENTE</option>
                      <option value="PAGO">PAGO</option>
                      <option value="RECURSO">RECURSO</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Localização</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Rodovia BR-101, KM 20"
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[11px] font-black outline-none focus:ring-2 ring-slate-900 transition-all"
                      value={formData.location || ''}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Descrição da Infração *</label>
                  <textarea 
                    rows={3}
                    placeholder="Descreva os detalhes da infração..."
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[11px] font-black outline-none focus:ring-2 ring-slate-900 transition-all resize-none"
                    value={formData.description || ''}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200 dark:shadow-none"
                >
                  Salvar Infração
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrafficViolationManager;
