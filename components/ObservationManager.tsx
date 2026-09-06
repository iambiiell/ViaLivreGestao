import React, { useState, useMemo } from 'react';
import { IssueReport, Trip, BusRoute, Vehicle, User, Notice, MaintenanceRecord } from '../types';
import { AlertTriangle, Clock, MapPin, Bus, UserCircle, CheckCircle, Trash2, X, ClipboardList, Wrench, Check, ShieldAlert, Loader2, Sparkles, DollarSign, Search, FileText, ArrowRightCircle, Download, Thermometer, Tag, Edit3, Save } from 'lucide-react';
import { estimateMaintenanceCost } from '../services/geminiService';
import { db } from '../services/database';
import { formatDate, formatDateTime } from '../utils/dateFormatter';

interface ObservationManagerProps {
  reports: IssueReport[];
  trips: Trip[];
  routes: BusRoute[];
  vehicles: Vehicle[];
  users: User[];
  onResolveReport: (id: string, metadata: string) => void;
  onDeleteReport: (id: string) => void;
  currentUser: User;
  initialOccurrenceId?: string;
}

const ObservationManager: React.FC<ObservationManagerProps> = ({ reports = [], trips = [], routes = [], vehicles = [], users = [], onResolveReport, onDeleteReport, currentUser, initialOccurrenceId }) => {
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [techReport, setTechReport] = useState('');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingReport, setEditingReport] = useState<IssueReport | null>(null);

  React.useEffect(() => {
    if (initialOccurrenceId && reports.length > 0) {
      const report = reports.find(r => r.id === initialOccurrenceId);
      if (report) {
        setSearchTerm(report.id.substring(0, 8)); // Try to filter by ID
      }
    }
  }, [initialOccurrenceId, reports]);

  React.useEffect(() => {
    const sub = db.subscribeTables(['occurrences', 'maintenance', 'notices'], () => {
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
    });
    return () => sub.unsubscribe();
  }, []);

  const isMechanic = currentUser.role === 'MECHANIC' || currentUser.role === 'ADMIN';
  const mechanicCategories = ['MECANICA', 'LIMPEZA'];

  const handleUpdateStatus = async (id: string, nextStatus: string) => {
      setIsProcessing(id);
      const now = new Date().toISOString();
      const r = reports.find(x => x.id === id);
      try {
          const updatePayload: any = { id, status: nextStatus };
          if (nextStatus === 'Em manutenção') {
              updatePayload.technician_report = `[PARADA TÉCNICA EM: ${formatDateTime(now)}]`;
              const trip = trips.find(t => t.id === r?.trip_id);
              const vehicle = vehicles.find(v => v.prefix === trip?.bus_number);
              if (vehicle) {
                  await db.update('vehicles', { ...vehicle, status: 'MANUTENCAO' });
              }
              await db.create<Notice>('notices', {
                  title: `🔧 Oficina: #${trip?.bus_number}`,
                  content: `Ativo #${trip?.bus_number} em processo de manutenção técnica.`,
                  category: 'MANUTENCAO', is_active: true, created_at: now
              });
          }
          await db.update('occurrences', updatePayload);
      } catch (e) { 
          console.error("[PATIO_ERROR] Falha ao atualizar status:", e);
      } finally { setIsProcessing(null); }
  };

  const handleFinishMaintenance = async () => {
      if (!activeReportId || !techReport) return;
      setIsProcessing(activeReportId);
      const now = new Date().toISOString();
      const originalReport = reports.find(r => r.id === activeReportId);
      const trip = trips.find(t => t.id === originalReport?.trip_id);
      const vehicle = vehicles.find(v => v.prefix === trip?.bus_number);

      try {
          const aiResult = await estimateMaintenanceCost(techReport);
          const startAt = originalReport?.technician_report?.match(/EM: (.*?)]/)?.[1] || 'N/A';
          const finalReport = `[INÍCIO: ${startAt}]\n[FIM: ${new Date(now).toLocaleString('pt-BR')}]\n[MECÂNICO: ${currentUser.full_name}]\n[IA_DEDUZIU: ${aiResult?.partDetails || 'Sem peças identificadas'}]\n------------------\nDETALHES: ${techReport}`;

          await db.update('occurrences', { 
              id: activeReportId, status: 'Concluído', technician_report: finalReport, estimated_cost_web: aiResult?.cost || 0
          } as any);

          if (vehicle) {
              await db.create<MaintenanceRecord>('maintenance' as any, {
                vehicle_id: vehicle.id,
                description: techReport,
                cost: aiResult?.cost || 0,
                date: now.split('T')[0],
                performed_by: currentUser.full_name || 'Mecânico',
                ai_parts_identified: aiResult?.partDetails || 'N/A',
                technical_report: finalReport
              });
              await db.update('vehicles', { ...vehicle, status: 'ATIVO', last_inspection: now.split('T')[0] });
          }

          setActiveReportId(null); setTechReport('');
      } catch (e) { 
          console.error("[IA_WORKSHOP_ERROR]", e);
      } finally { setIsProcessing(null); }
  };

  const handleSaveEdit = async () => {
      if (!editingReport) return;
      setIsProcessing(editingReport.id);
      try {
          await db.update('occurrences', editingReport);
          setEditingReport(null);
      } catch (e) {
          console.error("[PATIO_EDIT_ERROR]", e);
      } finally { setIsProcessing(null); }
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesSearch = r.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (r.type || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = isMechanic ? mechanicCategories.includes(r.category) : true;
      return matchesSearch && matchesCategory;
    });
  }, [reports, searchTerm, isMechanic]);

  return (
    <div className="space-y-6 animate-in fade-in pb-32 md:pb-8 transition-all">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800">
        <div className="flex-1 w-full">
           <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none transition-colors">Oficina & Chamados</h2>
           <div className="mt-6 relative max-w-md">
              <Search className="absolute left-4 top-4 text-slate-400" size={18} />
              <input type="text" placeholder="Pesquisar..." className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black outline-none dark:text-zinc-300 shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReports.map((item) => {
            const trip = trips.find(t => t.id === item.trip_id);
            const isResolved = item.status === 'Concluído';
            const isInProgress = item.status === 'Em manutenção';

            return (
                <div key={item.id} className={`bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-sm border-2 border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col group transition-all hover:shadow-xl ${isResolved ? 'opacity-80' : ''}`}>
                    <div className={`h-2.5 w-full ${isResolved ? 'bg-emerald-500' : isInProgress ? 'bg-indigo-500 animate-pulse' : 'bg-red-500'}`} />
                    <div className="p-6 flex-1">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-xs">{item.type || 'Ocorrência'}</h3>
                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{formatDate(item.timestamp)}</span>
                            </div>
                            <div className="flex gap-1 items-center">
                                <button onClick={() => setEditingReport(item)} className="p-2 text-slate-300 hover:text-indigo-500"><Edit3 size={16}/></button>
                                <button onClick={() => onDeleteReport(item.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 mb-6 italic text-[11px] font-bold text-slate-600 dark:text-zinc-300 leading-relaxed">"{item.description}"</div>
                        <div className="flex items-center justify-between text-[9px] font-black uppercase text-slate-400">
                            <div className="flex items-center gap-2"><Bus size={14} className="text-indigo-500"/> VTR #{trip?.bus_number}</div>
                            <div className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">{item.category}</div>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-950 p-6 border-t dark:border-zinc-800">
                        {isResolved ? (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl text-emerald-600 text-[10px] font-black uppercase text-center">Registrado e Finalizado</div>
                        ) : isMechanic && (
                            <div className="flex flex-col gap-2">
                                {!isInProgress ? (
                                    <button disabled={isProcessing === item.id} onClick={() => handleUpdateStatus(item.id, 'Em manutenção')} className="w-full bg-indigo-600 text-white py-4 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 flex items-center justify-center gap-2">
                                      {isProcessing === item.id ? <Loader2 className="animate-spin" size={16}/> : <Wrench size={16}/>} Abrir Ordem de Serviço
                                    </button>
                                ) : (
                                    <button onClick={() => setActiveReportId(item.id)} className="w-full bg-emerald-600 text-white py-4 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 flex items-center justify-center gap-2"><Check size={16}/> Laudar e Fechar</button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )
        })}
      </div>

      {editingReport && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
              <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[3rem] shadow-2xl border-4 border-indigo-500 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center">
                      <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic">Editar Registro</h3>
                      <button onClick={() => setEditingReport(null)} className="text-slate-400 hover:rotate-90 transition-transform"><X size={32}/></button>
                  </div>
                  <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Categoria</label>
                              <select className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 outline-none" value={editingReport.category} onChange={e => setEditingReport({...editingReport, category: e.target.value as any})}>
                                  <option value="MECANICA">MECÂNICA</option>
                                  <option value="TRANSITO">TRÂNSITO</option>
                                  <option value="PASSAGEIRO">PASSAGEIRO</option>
                                  <option value="LIMPEZA">LIMPEZA</option>
                                  <option value="OUTROS">OUTROS</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Severidade</label>
                              <select className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 outline-none" value={editingReport.severity} onChange={e => setEditingReport({...editingReport, severity: e.target.value as any})}>
                                  <option value="BAIXA">BAIXA</option>
                                  <option value="MEDIA">MÉDIA</option>
                                  <option value="ALTA">ALTA</option>
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Relato do Problema</label>
                          <textarea rows={4} className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 outline-none resize-none" value={editingReport.description || ''} onChange={e => setEditingReport({...editingReport, description: e.target.value})} />
                      </div>
                      <div className="flex gap-4">
                          <button onClick={() => setEditingReport(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                          <button disabled={isProcessing === editingReport.id} onClick={handleSaveEdit} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95 flex items-center justify-center gap-2">
                              {isProcessing === editingReport.id ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Confirmar Alteração
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeReportId && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[300] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
              <div className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-[3rem] shadow-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden">
                  <div className="bg-emerald-600 p-8 text-center text-white relative">
                      <Wrench size={48} className="mx-auto mb-4"/><h3 className="text-xl font-black uppercase italic tracking-tighter">Laudo Final IA</h3>
                      <button onClick={() => setActiveReportId(null)} className="absolute top-6 right-6 text-emerald-200"><X size={24}/></button>
                  </div>
                  <div className="p-8 space-y-6 bg-white dark:bg-zinc-950">
                      <p className="text-[10px] font-black text-slate-400 uppercase text-center leading-relaxed">Descreva o serviço para análise de custos e peças via IA.</p>
                      <textarea rows={5} className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-900 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500 shadow-inner" value={techReport || ''} onChange={e => setTechReport(e.target.value)} placeholder="Ex: Substituição da mangueira do turbo..." />
                      <div className="flex gap-3">
                          <button onClick={() => setActiveReportId(null)} className="flex-1 py-5 text-[10px] font-black uppercase text-slate-400">Voltar</button>
                          <button disabled={!techReport.trim() || isProcessing === activeReportId} onClick={handleFinishMaintenance} className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95 flex items-center justify-center gap-2">
                              {isProcessing === activeReportId ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} Enviar para IA
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ObservationManager;