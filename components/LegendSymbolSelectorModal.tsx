import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Tag, 
  Check, 
  Sparkles, 
  Trash2, 
  Clock, 
  Eye, 
  Info,
  Layers,
  Calendar,
  CheckSquare,
  Square,
  ListChecks
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface LegendOption {
  symbol: string;
  text: string;
  time?: string;
}

export type OperationDayKey = 'weekdays' | 'saturday' | 'sunday';

export interface LegendSymbolSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (legend: { 
    symbol: string; 
    text: string;
    selectedTimesByDay: Record<OperationDayKey, string[]>;
    originalSymbol?: string;
  }) => void;
  onDelete?: () => void;
  onDeleteFromTargetTime?: () => void;
  initialSymbol?: string;
  initialText?: string;
  originalSymbol?: string;
  targetTime?: string;
  targetDay?: OperationDayKey;
  availableTimesByDay?: Record<OperationDayKey, string[]>;
  initialSelectedTimesByDay?: Partial<Record<OperationDayKey, string[]>>;
  existingLegends?: { symbol: string; text: string }[];
  symbolTimesMap?: Record<string, Record<OperationDayKey, string[]>>;
  title?: string;
}

const PRESET_CATEGORIES = [
  {
    category: 'Ícones & Emojis Visuais',
    items: [
      { sym: '🚌', label: 'Ônibus Regular', defaultText: 'Atendimento com Ônibus Convencional' },
      { sym: '⚡', label: 'Expresso / Rápido', defaultText: 'Linha Expressa sem paradas intermediárias' },
      { sym: '📍', label: 'Via Centro', defaultText: 'Passa pelo Centro Comercial' },
      { sym: '⭐', label: 'Destaque / Especial', defaultText: 'Horário com Atendimento Especial' },
      { sym: '🌙', label: 'Noturno / Madrugada', defaultText: 'Horário Noturno / Corujão' },
      { sym: '🏢', label: 'Centro / Bairro', defaultText: 'Atendimento aos Centros Empresariais' },
      { sym: '🏫', label: 'Escolar / Estudantes', defaultText: 'Atendimento aos Estudantes e Escolas' },
      { sym: '🏥', label: 'Hospital / Saúde', defaultText: 'Atendimento à Região Hospitalar' },
      { sym: '✈️', label: 'Aeroporto', defaultText: 'Atendimento direto ao Terminal Aeroportuário' },
      { sym: '🔄', label: 'Circular', defaultText: 'Linha Circular / Retorno Contínuo' },
      { sym: '⏱️', label: 'Semidireto', defaultText: 'Viagem Semidireta / Poucas Paradas' }
    ]
  },
  {
    category: 'Asteriscos & Marcadores',
    items: [
      { sym: '*', label: 'Asterisco Simples', defaultText: 'Observação 1 de Itinerário' },
      { sym: '**', label: 'Asterisco Duplo', defaultText: 'Observação 2 de Itinerário' },
      { sym: '***', label: 'Asterisco Triplo', defaultText: 'Observação 3 de Itinerário' },
      { sym: '•', label: 'Ponto Médio', defaultText: 'Atendimento com desvio de rota' },
      { sym: '†', label: 'Cruz / Dólar', defaultText: 'Horário sujeito a confirmação' },
      { sym: '‡', label: 'Cruz Dupla', defaultText: 'Atendimento aos finais de semana' },
      { sym: '#', label: 'Cerquilha / Grade', defaultText: 'Atendimento em período letivo' },
      { sym: '§', label: 'Parágrafo', defaultText: 'Atendimento estendido' }
    ]
  },
  {
    category: 'Numéricos & Índices',
    items: [
      { sym: '(1)', label: 'Opção 1', defaultText: 'Itinerário Alternativo 1' },
      { sym: '(2)', label: 'Opção 2', defaultText: 'Itinerário Alternativo 2' },
      { sym: '(3)', label: 'Opção 3', defaultText: 'Itinerário Alternativo 3' },
      { sym: '(4)', label: 'Opção 4', defaultText: 'Itinerário Alternativo 4' },
      { sym: '①', label: 'Círculo 1', defaultText: 'Variação de trajeto 1' },
      { sym: '②', label: 'Círculo 2', defaultText: 'Variação de trajeto 2' },
      { sym: '③', label: 'Círculo 3', defaultText: 'Variação de trajeto 3' },
      { sym: '[1]', label: 'Colchete 1', defaultText: 'Itinerário via Bairro 1' },
      { sym: '[2]', label: 'Colchete 2', defaultText: 'Itinerário via Bairro 2' }
    ]
  },
  {
    category: 'Alfabéticos',
    items: [
      { sym: '(A)', label: 'Letra A', defaultText: 'Variante A de Itinerário' },
      { sym: '(B)', label: 'Letra B', defaultText: 'Variante B de Itinerário' },
      { sym: '(C)', label: 'Letra C', defaultText: 'Variante C de Itinerário' },
      { sym: '(D)', label: 'Letra D', defaultText: 'Variante D de Itinerário' },
      { sym: 'Ⓐ', label: 'Círculo A', defaultText: 'Trajeto A' },
      { sym: 'Ⓑ', label: 'Círculo B', defaultText: 'Trajeto B' },
      { sym: 'Ⓒ', label: 'Círculo C', defaultText: 'Trajeto C' },
      { sym: 'A', label: 'Letra Pura A', defaultText: 'Ramal A' },
      { sym: 'B', label: 'Letra Pura B', defaultText: 'Ramal B' }
    ]
  },
  {
    category: 'Siglas Operacionais',
    items: [
      { sym: 'CTR', label: 'Centro', defaultText: 'Passa pelo Centro Comercial' },
      { sym: 'EXP', label: 'Expresso', defaultText: 'Linha Expressa sem paradas locais' },
      { sym: 'DIR', label: 'Direto', defaultText: 'Viagem Direta entre Terminais' },
      { sym: 'ROD', label: 'Rodoviária', defaultText: 'Atende ao Terminal Rodoviário' },
      { sym: 'ESC', label: 'Escolar', defaultText: 'Atendimento especial a estudantes' },
      { sym: 'NOT', label: 'Noturno', defaultText: 'Horário Noturno de Operação' },
      { sym: 'VAR', label: 'Variante', defaultText: 'Variante de Itinerário Secundário' },
      { sym: 'VIA', label: 'Via', defaultText: 'Via Alternativa' },
      { sym: 'HOS', label: 'Hospital', defaultText: 'Atendimento ao Complexo Hospitalar' },
      { sym: 'SEM', label: 'Semidireto', defaultText: 'Atendimento Semidireto' }
    ]
  },
  {
    category: 'Formas Geométricas',
    items: [
      { sym: '▲', label: 'Triângulo', defaultText: 'Sentido Alternativo' },
      { sym: '●', label: 'Círculo', defaultText: 'Parada no Terminal Central' },
      { sym: '◆', label: 'Losango', defaultText: 'Trajeto com Baldeação' },
      { sym: '■', label: 'Quadrado', defaultText: 'Ponto Final Estendido' },
      { sym: '★', label: 'Estrela', defaultText: 'Horário de Pico com Reforço' }
    ]
  }
];

