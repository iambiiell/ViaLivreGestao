
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vehicle, User, Company, City, Inspection, VehicleClass, TicketingConfig, Skin, MaintenanceRecord } from '../types';
import { Plus, Pencil, Trash2, X, Save, Bus, Loader2, Building2, MapPin, Calendar, ClipboardCheck, Info, Copy, Search, CheckCircle2, AlertTriangle, Users, Palette, Wrench } from 'lucide-react';
import { supabase, db } from '../services/database';
import { formatDate } from '../utils/dateFormatter';
import { useConfirmDialog, ConfirmDialogModal } from './ConfirmDialog';

interface VehicleManagerProps {
  vehicles: Vehicle[];
  currentUser: User | null;
  companies: Company[];
  cities: City[];
  inspections: Inspection[];
  ticketingConfig: TicketingConfig | null;
  skins: Skin[];
  systemSettings?: any;
  onAddVehicle: (vehicle: Vehicle) => void;
  onUpdateVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (id: string) => void;
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

const VehicleManager: React.FC<VehicleManagerProps> = ({ 
  vehicles = [], 
  currentUser,
  companies = [], 
  cities = [], 
  inspections = [],
  ticketingConfig,
  skins = [],
  systemSettings,
  onAddVehicle, 
  onUpdateVehicle, 
  onDeleteVehicle,
  addToast
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [maintenanceCosts, setMaintenanceCosts] = useState<Record<string, number>>({});
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);

  const { isOpen: isConfirmOpen, options: confirmOptions, confirm, handleClose: handleConfirmClose } = useConfirmDialog();

  const handleDeleteVehicleClick = async (vehicle: Vehicle) => {
    const ok = await confirm({
      title: 'Excluir Veículo da Frota',
      message: `Tem certeza que deseja excluir o veículo Prefixo ${vehicle.prefix} (Placa: ${vehicle.plate})? Esta operação é permanente.`,
      confirmText: 'Excluir Veículo',
      type: 'danger'
    });
    if (ok) {
      onDeleteVehicle(vehicle.id);
      addToast("Veículo excluído com sucesso!", "success");
    }
  };

  useEffect(() => {
    const fetchMaintenanceData = async () => {
      try {
        const data = await db.fetchAll<MaintenanceRecord>('maintenance');
        if (data) {
          setMaintenanceRecords(data);
          const costMap: Record<string, number> = {};
          data.forEach((m: any) => {
            const vId = m.vehicle_id;
            const costVal = Number(m.cost) || 0;
            costMap[vId] = (costMap[vId] || 0) + costVal;
          });
          setMaintenanceCosts(costMap);
        }
      } catch (err) {
        console.error("Erro ao puxar dados de manutenção:", err);
      }
    };
    fetchMaintenanceData();

    const sub = db.subscribeTables(['vehicles', 'maintenance', 'inspections'], () => {
      fetchMaintenanceData();
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
    });
    return () => sub.unsubscribe();
  }, [vehicles, currentUser]);

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
  
  const initialFormState = {
    prefix: '', 
    plate: '', 
    status: 'ATIVO' as 'ATIVO' | 'MANUTENCAO' | 'INATIVO', 
    model: '', 
    chassis: '', 
    company_name: '', 
    base_city: '', 
    vehicle_type: 'RODOVIARIA', 
    vehicle_class: 'CONVENCIONAL' as VehicleClass, 
    is_accessible: true, 
    year_fab: '', 
    last_inspection: '',
    capacity: 44,
    skin_id: ''
  };

  const [formData, setFormData] = useState<any>(initialFormState);

  const getVehicleNextMaintenanceDaysLeft = (vehicle: Vehicle) => {
    const logsForVehicle = maintenanceRecords.filter(l => l.vehicle_id === vehicle.id && l.service_type === 'PREVENTIVA');
    if (logsForVehicle.length === 0) {
      return { daysLeft: null, nextDateStr: 'Não realizada' };
    }
    const sorted = [...logsForVehicle].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastPreventive = sorted[0];
    const intervalMonths = systemSettings?.maintenance_intervals?.[vehicle.vehicle_type] || 6;
    
    const nextDate = new Date(lastPreventive.date);
    nextDate.setMonth(nextDate.getMonth() + intervalMonths);
    
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const nextMidnight = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
    
    const diffTime = nextMidnight.getTime() - todayMidnight.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { daysLeft: diffDays, nextDateStr: formatDate(nextDate) };
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => 
      v.prefix.toLowerCase().includes(searchTerm.toLowerCase()) || 
      v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.chassis || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.model || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.prefix.localeCompare(b.prefix, undefined, { numeric: true }));
  }, [vehicles, searchTerm]);

  const getLastInspectionDate = (vehicleId: string) => {
      const vehicleInspections = inspections
        .filter(i => i.vehicle_id === vehicleId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return vehicleInspections.length > 0 ? vehicleInspections[0].date : 'Nenhuma';
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.prefix || !formData.plate || !formData.chassis || !formData.model) {
        addToast("Preencha todos os campos obrigatórios (*)", "warning");
        return;
    }

    const existingVehicleWithPlate = vehicles.find(v => 
        v.plate.toUpperCase() === formData.plate.toUpperCase() && v.id !== editingId
    );

    if (existingVehicleWithPlate) {
        const confirmUpdate = window.confirm(
            `A placa ${formData.plate} já está cadastrada no veículo #${existingVehicleWithPlate.prefix}. Deseja atualizar o cadastro existente em vez de criar um novo?`
        );
        
        if (confirmUpdate) {
            onUpdateVehicle({ ...formData, id: existingVehicleWithPlate.id } as Vehicle);
            setIsModalOpen(false);
            return;
        } else {
            addToast(`Veículo com placa ${formData.plate} já existe.`, "error");
            return;
        }
    }

    const capacity = Number(formData.capacity) || 0;
    if (capacity <= 0) {
        addToast("A capacidade deve ser um número maior que zero.", "warning");
        return;
    }

    const payload = { 
      ...formData, 
      capacity,
      year_fab: formData.year_fab ? (Number(formData.year_fab) || null) : null
    };

    if (editingId) {
        onUpdateVehicle({ ...payload, id: editingId } as Vehicle);
    } else {
        onAddVehicle({ ...payload } as Vehicle);
    }
    
    setIsModalOpen(false);
  };

  const handleClassChange = (vClass: string) => {
      const defaultCapacity = ticketingConfig?.class_seats[vClass] || 44;
      setFormData({ ...formData, vehicle_class: vClass as VehicleClass, capacity: defaultCapacity });
  };

  const handleDuplicate = (vehicle: Vehicle) => {
    const oldPrefix = vehicle.prefix;
    // Regex para encontrar números no final da string
    const match = oldPrefix.match(/\d+$/);
    let newPrefix: string;
    
    if (match) {
      const numStr = match[0];
      const nextNum = (parseInt(numStr, 10) + 1).toString().padStart(numStr.length, '0');
      newPrefix = oldPrefix.substring(0, oldPrefix.length - numStr.length) + nextNum;
    } else {
      newPrefix = oldPrefix + " 2";
    }
    
    setEditingId(null);
    setFormData({
      ...vehicle,
      id: undefined,
      prefix: newPrefix,
      plate: '',
      status: 'ATIVO'
    });
    setIsModalOpen(true);
    addToast(`Dados duplicados. Prefixo atualizado para ${newPrefix}.`, "warning");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 gap-4 transition-colors">
        <div className="flex-1 w-full">
          <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none transition-colors">Gerenciamento de Frota</h2>
          <div className="mt-6 relative max-w-md">
              <Search className="absolute left-4 top-4 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Pesquisar prefixo ou placa..." 
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black uppercase outline-none dark:text-zinc-300 shadow-inner" 
                value={searchTerm || ''} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
          </div>
        </div>
        <button 
            onClick={() => { setFormData({...initialFormState}); setEditingId(null); setIsModalOpen(true); }} 
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2"
        >
            <Plus size={18} /> Novo Ativo
        </button>
      </div>

      {/* Componente de Resumo com Efeito Liquid Glass */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-indigo-500/10 dark:bg-zinc-900/30 p-8 border border-white/30 dark:border-zinc-800/60 backdrop-blur-xl shadow-[0_20px_50px_rgba(8,112,184,0.08)]">
        <div className="absolute -top-24 -left-20 w-48 h-48 bg-blue-500/20 dark:bg-blue-600/10 rounded-full filter blur-[60px]" />
        <div className="absolute -bottom-24 -right-20 w-48 h-48 bg-purple-500/20 dark:bg-purple-600/10 rounded-full filter blur-[60px]" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/40 dark:bg-zinc-800/40 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 border border-white/50 dark:border-zinc-700/55 shadow-sm">
                  <Wrench size={28} className="animate-pulse" />
              </div>
              <div>
                  <h3 className="font-black text-slate-800 dark:text-zinc-100 text-xl uppercase italic tracking-tight">
                    Gasto Total de Manutenção por ônibus
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">Custos consolidados atualizados em tempo real via Supabase</p>
              </div>
          </div>
          
          <div className="flex flex-wrap gap-4 items-center overflow-x-auto pb-2 lg:pb-0 max-w-full custom-scrollbar">
            {vehicles.map(vehicle => {
              const cost = maintenanceCosts[vehicle.id] || 0;
              return (
                <div key={vehicle.id} className="bg-white/45 dark:bg-zinc-900/40 border border-white/50 dark:border-zinc-800/50 p-4 rounded-2xl flex flex-col items-center justify-center min-w-[130px] shrink-0 backdrop-blur-md shadow-sm">
                  <span className="text-[9px] font-black text-slate-700 dark:text-zinc-200 uppercase">#{vehicle.prefix}</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{vehicle.plate}</span>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-2">
                    R$ {cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })}
            {vehicles.length === 0 && (
              <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase italic">Nenhum ativo cadastrado na frota para exibir custos.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map(vehicle => {
          const lastInsp = getLastInspectionDate(vehicle.id);
          const { daysLeft, nextDateStr } = getVehicleNextMaintenanceDaysLeft(vehicle);
          const hasMaintenanceAlert = daysLeft !== null && daysLeft < 7;

          return (
            <motion.div 
              key={vehicle.id} 
              className="w-full"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className={`p-6 rounded-[2.5rem] shadow-sm relative group overflow-hidden transition-all hover:shadow-xl duration-300 h-full bg-gradient-to-br bg-white dark:bg-zinc-900 border-2 ${
                hasMaintenanceAlert 
                  ? 'border-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.15)] from-white via-white to-rose-50/20 dark:from-zinc-900 dark:via-zinc-900 dark:to-rose-950/10'
                  : 'border-yellow-400 from-white via-white to-yellow-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-yellow-900/5'
              }`}>
                <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl font-black text-[8px] uppercase tracking-widest flex items-center gap-1 shadow-sm ${
                  vehicle.status === 'ATIVO' ? 'bg-emerald-500 text-white' :
                  vehicle.status === 'MANUTENCAO' ? 'bg-amber-500 text-white' :
                  'bg-rose-500 text-white'
                }`}>
                  {vehicle.status === 'ATIVO' && <CheckCircle2 size={10} />}
                  {vehicle.status === 'MANUTENCAO' && <Wrench size={10} />}
                  {vehicle.status === 'INATIVO' && <X size={10} />}
                  {vehicle.status === 'ATIVO' ? 'Operacional' : vehicle.status === 'MANUTENCAO' ? 'Em Manutenção' : 'Inativo'}
                </div>
                
                <div className="flex items-center gap-4 mb-6">
                    <div className={`w-16 h-16 bg-slate-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-slate-400 border-2 shadow-inner ${
                      hasMaintenanceAlert ? 'border-rose-500 animate-pulse' : 'border-yellow-400'
                    }`}>
                        <Bus size={32} className={vehicle.status === 'ATIVO' ? 'text-indigo-500' : 'text-slate-400'} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-black text-slate-800 dark:text-zinc-100 text-2xl italic uppercase tracking-tighter flex items-center gap-2">
                          #{vehicle.prefix}
                          {hasMaintenanceAlert && <AlertTriangle className="text-rose-500 animate-pulse" size={18} />}
                        </h3>
                        <p className="text-[10px] text-blue-600 font-black tracking-widest uppercase">{vehicle.plate}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[7px] bg-yellow-400 text-slate-900 px-2 py-0.5 rounded font-black uppercase">
                              {allVehicleClasses.find(c => c.id === vehicle.vehicle_class)?.label || vehicle.vehicle_class}
                          </span>
                          <span className="text-[7px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black uppercase flex items-center gap-1">
                              <Users size={8}/> { (vehicle as any).capacity || 44 } Lugares
                          </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2 text-[9px] text-slate-500 dark:text-zinc-400 font-bold uppercase transition-colors">
                    <p className="flex items-center gap-2"><Building2 size={12} className="text-slate-400"/> {vehicle.company_name}</p>
                    <p className="flex items-center gap-2"><MapPin size={12} className="text-blue-500"/> Atuação: {vehicle.base_city || 'Não definida'}</p>
                    {vehicle.skin_id && (
                      <p className="flex items-center gap-2"><Palette size={12} className="text-indigo-500"/> Skin: {skins.find(s => s.id === vehicle.skin_id)?.skin_name || 'Personalizada'}</p>
                    )}
                    <p className="flex items-center gap-2"><Wrench size={12} className="text-red-500"/> Gasto Manutenção: <span className="font-black text-red-600 dark:text-red-400 ml-auto">R$ {(maintenanceCosts[vehicle.id] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                    <div className="flex items-center justify-between pt-2 border-t dark:border-zinc-800">
                        <span className="flex items-center gap-2"><ClipboardCheck size={12} className="text-emerald-500"/> Última Vistoria:</span>
                        <span className="font-black text-slate-700 dark:text-zinc-300">{lastInsp.split('-').reverse().join('/')}</span>
                    </div>
                    {hasMaintenanceAlert && (
                      <div className="mt-4 flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 px-3 py-2 rounded-2xl border border-rose-100 dark:border-rose-900/30 font-black uppercase text-[8px] animate-pulse">
                        <AlertTriangle size={14} className="text-rose-500 shrink-0" />
                        <span>Próxima Manutenção: {daysLeft < 0 ? 'Atrasada' : `Em ${daysLeft} dias`} ({nextDateStr})</span>
                      </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-zinc-800 transition-colors items-center">
                    <button 
                      onClick={() => handleDuplicate(vehicle)}
                      title="Gerar Duplicata"
                      className="p-3 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-xl transition-all"
                    >
                        <Copy size={18} />
                    </button>
                    <button 
                      onClick={() => { setFormData(vehicle); setEditingId(vehicle.id); setIsModalOpen(true); }} 
                      className="p-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all"
                    >
                        <Pencil size={18} />
                    </button>
                    
                    <button 
                      onClick={() => handleDeleteVehicleClick(vehicle)} 
                      className="p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                      title="Excluir Veículo"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <ConfirmDialogModal isOpen={isConfirmOpen} options={confirmOptions} onClose={handleConfirmClose} />

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] border-4 border-yellow-400 overflow-hidden transition-colors">
            <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic transition-colors">
                    {editingId ? 'Editar Veículo' : 'Cadastrar Novo Ativo'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:rotate-90 transition-transform"><X size={32} /></button>
            </div>
            
            <form onSubmit={handleSaveVehicle} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-zinc-950 transition-colors">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-full flex justify-between items-center bg-slate-50 dark:bg-zinc-900 p-4 rounded-2xl border-2 border-dashed border-yellow-400">
                        <label className="text-[10px] font-black text-black uppercase">Status Operacional</label>
                        <div className="flex gap-2">
                            {(['ATIVO', 'INATIVO', 'MANUTENCAO'] as const).map(s => (
                                <button 
                                    key={s} 
                                    type="button"
                                    onClick={() => setFormData({...formData, status: s})}
                                    className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase transition-all ${formData.status === s ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-zinc-800 text-slate-400'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Prefixo *</label>
                        <input required className="w-full px-4 py-3 border-2 border-yellow-400 rounded-xl bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 font-bold outline-none" value={formData.prefix || ''} onChange={e => setFormData({...formData, prefix: e.target.value})} placeholder="Ex: 4001" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Placa *</label>
                        <input required className="w-full px-4 py-3 border-2 border-yellow-400 rounded-xl bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 font-bold" value={formData.plate || ''} onChange={e => setFormData({...formData, plate: e.target.value})} placeholder="ABC1D23" />
                    </div>
                    
                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Modelo Comercial *</label>
                        <input required className="w-full px-4 py-3 border-2 border-yellow-400 rounded-xl bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 font-bold" value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="Ex: Marcopolo Paradiso G8 1200" />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Empresa Operadora *</label>
                        <select 
                            required 
                            className="w-full px-4 py-3 border-2 border-yellow-400 rounded-xl bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 font-bold" 
                            value={formData.company_id || ''} 
                            onChange={e => {
                                const company = companies.find(c => c.id === e.target.value);
                                setFormData({
                                    ...formData, 
                                    company_id: e.target.value,
                                    company_name: company?.name || ''
                                });
                            }}
                        >
                            <option value="">Selecione...</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Cidade de Atuação</label>
                        <select className="w-full px-4 py-3 border-2 border-yellow-400 rounded-xl bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 font-bold" value={formData.base_city || ''} onChange={e => setFormData({...formData, base_city: e.target.value})}>
                            <option value="">Selecione a base...</option>
                            {cities.map(c => <option key={c.id} value={c.name}>{c.name} - {c.state}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Classe do Veículo</label>
                        <select className="w-full px-4 py-3 border-2 border-yellow-400 rounded-xl bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 font-bold" value={formData.vehicle_class || ''} onChange={e => handleClassChange(e.target.value)}>
                            {allVehicleClasses.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Capacidade de Assentos</label>
                        <input type="number" className="w-full px-4 py-3 border-2 border-yellow-400 rounded-xl bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 font-bold" value={formData.capacity ?? ''} onChange={e => setFormData({...formData, capacity: parseInt(e.target.value)})} />
                    </div>

                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-2">Skin Aplicada (Seleção Visual)</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
                            <button 
                                type="button"
                                onClick={() => setFormData({...formData, skin_id: ''})}
                                className={`flex flex-col items-center justify-center p-4 rounded-[2rem] border-2 transition-all gap-2 h-full ${!formData.skin_id ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/10' : 'border-slate-100 dark:border-zinc-800'}`}
                            >
                                <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-slate-400">
                                    <X size={24} />
                                </div>
                                <span className="text-[9px] font-black uppercase text-center">Nenhuma Skin</span>
                            </button>
                            {skins.map(s => (
                                <button 
                                    key={s.id}
                                    type="button"
                                    onClick={() => setFormData({...formData, skin_id: s.id})}
                                    className={`flex flex-col items-center p-3 rounded-[2rem] border-2 transition-all gap-3 group relative overflow-hidden h-full ${formData.skin_id === s.id ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/10 shadow-lg shadow-blue-500/10' : 'border-slate-100 dark:border-zinc-800 hover:border-blue-300'}`}
                                >
                                    <div className="w-full aspect-video bg-slate-100 dark:bg-zinc-800 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-zinc-700">
                                        {s.file_url ? (
                                            <img src={s.file_url} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={s.skin_name} referrerPolicy="no-referrer" />
                                        ) : (
                                            <Palette size={24} className="text-slate-400" />
                                        )}
                                    </div>
                                    <div className="flex flex-col items-center pb-2">
                                        <span className="text-[9px] font-black uppercase text-center leading-tight truncate w-full px-1 dark:text-white">{s.skin_name}</span>
                                        <span className="text-[7px] font-bold text-slate-400 uppercase mt-1 tracking-wider">{s.bus_model}</span>
                                    </div>
                                    {formData.skin_id === s.id && (
                                        <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1 shadow-md">
                                            <CheckCircle2 size={12} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Número do Chassi *</label>
                        <input required className="w-full px-4 py-3 border-2 border-yellow-400 rounded-xl bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 font-bold" value={formData.chassis || ''} onChange={e => setFormData({...formData, chassis: e.target.value})} placeholder="17 caracteres..." />
                    </div>

                    {!editingId && (
                      <div className="col-span-full border-2 border-red-500 bg-red-50/20 dark:bg-red-950/20 p-6 rounded-[2rem] space-y-4">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                           <AlertTriangle size={20} />
                           <h4 className="text-sm font-black uppercase tracking-tight">Vistoria de Frota Obrigatória</h4>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase italic leading-normal">
                          Conforme politicas de segurança da empresa, todo novo veículo registrado na frota deve obrigatoriamente possuir um registro de vistoria estrutural e preventiva inicial.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase mb-1 ml-2">Data da Inspeção *</label>
                            <input 
                              type="date" 
                              required 
                              className="w-full px-4 py-3 border-2 border-red-500 rounded-xl bg-white dark:bg-zinc-900 dark:text-zinc-100 font-bold outline-none" 
                              value={formData.last_inspection || ''} 
                              onChange={e => setFormData({...formData, last_inspection: e.target.value})} 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase mb-1 ml-2">Status da Vistoria *</label>
                            <select 
                              required
                              className="w-full px-4 py-3 border-2 border-red-500 rounded-xl bg-white dark:bg-zinc-900 dark:text-zinc-100 font-bold outline-none" 
                              value={formData.inspection_status || ''} 
                              onChange={e => setFormData({...formData, inspection_status: e.target.value})}
                            >
                              <option value="">Selecione...</option>
                              <option value="APROVADO">APROVADO INTEGRALMENTE</option>
                              <option value="APROVADO_OBS">APROVADO COM RECOMENDAÇÕES</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border-2 border-blue-200 dark:border-blue-900/30 flex items-start gap-4">
                    <Info className="text-blue-500 shrink-0" size={20}/>
                    <p className="text-[9px] font-bold text-blue-700 dark:text-blue-400 uppercase leading-relaxed">
                        Dica: O campo "Última Vistoria" é atualizado automaticamente ao realizar uma nova inspeção na aba "Vistorias" vinculando este prefixo.
                    </p>
                </div>

                <div className="flex gap-4 pt-6">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest border-none transition-colors">Cancelar</button>
                    <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all">
                        <Save size={20}/> {editingId ? 'Salvar Alterações' : 'Concluir Cadastro'}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleManager;
