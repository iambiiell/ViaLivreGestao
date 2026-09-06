import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  X, 
  Play, 
  CheckCircle2, 
  RotateCcw, 
  Calendar, 
  Ticket, 
  Bus, 
  Clock, 
  Compass, 
  BookOpen, 
  HelpCircle,
  Keyboard,
  ArrowRight
} from 'lucide-react';
import { TOURS, TourDefinition, getCompletedTours, markTourCompleted, resetCompletedTours, startGuidedTour } from '../services/guidedTour';

interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentView?: string | any;
  onChangeView: (view: any) => void;
  addToast?: (msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

export const GuidedTourModal: React.FC<GuidedTourModalProps> = ({
  isOpen,
  onClose,
  currentView,
  onChangeView,
  addToast
}) => {
  const [completedList, setCompletedList] = useState<string[]>(() => getCompletedTours());
  const [activeTab, setActiveTab] = useState<'tours' | 'shortcuts'>('tours');

  if (!isOpen) return null;

  const handleStartTour = (tour: TourDefinition) => {
    onClose();
    if (addToast) {
      addToast(`Iniciando tour: "${tour.title}"`, 'info');
    }
    startGuidedTour(tour.id, {
      onChangeView,
      onFinish: () => {
        setCompletedList(getCompletedTours());
        if (addToast) {
          addToast(`Tour "${tour.title}" concluído com sucesso!`, 'success');
        }
      }
    });
  };

  const handleResetProgress = () => {
    resetCompletedTours();
    setCompletedList([]);
    if (addToast) {
      addToast('Progresso dos tours reiniciado!', 'info');
    }
  };

  const getIcon = (name: string) => {
    switch (name) {
      case 'Sparkles': return <Sparkles size={22} className="text-yellow-500 dark:text-yellow-400" />;
      case 'Calendar': return <Calendar size={22} className="text-blue-500 dark:text-blue-400" />;
      case 'Ticket': return <Ticket size={22} className="text-emerald-500 dark:text-emerald-400" />;
      case 'Bus': return <Bus size={22} className="text-amber-500 dark:text-amber-400" />;
      case 'Clock': return <Clock size={22} className="text-purple-500 dark:text-purple-400" />;
      default: return <Compass size={22} className="text-yellow-500" />;
    }
  };

  const completedCount = TOURS.filter(t => completedList.includes(t.id)).length;
  const progressPercent = Math.round((completedCount / TOURS.length) * 100);

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md cursor-pointer"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="w-full max-w-3xl bg-white dark:bg-zinc-900 border-2 border-slate-200/80 dark:border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 sm:p-8 bg-gradient-to-br from-yellow-400/10 via-transparent to-transparent border-b border-slate-100 dark:border-zinc-800 relative">
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-all"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3.5 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-yellow-400/20 font-black">
                <Sparkles size={24} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-yellow-600 dark:text-yellow-400 tracking-widest block">
                  Treinamento & Integração
                </span>
                <h2 className="text-xl sm:text-2xl font-black uppercase text-slate-900 dark:text-white tracking-tight">
                  Tours Guiados Interativos
                </h2>
              </div>
            </div>

            <p className="text-xs font-medium text-slate-600 dark:text-zinc-400 mt-2 max-w-xl leading-relaxed">
              Explore o sistema passo a passo com destaques visuais inteligentes nos botões, tabelas e menus. Perfeito para novos operadores ou para descobrir novos atalhos.
            </p>

            {/* Barra de Progresso Geral */}
            <div className="mt-5 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-[11px] font-black uppercase tracking-wider mb-1.5">
                  <span className="text-slate-600 dark:text-zinc-400">Progresso do Treinamento</span>
                  <span className="text-yellow-600 dark:text-yellow-400">{completedCount} de {TOURS.length} Concluídos ({progressPercent}%)</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {completedCount > 0 && (
                <button
                  onClick={handleResetProgress}
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors self-end sm:self-center shrink-0"
                  title="Limpar histórico para refazer os tours"
                >
                  <RotateCcw size={12} />
                  Resetar Progresso
                </button>
              )}
            </div>

            {/* Abas */}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setActiveTab('tours')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'tours'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                <Compass size={14} />
                Módulos de Tour
              </button>
              <button
                onClick={() => setActiveTab('shortcuts')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'shortcuts'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                <Keyboard size={14} />
                Atalhos & Dicas Rápidas
              </button>
            </div>
          </div>

          {/* Conteúdo com rolagem */}
          <div className="p-6 sm:p-8 overflow-y-auto space-y-4 custom-scrollbar flex-1">
            {activeTab === 'tours' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TOURS.map((tour) => {
                  const isDone = completedList.includes(tour.id);
                  return (
                    <div
                      key={tour.id}
                      className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between group ${
                        isDone
                          ? 'border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40'
                          : 'border-yellow-400/40 dark:border-yellow-400/30 bg-white dark:bg-zinc-900 shadow-sm hover:border-yellow-400 hover:shadow-lg'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                            {getIcon(tour.iconName)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                              {tour.duration}
                            </span>
                            {isDone && (
                              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                                <CheckCircle2 size={12} />
                                Concluído
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider">
                          {tour.category}
                        </span>
                        <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white mt-0.5 mb-1.5 leading-snug">
                          {tour.title}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 leading-relaxed">
                          {tour.subtitle}
                        </p>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-400">
                          {tour.steps.length} passos
                        </span>

                        <button
                          onClick={() => handleStartTour(tour)}
                          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
                            isDone
                              ? 'bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 hover:bg-yellow-400 hover:text-slate-950'
                              : 'bg-yellow-400 text-slate-950 hover:bg-yellow-300 shadow-md shadow-yellow-400/20'
                          }`}
                        >
                          <Play size={13} fill="currentColor" />
                          {isDone ? 'Refazer Tour' : 'Iniciar Tour'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-zinc-800">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Keyboard size={16} className="text-yellow-500" />
                    Teclas de Atalho Principais
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                      <span className="text-slate-600 dark:text-zinc-400 font-medium">Busca rápida global</span>
                      <kbd className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[10px] font-black font-mono border border-slate-200 dark:border-zinc-700">ESC / Foco</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                      <span className="text-slate-600 dark:text-zinc-400 font-medium">Navegar no Tour</span>
                      <kbd className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[10px] font-black font-mono border border-slate-200 dark:border-zinc-700">← / → / Enter</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                      <span className="text-slate-600 dark:text-zinc-400 font-medium">Fechar Modais / Tour</span>
                      <kbd className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[10px] font-black font-mono border border-slate-200 dark:border-zinc-700">ESC</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                      <span className="text-slate-600 dark:text-zinc-400 font-medium">Troca de Tema</span>
                      <kbd className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[10px] font-black font-mono border border-slate-200 dark:border-zinc-700">Topo / Sol/Lua</kbd>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-3xl bg-yellow-400/10 border border-yellow-400/30 flex items-start gap-3.5">
                  <HelpCircle size={20} className="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-black uppercase text-yellow-800 dark:text-yellow-300 mb-1">
                      Dica Operacional ViaLivre
                    </h5>
                    <p className="text-xs text-yellow-900/80 dark:text-yellow-200/80 font-medium leading-relaxed">
                      Ao selecionar uma viagem ou venda de bilhete, você sempre pode conferir o status de sincronização no topo da tela para garantir que todos os dados foram salvos no servidor principal.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 bg-slate-50 dark:bg-zinc-950/80 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:block">
              ViaLivre Tour Guide v1.5
            </div>
            <button
              onClick={() => handleStartTour(TOURS[0])}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-yellow-300 active:scale-95 transition-all shadow-md"
            >
              <Play size={14} fill="currentColor" />
              Iniciar Tour Geral Completo
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default GuidedTourModal;

