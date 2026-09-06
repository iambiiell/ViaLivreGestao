import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Shift, BusRoute } from '../types';
import { Calendar, User as UserIcon, Plus, Clock, MapPin, Save, Trash2, AlertCircle, X, Download, Loader2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportElementToPDF } from '../utils/pdfExport';
import { db, generateUUID } from '../services/database';

interface DriverShiftManagerProps {
  shifts: Shift[];
  drivers: User[];
  routes: BusRoute[];
  onAddShift: (shift: Shift) => void;
  onUpdateShift: (shift: Shift) => void;
  onDeleteShift: (id: string) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

const DriverShiftManager: React.FC<DriverShiftManagerProps> = ({ 
  shifts = [], 
  drivers = [], 
  routes = [],
  onAddShift,
  onUpdateShift,
  onDeleteShift,
  addToast
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Partial<Shift> | null>(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sub = db.subscribeTable('shifts', () => {
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
    });
    return () => sub.unsubscribe();
  }, []);

  const handleExportPDF = async () => {
    if (!containerRef.current) return;
    setIsGeneratingPDF(true);
    try {
      await exportElementToPDF(containerRef.current, {
        fileName: `escala_turnos_${filterDate}_${new Date().toISOString().split('T')[0]}.pdf`,
        title: `ViaLivre • Escala de Turnos (${filterDate})`,
      });
      addToast("Escala de turnos exportada em PDF com sucesso!", "success");
    } catch (e) {
      console.error("Erro ao exportar PDF de turnos:", e);
      addToast("Erro ao gerar PDF dos turnos.", "error");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const filteredShifts = useMemo(() => {
    return shifts.filter(s => s.date === filterDate);
  }, [shifts, filterDate]);

  const availableDrivers = useMemo(() => drivers.filter(d => d.role === 'DRIVER'), [drivers]);

  const handleDateChange = (date: string) => {
    if (!editingShift) return;
    setEditingShift({ ...editingShift, date });
  };

  const handleSave = () => {
    if (!editingShift?.driver_id || !editingShift?.route_id || !editingShift?.start_time || !editingShift?.end_time || !editingShift?.date) {
      addToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }

    // Basic Rest Period Check (11 hours)
    const currentStart = new Date(`${editingShift.date}T${editingShift.start_time}`);
    const currentEnd = new Date(`${editingShift.date}T${editingShift.end_time}`);

    if (currentEnd <= currentStart) {
      addToast("O horário de término deve ser após o horário de início.", "error");
      return;
    }

    const driverShifts = shifts.filter(s => s.driver_id === editingShift.driver_id && s.id !== editingShift.id && s.date === editingShift.date);
    
    // Exact Overlap Check
    const hasOverlap = driverShifts.some(s => {
      const sStart = new Date(`${s.date}T${s.start_time}`);
      const sEnd = new Date(`${s.date}T${s.end_time}`);
      
      // Overlap logic: (StartA < EndB) and (EndA > StartB)
      return (currentStart < sEnd) && (currentEnd > sStart);
    });

    if (hasOverlap) {
      addToast("Conflito de Horário: Este motorista já possui um turno que se sobrepõe a este horário.", "error");
      return;
    }

    // Rest Period Check (11 hours)
    const allDriverShifts = shifts.filter(s => s.driver_id === editingShift.driver_id && s.id !== editingShift.id);
    const hasRestConflict = allDriverShifts.some(s => {
      const sEnd = new Date(`${s.date}T${s.end_time}`);
      const diff = Math.abs(currentStart.getTime() - sEnd.getTime()) / (1000 * 60 * 60);
      return diff < 11;
    });

    if (hasRestConflict && !confirm("Aviso: Este motorista pode não ter o descanso mínimo de 11 horas entre turnos. Deseja continuar?")) {
      return;
    }

    // daily_hours_target validation
    if (editingShift?.daily_hours_target) {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(editingShift.daily_hours_target)) {
            addToast("Formato de Meta de Horas Diárias inválido. Use HH:MM.", "error");
            return;
        }
    }

    if (editingShift.id) {
      onUpdateShift(editingShift as Shift);
    } else {
      onAddShift({
        ...editingShift,
        id: generateUUID()
      } as Shift);
    }
    setIsModalOpen(false);
  };

  return (
    <div ref={containerRef} className="space-y-6 animate-in fade-in transition-all pb-24">
      {/* HEADER */}
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none">Gestão de Turnos</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 border-l-2 border-yellow-400 pl-4">Escalabilidade e conformidade de jornada</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <input 
              type="date" 
              value={filterDate || ''}
              onChange={e => setFilterDate(e.target.value)}
              className="px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 rounded-xl font-black uppercase text-[10px] tracking-widest outline-none border-2 border-transparent focus:border-yellow-400 transition-all flex-1 md:flex-initial"
            />
            
            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPDF}
              className="px-5 py-3 bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md border border-slate-700 dark:border-zinc-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              title="Gerar PDF da Escala de Turnos"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 size={16} className="animate-spin text-yellow-400" />
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <Download size={16} className="text-yellow-400" />
                  <span>Gerar PDF</span>
                </>
              )}
            </button>

