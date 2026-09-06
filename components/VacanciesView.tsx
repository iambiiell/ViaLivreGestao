
import React from 'react';
import { Briefcase, MapPin, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { JobVacancy } from '../types';
import { formatDate } from '../utils/dateFormatter';

interface VacanciesViewProps {
  vacancies: JobVacancy[];
  onApply: (vacancy: JobVacancy) => void;
}

const VacanciesView: React.FC<VacanciesViewProps> = ({ vacancies, onApply }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {vacancies.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white dark:bg-zinc-900 rounded-[3rem] border border-slate-100 dark:border-zinc-800">
            <Briefcase className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma vaga disponível no momento.</p>
          </div>
        ) : (
          vacancies.map(vacancy => (
            <motion.div 
              key={vacancy.id} 
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm space-y-6 group hover:border-yellow-400 transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-lg border-2 border-slate-900">
                  <Briefcase className="text-slate-900" size={24} />
                </div>
                <div className="px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/30">
                  Vaga Ativa
                </div>
              </div>
              
              <div>
                <h4 className="text-lg font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-tight">{vacancy.job_title}</h4>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Calendar size={12} />
                    <span className="text-[9px] font-black uppercase">{formatDate(vacancy.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <MapPin size={12} />
                    <span className="text-[9px] font-black uppercase">ViaLivre Gestão</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Requisitos</p>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 line-clamp-3">{vacancy.requirements}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Benefícios</p>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 line-clamp-2">{vacancy.benefits}</p>
                </div>
              </div>

              <button 
                onClick={() => onApply(vacancy)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-black active:scale-95 transition-all"
              >
                Candidatar-se <ArrowRight size={16} />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default VacanciesView;
