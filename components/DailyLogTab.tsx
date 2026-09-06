import React, { useState } from 'react';
import { DriverLog } from '../types';
import { CheckCircle2, AlertTriangle, Fuel, Disc, Lightbulb, FileText, Trash2 } from 'lucide-react';

interface DailyLogTabProps {
  log?: DriverLog;
  onSave: (logData: Partial<DriverLog>) => void;
}

const DailyLogTab: React.FC<DailyLogTabProps> = ({ log, onSave }) => {
  const [formData, setFormData] = useState<Partial<DriverLog>>(log || {
    odometer_start: 0,
    odometer_end: 0,
    fuel_level_start: 'FULL',
    tire_condition_ok: true,
    lights_condition_ok: true,
    documents_ok: true,
    internal_cleaning_ok: true,
    damage_reported: false,
    notes: '',
    trip_occurrences: '',
    damage_details: ''
  });

  const handleChange = (field: keyof DriverLog, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Checklist Saída */}
      <div className="bg-slate-50 dark:bg-zinc-900 p-6 md:p-8 rounded-[2.5rem] border-2 border-slate-200 dark:border-zinc-800">
        <h3 className="text-sm font-black uppercase text-slate-500 mb-6 flex items-center gap-2 tracking-widest"><CheckCircle2 size={18} className="text-emerald-500"/> Checklist de Saída (Garagem)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">KM Inicial</label>
            <input type="number" className="w-full px-5 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-yellow-400 transition-all dark:text-white" value={formData.odometer_start || ''} onChange={e => handleChange('odometer_start', parseFloat(e.target.value))} placeholder="000000" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Nível de Combustível</label>
            <select className="w-full px-5 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-yellow-400 transition-all dark:text-white appearance-none" value={formData.fuel_level_start || 'FULL'} onChange={e => handleChange('fuel_level_start', e.target.value)}>
              <option value="FULL">Cheio</option>
              <option value="3/4">3/4</option>
              <option value="1/2">1/2</option>
              <option value="1/4">1/4</option>
              <option value="RESERVE">Reserva</option>
            </select>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-slate-100 dark:border-zinc-700">
            <input type="checkbox" checked={formData.tire_condition_ok || false} onChange={e => handleChange('tire_condition_ok', e.target.checked)} className="w-6 h-6 accent-emerald-500 rounded-lg cursor-pointer" />
            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 cursor-pointer select-none">Condição dos Pneus OK</label>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-slate-100 dark:border-zinc-700">
            <input type="checkbox" checked={formData.lights_condition_ok || false} onChange={e => handleChange('lights_condition_ok', e.target.checked)} className="w-6 h-6 accent-emerald-500 rounded-lg cursor-pointer" />
            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 cursor-pointer select-none">Funcionamento das Luzes OK</label>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-slate-100 dark:border-zinc-700">
            <input type="checkbox" checked={formData.documents_ok || false} onChange={e => handleChange('documents_ok', e.target.checked)} className="w-6 h-6 accent-emerald-500 rounded-lg cursor-pointer" />
            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 cursor-pointer select-none">Presença de Documentos OK</label>
          </div>
        </div>
      </div>

      {/* Checklist Chegada */}
      <div className="bg-slate-50 dark:bg-zinc-900 p-6 md:p-8 rounded-[2.5rem] border-2 border-slate-200 dark:border-zinc-800">
        <h3 className="text-sm font-black uppercase text-slate-500 mb-6 flex items-center gap-2 tracking-widest"><CheckCircle2 size={18} className="text-blue-500"/> Checklist de Chegada</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">KM Final</label>
            <input type="number" className="w-full px-5 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-yellow-400 transition-all dark:text-white" value={formData.odometer_end || ''} onChange={e => handleChange('odometer_end', parseFloat(e.target.value))} placeholder="000000" />
          </div>
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-slate-100 dark:border-zinc-700 mt-6">
            <input type="checkbox" checked={formData.internal_cleaning_ok || false} onChange={e => handleChange('internal_cleaning_ok', e.target.checked)} className="w-6 h-6 accent-emerald-500 rounded-lg cursor-pointer" />
            <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 cursor-pointer select-none">Limpeza Interna OK</label>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Ocorrências no Trajeto</label>
            <textarea className="w-full px-5 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:border-yellow-400 transition-all dark:text-white h-32 resize-none" value={formData.trip_occurrences || ''} onChange={e => handleChange('trip_occurrences', e.target.value)} placeholder="Descreva ocorrências..." />
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center gap-4 mb-4 p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border-2 border-red-100 dark:border-red-900/30">
               <input type="checkbox" checked={formData.damage_reported || false} onChange={e => handleChange('damage_reported', e.target.checked)} className="w-6 h-6 accent-red-500 rounded-lg cursor-pointer" />
               <label className="text-xs font-black uppercase text-red-500 cursor-pointer select-none flex items-center gap-2"><AlertTriangle size={16}/> Relatar Avarias</label>
            </div>
            {formData.damage_reported && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-[10px] font-black text-red-400 uppercase mb-1 ml-2">Detalhes da Avaria</label>
                <textarea className="w-full px-5 py-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl font-bold outline-none focus:border-red-400 transition-all text-red-700 dark:text-red-300 placeholder-red-300 h-32 resize-none" value={formData.damage_details || ''} onChange={e => handleChange('damage_details', e.target.value)} placeholder="Descreva as avarias encontradas..." />
              </div>
            )}
          </div>
        </div>
      </div>

      <button onClick={() => onSave(formData)} className="w-full py-5 bg-emerald-500 text-white rounded-3xl font-black uppercase text-xs shadow-xl hover:bg-emerald-600 active:scale-95 transition-all border-4 border-emerald-400/50 flex items-center justify-center gap-2">
        <CheckCircle2 size={20}/> Salvar Diário de Bordo
      </button>
    </div>
  );
};

export default DailyLogTab;