const DAY_LABELS: Record<OperationDayKey, { label: string; short: string }> = {
  weekdays: { label: 'Segunda a Sexta (Dias Úteis)', short: 'Dias Úteis' },
  saturday: { label: 'Sábados', short: 'Sábado' },
  sunday: { label: 'Domingos e Feriados', short: 'Domingo' }
};

export const LegendSymbolSelectorModal: React.FC<LegendSymbolSelectorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onDeleteFromTargetTime,
  initialSymbol = '*',
  initialText = '',
  originalSymbol,
  targetTime,
  targetDay = 'weekdays',
  availableTimesByDay = { weekdays: [], saturday: [], sunday: [] },
  initialSelectedTimesByDay,
  existingLegends = [],
  symbolTimesMap = {},
  title = 'Identificação do Símbolo da Legenda'
}) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [text, setText] = useState(initialText);
  const [activeTab, setActiveTab] = useState(0);

  // Múltiplos dias selecionados
  const [activeDayTabs, setActiveDayTabs] = useState<OperationDayKey[]>(['weekdays', 'saturday']);
  const [currentDayTab, setCurrentDayTab] = useState<OperationDayKey>(targetDay);
  
  // Horários selecionados por dia
  const [selectedTimesByDay, setSelectedTimesByDay] = useState<Record<OperationDayKey, string[]>>({
    weekdays: [],
    saturday: [],
    sunday: []
  });

  const [customInputTime, setCustomInputTime] = useState('');

  useEffect(() => {
    if (isOpen) {
      const activeSym = initialSymbol || '*';
      setSymbol(activeSym);
      setCurrentDayTab(targetDay);

      // Prepara seleção inicial
      const initialMap: Record<OperationDayKey, string[]> = {
        weekdays: initialSelectedTimesByDay?.weekdays ? [...initialSelectedTimesByDay.weekdays] : [],
        saturday: initialSelectedTimesByDay?.saturday ? [...initialSelectedTimesByDay.saturday] : [],
        sunday: initialSelectedTimesByDay?.sunday ? [...initialSelectedTimesByDay.sunday] : []
      };

      // Se temos horários já mapeados para o símbolo inicial, mescla-os
      const cleanSymKey = activeSym.trim().toLowerCase();
      if (cleanSymKey && cleanSymKey !== '*' && symbolTimesMap[cleanSymKey]) {
        const mapped = symbolTimesMap[cleanSymKey];
        (['weekdays', 'saturday', 'sunday'] as OperationDayKey[]).forEach(d => {
          if (mapped[d]) {
            mapped[d].forEach(t => {
              if (!initialMap[d].includes(t)) initialMap[d].push(t);
            });
            initialMap[d].sort((a, b) => a.localeCompare(b));
          }
        });
      }

      // Se um horário alvo específico foi acionado, assegura que ele está incluído
      if (targetTime && targetDay) {
        if (!initialMap[targetDay].includes(targetTime)) {
          initialMap[targetDay].push(targetTime);
          initialMap[targetDay].sort((a, b) => a.localeCompare(b));
        }
      }

      setSelectedTimesByDay(initialMap);

      // Sincroniza descrição inicial caso vazia
      if (initialText) {
        setText(initialText);
      } else {
        const matched = existingLegends.find(l => l.symbol.trim().toLowerCase() === cleanSymKey && l.text && l.text.trim());
        if (matched) {
          setText(matched.text.trim());
        } else {
          setText('');
        }
      }

      // Define abas ativas
      const activeDays: OperationDayKey[] = [];
      if (initialMap.weekdays.length > 0 || targetDay === 'weekdays') activeDays.push('weekdays');
      if (initialMap.saturday.length > 0 || targetDay === 'saturday') activeDays.push('saturday');
      if (initialMap.sunday.length > 0 || targetDay === 'sunday') activeDays.push('sunday');
      if (activeDays.length === 0) activeDays.push('weekdays', 'saturday');
      setActiveDayTabs(activeDays);
    }
  }, [isOpen, initialSymbol, initialText, targetTime, targetDay, initialSelectedTimesByDay, symbolTimesMap, existingLegends]);

  // Contagem total de horários selecionados em todos os dias
  const totalSelectedTimesCount = useMemo(() => {
    return (
      (selectedTimesByDay.weekdays?.length || 0) +
      (selectedTimesByDay.saturday?.length || 0) +
      (selectedTimesByDay.sunday?.length || 0)
    );
  }, [selectedTimesByDay]);

  if (!isOpen) return null;

  // Alterna a seleção de um dia inteiro
  const toggleDayTab = (day: OperationDayKey) => {
    setActiveDayTabs(prev => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev; // Mantém pelo menos um dia ativo
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
    setCurrentDayTab(day);
  };

  // Alterna a seleção de um horário específico no dia corrente
  const toggleTimeForDay = (day: OperationDayKey, time: string) => {
    setSelectedTimesByDay(prev => {
      const currentList = prev[day] || [];
      const updated = currentList.includes(time)
        ? currentList.filter(t => t !== time)
        : [...currentList, time].sort((a, b) => a.localeCompare(b));
      return { ...prev, [day]: updated };
    });
  };

  // Seleciona todos os horários cadastrados do dia corrente
  const handleSelectAllForDay = (day: OperationDayKey) => {
    const all = availableTimesByDay[day] || [];
    setSelectedTimesByDay(prev => ({
      ...prev,
      [day]: [...all]
    }));
  };

  // Limpa todos os horários selecionados do dia corrente
  const handleClearForDay = (day: OperationDayKey) => {
    setSelectedTimesByDay(prev => ({
      ...prev,
      [day]: []
    }));
  };

  // Adiciona horários customizados
  const handleAddCustomTime = () => {
    if (!customInputTime.trim()) return;
    const parts = customInputTime
      .split(/[,;\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    setSelectedTimesByDay(prev => {
      const currentList = prev[currentDayTab] || [];
      const merged = Array.from(new Set([...currentList, ...parts])).sort((a, b) => a.localeCompare(b));
      return { ...prev, [currentDayTab]: merged };
    });
    setCustomInputTime('');
  };

  // Sincroniza a descrição do símbolo e os horários já vinculados ao selecionar um símbolo
  const handleSelectSymbol = (newSym: string, defaultTextSuggestion?: string) => {
    setSymbol(newSym);

    const cleanSym = newSym.trim().toLowerCase();
    const matched = existingLegends.find(l => l.symbol.trim().toLowerCase() === cleanSym && l.text && l.text.trim());
    
    if (matched) {
      setText(matched.text.trim());
    } else if (!text || text.trim().length === 0) {
      if (defaultTextSuggestion) {
        setText(defaultTextSuggestion);
      } else {
        for (const cat of PRESET_CATEGORIES) {
          const item = cat.items.find(i => i.sym === newSym);
          if (item) {
            setText(item.defaultText);
            break;
          }
        }
      }
    }

    // Mescla automaticamente os horários já vinculados a este símbolo para não excluí-los acidentalmente
    const mapped = symbolTimesMap?.[cleanSym];
    if (mapped) {
      setSelectedTimesByDay(prev => {
        const merged: Record<OperationDayKey, string[]> = {
          weekdays: Array.from(new Set([...(prev.weekdays || []), ...(mapped.weekdays || [])])).sort((a, b) => a.localeCompare(b)),
          saturday: Array.from(new Set([...(prev.saturday || []), ...(mapped.saturday || [])])).sort((a, b) => a.localeCompare(b)),
          sunday: Array.from(new Set([...(prev.sunday || []), ...(mapped.sunday || [])])).sort((a, b) => a.localeCompare(b))
        };
        if (targetTime && targetDay && !merged[targetDay].includes(targetTime)) {
          merged[targetDay].push(targetTime);
          merged[targetDay].sort((a, b) => a.localeCompare(b));
        }
        return merged;
      });

      setActiveDayTabs(prev => {
        const set = new Set(prev);
        if (mapped.weekdays && mapped.weekdays.length > 0) set.add('weekdays');
        if (mapped.saturday && mapped.saturday.length > 0) set.add('saturday');
        if (mapped.sunday && mapped.sunday.length > 0) set.add('sunday');
        return Array.from(set);
      });
    }
  };

  const handleManualSymbolChange = (val: string) => {
    setSymbol(val);
    const cleanSym = val.trim().toLowerCase();
    if (cleanSym) {
      const matched = existingLegends.find(l => l.symbol.trim().toLowerCase() === cleanSym && l.text && l.text.trim());
      if (matched) {
        setText(matched.text.trim());
      }
      const mapped = symbolTimesMap?.[cleanSym];
      if (mapped) {
        setSelectedTimesByDay(prev => {
          const merged: Record<OperationDayKey, string[]> = {
            weekdays: Array.from(new Set([...(prev.weekdays || []), ...(mapped.weekdays || [])])).sort((a, b) => a.localeCompare(b)),
            saturday: Array.from(new Set([...(prev.saturday || []), ...(mapped.saturday || [])])).sort((a, b) => a.localeCompare(b)),
            sunday: Array.from(new Set([...(prev.sunday || []), ...(mapped.sunday || [])])).sort((a, b) => a.localeCompare(b))
          };
          if (targetTime && targetDay && !merged[targetDay].includes(targetTime)) {
            merged[targetDay].push(targetTime);
            merged[targetDay].sort((a, b) => a.localeCompare(b));
          }
          return merged;
        });
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSym = symbol.trim() || '*';
    const finalText = text.trim() || `Observação para o símbolo ${finalSym}`;

    onSave({ 
      symbol: finalSym, 
      text: finalText,
      selectedTimesByDay,
      originalSymbol: originalSymbol || initialSymbol
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-3xl shadow-2xl border-2 border-amber-400 flex flex-col overflow-hidden max-h-[92vh]"
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:px-6 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
              <Tag size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black uppercase italic tracking-tight text-white flex items-center gap-2">
                <span>{title}</span>
                {targetTime && (
                  <span className="not-italic font-mono text-xs px-2.5 py-0.5 bg-yellow-400 text-slate-950 font-black rounded-lg">
                    {targetTime}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Escolha o símbolo e selecione horários de um ou vários dias para sincronizar a legenda.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[78vh] custom-scrollbar">
          
          {/* SEÇÃO 1: SELEÇÃO DE MÚLTIPLOS DIAS E HORÁRIOS */}
          <div className="bg-amber-50/60 dark:bg-zinc-800/40 p-4.5 rounded-2xl border-2 border-amber-300 dark:border-amber-500/40 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 dark:border-zinc-700 pb-2.5">
              <div className="flex items-center gap-2">
                <Calendar size={17} className="text-amber-600 dark:text-amber-400" />
                <div>
                  <label className="text-xs font-black uppercase text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>1. Aplicar aos Dias da Semana</span>
                    <span className="px-2 py-0.5 bg-amber-400 text-slate-950 rounded-full text-[10px] font-black">
                      {totalSelectedTimesCount} horário{totalSelectedTimesCount === 1 ? '' : 's'} em {activeDayTabs.length} dia{activeDayTabs.length === 1 ? '' : 's'}
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Selecione múltiplos dias para vincular esta mesma legenda aos horários de cada dia.
                  </p>
                </div>
              </div>
            </div>

            {/* Checkboxes dos Dias da Semana */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['weekdays', 'saturday', 'sunday'] as OperationDayKey[]).map(dayKey => {
                const isDayActive = activeDayTabs.includes(dayKey);
                const countForDay = selectedTimesByDay[dayKey]?.length || 0;
                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => toggleDayTab(dayKey)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isDayActive
                        ? 'bg-amber-400 border-amber-500 text-slate-950 font-black shadow-xs'
                        : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isDayActive ? (
                        <CheckSquare size={16} className="text-slate-950 shrink-0" />
                      ) : (
                        <Square size={16} className="text-slate-400 shrink-0" />
                      )}
                      <span className="text-xs truncate">{DAY_LABELS[dayKey].label}</span>
                    </div>
                    {countForDay > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-slate-950 text-amber-300 shrink-0">
                        {countForDay}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Abas e Grade de Horários por Dia */}
            <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-amber-200 dark:border-zinc-700 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
                {/* Abas de navegação de dias */}
                <div className="flex items-center gap-1.5">
                  {activeDayTabs.map(dayKey => (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => setCurrentDayTab(dayKey)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                        currentDayTab === dayKey
                          ? 'bg-slate-950 text-amber-400 shadow-xs'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                      }`}
                    >
                      {DAY_LABELS[dayKey].short} ({selectedTimesByDay[dayKey]?.length || 0})
                    </button>
                  ))}
                </div>

                {/* Ações rápidas para o dia corrente */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectAllForDay(currentDayTab)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-zinc-700 rounded-md text-[10px] font-bold text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 transition"
                  >
                    Selecionar Todos ({DAY_LABELS[currentDayTab].short})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClearForDay(currentDayTab)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-md text-[10px] font-bold text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 transition"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Chips de horários disponíveis para o dia ativo */}
              {(() => {
                const timesList = availableTimesByDay[currentDayTab] || [];
                const currentSelected = selectedTimesByDay[currentDayTab] || [];

                if (timesList.length === 0) {
                  return (
                    <div className="p-3 bg-amber-50/50 dark:bg-zinc-800/50 rounded-xl border border-dashed border-amber-300 dark:border-zinc-700 text-center">
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Nenhum horário cadastrado em {DAY_LABELS[currentDayTab].label}. Digite horários no campo abaixo.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 custom-scrollbar">
                    {timesList.map(timeStr => {
                      const isSelected = currentSelected.includes(timeStr);
                      return (
                        <button
                          key={timeStr}
                          type="button"
                          onClick={() => toggleTimeForDay(currentDayTab, timeStr)}
                          className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-500 shadow-xs'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 border border-slate-200 dark:border-zinc-700'
                          }`}
                        >
                          {isSelected ? (
                            <Check size={12} className="stroke-[3] text-slate-950" />
                          ) : (
                            <Square size={12} className="text-slate-400" />
                          )}
                          <span>{timeStr}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Inclusão rápida de horários avulsos */}
              <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
                <input
                  type="text"
                  value={customInputTime}
                  onChange={e => setCustomInputTime(e.target.value)}
                  placeholder={`Digitar outros horários para ${DAY_LABELS[currentDayTab].short} (Ex: 06:15, 08:30)`}
                  className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTime}
                  className="px-3 py-1.5 bg-slate-900 text-amber-300 rounded-lg text-xs font-black uppercase hover:bg-black transition"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: DEFINIÇÃO DO SÍMBOLO E DESCRIÇÃO */}
          <div className="bg-slate-50 dark:bg-zinc-800/40 p-4.5 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-4">
            
            {/* Símbolo Ativo e Campo de Texto */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-1">
                  2. Símbolo / Sigla (até 6 carac.)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={symbol}
                    onChange={(e) => handleManualSymbolChange(e.target.value)}
                    placeholder="Ex: *, (1), CTR"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border-2 border-amber-400 rounded-xl text-sm font-mono font-black text-slate-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="w-12 h-10 bg-amber-400 rounded-xl flex items-center justify-center font-mono font-black text-slate-950 text-base shadow-xs shrink-0">
                    {symbol || '*'}
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-1">
                  3. Descrição / Variação de Itinerário
                </label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ex: Passa pelo Centro Comercial / Via Expressa"
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-zinc-100 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Prévia do Cartaz */}
            <div className="p-3 bg-[#08456c] rounded-xl border border-yellow-400 text-white flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-yellow-400 text-slate-950 font-mono font-black text-xs rounded shadow-xs">
                  {symbol || '*'}
                </span>
                <span className="font-bold text-yellow-200 uppercase truncate">
                  {text || 'Descrição da Legenda'}
                </span>
              </div>
              <span className="text-[10px] text-blue-200 font-bold uppercase shrink-0">
                Prévia Oficial
              </span>
            </div>

            {/* Seção: Legendas já existentes no itinerário para reutilização imediata */}
            {existingLegends && existingLegends.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-zinc-700">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block tracking-wider">
                    Legendas Já Criadas no Itinerário (Clique para Reutilizar):
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">
                    Não precisa redigitar a descrição
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-1 custom-scrollbar">
                  {existingLegends.map((leg, idx) => {
                    const isSelected = symbol.trim().toLowerCase() === leg.symbol.trim().toLowerCase();
                    return (
                      <button
                        key={`${leg.symbol}-${idx}`}
                        type="button"
                        onClick={() => handleSelectSymbol(leg.symbol, leg.text)}
                        className={`p-2 rounded-xl text-left transition-all flex items-center justify-between gap-2 border cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400 border-amber-500 text-slate-950 font-black shadow-xs scale-[1.01]'
                            : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:border-amber-400 hover:bg-amber-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-black text-xs px-2 py-0.5 bg-slate-900 text-amber-300 rounded shadow-xs shrink-0">
                            {leg.symbol}
                          </span>
                          <span className="text-[11px] font-bold truncate" title={leg.text}>
                            {leg.text || 'Sem descrição'}
                          </span>
                        </div>
                        {isSelected && <Check size={14} className="text-slate-950 shrink-0 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Paleta de Símbolos por Categorias */}
            <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-zinc-700">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                Ou Escolha Novos Símbolos Recomendados:
              </span>

              {/* Abas de Categorias */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                {PRESET_CATEGORIES.map((cat, idx) => (
                  <button
                    key={cat.category}
                    type="button"
                    onClick={() => setActiveTab(idx)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-colors ${
                      activeTab === idx
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                    }`}
                  >
                    {cat.category}
                  </button>
                ))}
              </div>

              {/* Itens da Categoria Ativa */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 custom-scrollbar">
                {PRESET_CATEGORIES[activeTab].items.map((item) => {
                  const isSelected = symbol === item.sym;
                  return (
                    <button
                      key={item.sym}
                      type="button"
                      onClick={() => handleSelectSymbol(item.sym, item.defaultText)}
                      className={`p-2 rounded-xl text-left transition-all flex items-center gap-2 border ${
                        isSelected
                          ? 'bg-amber-400 border-amber-500 text-slate-950 font-black shadow-xs scale-[1.02]'
                          : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-amber-400'
                      }`}
                    >
                      <span className="font-mono font-black text-xs px-1.5 py-0.5 bg-white/90 dark:bg-zinc-800 rounded shadow-2xs border border-slate-200 shrink-0 text-slate-900 dark:text-zinc-100">
                        {item.sym}
                      </span>
                      <span className="text-[10px] font-bold block truncate">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {targetTime && onDeleteFromTargetTime && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteFromTargetTime();
                    onClose();
                  }}
                  className="px-3 py-2 rounded-xl text-[11px] font-black uppercase text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 flex items-center gap-1.5 border border-amber-300 dark:border-amber-700 transition-colors"
                  title={`Remover a legenda apenas deste horário (${targetTime})`}
                >
                  <Trash2 size={13} />
                  <span>Desvincular de {targetTime}</span>
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="px-3 py-2 rounded-xl text-[11px] font-black uppercase text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 flex items-center gap-1.5 border border-red-200 dark:border-red-900 transition-colors"
                  title="Excluir esta legenda de todos os horários cadastrados da rota"
                >
                  <Trash2 size={13} />
                  <span>Excluir de Todos</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#ff6a00] hover:bg-[#e65f00] text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all border border-orange-400"
              >
                <Check size={16} />
                <span>Salvar Legenda ({totalSelectedTimesCount} horários)</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default LegendSymbolSelectorModal;
