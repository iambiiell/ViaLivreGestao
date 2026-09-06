import React, { useState, useEffect } from 'react';
import { DriverLog } from '../types';
import { db } from '../services/database';
import DailyLogTab from './DailyLogTab';
import { Plus, Search, Calendar, User, Bus, ChevronLeft, FileText } from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';

const DailyLogsView: React.FC = () => {
  const [logs, setLogs] = useState<DriverLog[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DriverLog | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await db.getDriverLogs();
      setLogs(data as DriverLog[]);
    } catch (error) {
      console.error("Error loading logs", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (logData: Partial<DriverLog>) => {
    try {
      if (logData.id) {
        await db.update('driver_logs', logData as DriverLog);
      } else {
        await db.create('driver_logs', logData);
      }
      setIsEditing(false);
      loadLogs();
    } catch (error) {
      console.error("Error saving log", error);
    }
  };

  if (isEditing) {
    return (
      <div className="p-4 md:p-8 animate-in fade-in slide-in-from-right duration-500">
        <button onClick={() => setIsEditing(false)} className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-yellow-600 transition-colors"><ChevronLeft size={16}/> Voltar para lista</button>
        <h2 className="text-2xl font-black uppercase italic mb-8 dark:text-white">Novo Diário de Bordo</h2>
        <DailyLogTab log={selectedLog} onSave={handleSave} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter dark:text-white leading-none">Diário de Bordo</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Controle de Jornada e Checklist de Veículos</p>
        </div>
        <button onClick={() => { setSelectedLog(undefined); setIsEditing(true); }} className="w-full md:w-auto px-8 py-4 bg-yellow-400 text-slate-900 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 border-2 border-slate-900 hover:bg-yellow-300 transition-all">
          <Plus size={18}/> Novo Registro
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border-2 border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden min-h-[400px]">
        {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full py-20 opacity-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mb-4"></div>
                <p className="text-[10px] font-black uppercase tracking-widest">Carregando...</p>
            </div>
        ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 opacity-30">
                <FileText size={48} className="mb-4"/>
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhum registro encontrado</p>
            </div>
        ) : (
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-zinc-800/50">
                            <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                            <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Motorista</th>
                            <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Veículo</th>
                            <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">KM Rodados</th>
                            <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Avarias</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-zinc-800">
                        {logs.map(log => (
                            <tr key={log.id} onClick={() => { setSelectedLog(log); setIsEditing(true); }} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors group">
                                <td className="px-8 py-6 text-xs font-bold dark:text-zinc-300">{formatDate(log.created_at)}</td>
                                <td className="px-8 py-6 text-xs font-bold dark:text-zinc-300">{log.driver_id}</td>
                                <td className="px-8 py-6 text-xs font-bold dark:text-zinc-300">{log.vehicle_id}</td>
                                <td className="px-8 py-6 text-center text-xs font-bold dark:text-zinc-300">{(log.odometer_end - log.odometer_start).toFixed(1)} km</td>
                                <td className="px-8 py-6 text-center">
                                    {log.damage_reported ? 
                                        <span className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-[9px] font-black uppercase">Sim</span> : 
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase">Não</span>
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>
    </div>
  );
};

export default DailyLogsView;