            <button 
              onClick={() => { 
                setEditingShift({ 
                  date: filterDate, 
                  start_time: '00:00', 
                  end_time: '00:00',
                  standard_interval: '00:00',
                  saturday_clock_in: '00:00',
                  saturday_clock_out: '00:00',
                  saturday_interval: '00:00',
                  sunday_clock_in: '00:00',
                  sunday_clock_out: '00:00',
                  sunday_interval: '00:00',
                  daily_hours_target: '08:00',
                  scale_type: '6x1'
                }); 
                setIsModalOpen(true); 
              }}
              className="px-6 py-3 bg-yellow-400 text-slate-900 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg border-2 border-slate-900 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus size={18} /> Novo Turno
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* MAIN LIST */}
        <div className="lg:col-span-2 space-y-4">
          {filteredShifts.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-zinc-800">
              <Calendar className="mx-auto text-slate-200 mb-4" size={48}/>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum turno escalado para esta data.</p>
            </div>
          ) : (
            filteredShifts.map(shift => {
              const driver = drivers.find(d => d.id === shift.driver_id);
              const route = routes.find(r => r.id === shift.route_id);
              return (
                <div key={shift.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-slate-400">
                      {driver?.photo_url ? <img src={driver.photo_url} className="w-full h-full object-cover rounded-2xl" /> : <UserIcon size={24}/>}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-sm leading-tight">{driver?.full_name || driver?.name || 'Motorista não encontrado'}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                          <MapPin size={12}/> {route?.origin} → {route?.destination}
                        </p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Clock size={12}/> {shift.start_time} - {shift.end_time}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => { setEditingShift(shift); setIsModalOpen(true); }} className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Clock size={20}/></button>
                    <button onClick={() => onDeleteShift(shift.id)} className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* SIDEBAR INFO */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white border-4 border-yellow-400 shadow-xl">
            <h3 className="text-xl font-black uppercase italic mb-6 flex items-center gap-3">
              <AlertCircle className="text-yellow-400"/> Status da Frota
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-[10px] font-black uppercase text-slate-400">Motoristas Ativos</span>
                <span className="text-xl font-black">{availableDrivers.length}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-[10px] font-black uppercase text-slate-400">Turnos Hoje</span>
                <span className="text-xl font-black">{shifts.filter(s => s.date === new Date().toISOString().split('T')[0]).length}</span>
              </div>
              <p className="text-[9px] text-slate-500 uppercase leading-relaxed mt-4">
                O sistema monitora automaticamente o intervalo interjornada de 11 horas conforme a CLT.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden flex flex-col max-h-[90vh] relative z-10"
            >
              <div className="p-8 border-b dark:border-zinc-800 bg-slate-900 flex justify-between items-center text-white">
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">{editingShift?.id ? 'Editar Turno' : 'Novo Turno'}</h3>
                  <p className="text-[9px] font-black text-yellow-400 uppercase mt-1">Escala de Trabalho</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white/10 rounded-2xl hover:bg-red-500 transition-colors"><X size={24}/></button>
              </div>
              
              <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Motorista *</label>
                  <select 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold outline-none focus:border-yellow-400 dark:text-white transition-all"
                    value={editingShift?.driver_id || ''}
                    onChange={e => setEditingShift({...editingShift, driver_id: e.target.value})}
                  >
                    <option value="">Selecione o motorista</option>
                    {availableDrivers.map(d => <option key={d.id} value={d.id}>{d.full_name || d.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Itinerário *</label>
                  <select 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold outline-none focus:border-yellow-400 dark:text-white transition-all"
                    value={editingShift?.route_id || ''}
                    onChange={e => setEditingShift({...editingShift, route_id: e.target.value})}
                  >
                    <option value="">Selecione a rota</option>
                    {routes.map(r => <option key={r.id} value={r.id}>{r.prefixo_linha} - {r.origin} / {r.destination}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Data *</label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold outline-none focus:border-yellow-400 dark:text-white transition-all"
                    value={editingShift?.date || ''}
                    onChange={e => handleDateChange(e.target.value)}
                  />
                </div>

                <div className="pt-4 border-t dark:border-zinc-800">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Tipo de Escala</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['6x1', '5x1', '5x2', '12x36', 'Custom'].map(type => (
                      <button
                        key={type}
                        onClick={() => setEditingShift({...editingShift, scale_type: type})}
                        className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all border-2 ${
                          editingShift?.scale_type === type 
                            ? 'bg-yellow-400 border-slate-900 text-slate-900' 
                            : 'bg-slate-50 dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 text-slate-400'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t dark:border-zinc-800">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-200 dark:border-zinc-800 pb-2">Dias Úteis</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Entrada</label>
                        <input type="time" className="w-full px-3 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-xl font-bold outline-none focus:border-yellow-400" value={editingShift?.start_time || '00:00'} onChange={e => setEditingShift({...editingShift, start_time: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Saída</label>
                        <input type="time" className="w-full px-3 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-xl font-bold outline-none focus:border-yellow-400" value={editingShift?.end_time || '00:00'} onChange={e => setEditingShift({...editingShift, end_time: e.target.value})} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Intervalo</label>
                        <input type="time" className="w-full px-3 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-xl font-bold outline-none focus:border-yellow-400" value={editingShift?.standard_interval || '00:00'} onChange={e => setEditingShift({...editingShift, standard_interval: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-200 dark:border-zinc-800 pb-2">Sábado</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Entrada</label>
                        <input type="time" className="w-full px-3 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-xl font-bold outline-none focus:border-yellow-400" value={editingShift?.saturday_clock_in || '00:00'} onChange={e => setEditingShift({...editingShift, saturday_clock_in: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Saída</label>
                        <input type="time" className="w-full px-3 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-xl font-bold outline-none focus:border-yellow-400" value={editingShift?.saturday_clock_out || '00:00'} onChange={e => setEditingShift({...editingShift, saturday_clock_out: e.target.value})} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Intervalo</label>
                        <input type="time" className="w-full px-3 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-xl font-bold outline-none focus:border-yellow-400" value={editingShift?.saturday_interval || '00:00'} onChange={e => setEditingShift({...editingShift, saturday_interval: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 md:col-span-2">
                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-200 dark:border-zinc-800 pb-2">Domingo / Feriados</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Entrada</label>
                        <input type="time" className="w-full px-3 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-xl font-bold outline-none focus:border-yellow-400" value={editingShift?.sunday_clock_in || '00:00'} onChange={e => setEditingShift({...editingShift, sunday_clock_in: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Saída</label>
                        <input type="time" className="w-full px-3 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-xl font-bold outline-none focus:border-yellow-400" value={editingShift?.sunday_clock_out || '00:00'} onChange={e => setEditingShift({...editingShift, sunday_clock_out: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Intervalo</label>
                        <input type="time" className="w-full px-3 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-xl font-bold outline-none focus:border-yellow-400" value={editingShift?.sunday_interval || '00:00'} onChange={e => setEditingShift({...editingShift, sunday_interval: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t dark:border-zinc-800 col-span-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Meta de Horas Diárias (HH:MM) *</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-4 text-slate-400" size={18}/>
                      <input 
                        type="time"
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold outline-none focus:border-yellow-400 dark:text-white transition-all"
                        value={editingShift?.daily_hours_target || '08:00'}
                        onChange={e => setEditingShift({...editingShift, daily_hours_target: e.target.value})}
                      />
                    </div>
                    <p className="text-[8px] text-slate-400 mt-2 italic font-bold uppercase tracking-widest pl-2">Padrão sugerido: 08:00</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSave}
                className="w-full py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 border-2 border-slate-900 transition-all flex items-center justify-center gap-2"
              >
                <Save size={20}/> Salvar Turno
              </button>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriverShiftManager;
