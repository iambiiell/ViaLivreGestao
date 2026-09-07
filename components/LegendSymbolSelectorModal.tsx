import React, { useState, useEffect } from 'react';
import { 
  X, 
  Tag, 
  Check, 
  Sparkles, 
  Trash2, 
  Clock, 
  Eye, 
  Info,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface LegendOption {
  symbol: string;
  text: string;
  time?: string;
}

interface LegendSymbolSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (legend: { symbol: string; text: string }) => void;
  onDelete?: () => void;
  initialSymbol?: string;
  initialText?: string;
  targetTime?: string;
  existingLegends?: { symbol: string; text: string }[];
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

export const LegendSymbolSelectorModal: React.FC<LegendSymbolSelectorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialSymbol = '*',
  initialText = '',
  targetTime,
  existingLegends = [],
  title = 'Identificação do Símbolo da Legenda'
}) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [text, setText] = useState(initialText);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSymbol(initialSymbol || '*');
      setText(initialText || '');
    }
  }, [isOpen, initialSymbol, initialText]);

  if (!isOpen) return null;

  // Handle symbol selection with automatic description synchronization
  const handleSelectSymbol = (newSym: string, defaultTextSuggestion?: string) => {
    setSymbol(newSym);

    // 1. Check if an existing registered legend has this symbol
    const cleanSym = newSym.trim().toLowerCase();
    const matched = existingLegends.find(l => l.symbol.trim().toLowerCase() === cleanSym && l.text && l.text.trim());
    
    if (matched) {
      setText(matched.text.trim());
      return;
    }

    // 2. Otherwise, if current text is empty or matches a preset, suggest default text
    if (!text || text.trim().length === 0) {
      if (defaultTextSuggestion) {
        setText(defaultTextSuggestion);
      } else {
        // Look up in all categories
        for (const cat of PRESET_CATEGORIES) {
          const item = cat.items.find(i => i.sym === newSym);
          if (item) {
            setText(item.defaultText);
            break;
          }
        }
      }
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
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSym = symbol.trim() || '*';
    const finalText = text.trim() || `Observação para o símbolo ${finalSym}`;
    onSave({ symbol: finalSym, text: finalText });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl border-2 border-amber-400 flex flex-col overflow-hidden"
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
                Escolha um ícone ou símbolo e defina a descrição do itinerário.
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

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {/* PRÉVIA VISUAL INSTANTÂNEA (MINI-CARD) */}
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-zinc-950 dark:to-zinc-900 rounded-2xl border-2 border-amber-400/80 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                <Eye size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-400 tracking-wider block">
                  Prévia Visual Instantânea (Mini-Card)
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Como o horário e a legenda aparecem no sistema:
                </span>
              </div>
            </div>

            {/* Mini-Card Demo */}
            <div className="inline-flex items-center gap-2 bg-white dark:bg-zinc-800 px-4 py-2.5 rounded-2xl border-2 border-amber-400 shadow-md">
              <span className="font-mono text-base font-black text-slate-900 dark:text-zinc-100">
                {targetTime || '06:30'}
              </span>
              <span className="px-2.5 py-0.5 bg-yellow-400 text-slate-950 font-black text-xs font-mono rounded-lg border border-yellow-500 shadow-xs inline-flex items-center gap-1">
                <span>{symbol || '*'}</span>
              </span>
            </div>
          </div>

          {/* Campo de Símbolo Manual */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-black uppercase text-slate-700 dark:text-zinc-300 mb-1">
                Símbolo ou Sigla:
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={symbol}
                  onChange={(e) => handleManualSymbolChange(e.target.value)}
                  placeholder="Ex: *, CTR, 🚌"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-700 rounded-xl font-mono text-base font-black text-slate-900 dark:text-zinc-100 outline-none focus:border-amber-400 text-center shadow-xs"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-black uppercase text-slate-700 dark:text-zinc-300 mb-1">
                Descrição do Itinerário / Observação:
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ex: Passa pelo Centro Comercial / Via Expressa"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-zinc-100 outline-none focus:border-amber-400 shadow-xs"
              />
            </div>
          </div>

          {/* Sincronização Automática Aviso */}
          {(() => {
            const cleanSym = symbol.trim().toLowerCase();
            const matched = cleanSym ? existingLegends.find(l => l.symbol.trim().toLowerCase() === cleanSym && l.text && l.text.trim()) : null;
            if (!matched) return null;
            return (
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/70 px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800">
                <Check size={14} className="text-amber-600 shrink-0" />
                <span className="truncate">Símbolo já cadastrado no itinerário: descrição sincronizada com "{matched.text}"</span>
              </div>
            );
          })()}

          {/* SELETOR VISUAL DE ÍCONES E SÍMBOLOS POR CATEGORIA */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Sparkles size={15} className="text-amber-500" />
                <span>Seletor Visual de Ícones & Símbolos</span>
              </label>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Clique para selecionar
              </span>
            </div>

            {/* Tabs de Categorias */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              {PRESET_CATEGORIES.map((cat, idx) => (
                <button
                  type="button"
                  key={cat.category}
                  onClick={() => setActiveTab(idx)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all ${
                    activeTab === idx
                      ? 'bg-slate-900 text-yellow-400 shadow-sm border border-slate-800'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {cat.category}
                </button>
              ))}
            </div>

            {/* Grid da Categoria Ativa */}
            <div className="p-3.5 bg-slate-50 dark:bg-zinc-950/70 rounded-2xl border border-slate-200 dark:border-zinc-800 max-h-48 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_CATEGORIES[activeTab].items.map((item) => {
                  const isSelected = symbol === item.sym;
                  return (
                    <button
                      type="button"
                      key={item.sym}
                      onClick={() => handleSelectSymbol(item.sym, item.defaultText)}
                      className={`p-2 rounded-xl text-left transition-all flex items-center gap-2 border ${
                        isSelected
                          ? 'bg-amber-400 border-amber-500 text-slate-950 font-black shadow-md scale-[1.02]'
                          : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-amber-400'
                      }`}
                    >
                      <span className="font-mono font-black text-sm px-2 py-0.5 bg-white/90 dark:bg-zinc-800 rounded-lg shadow-2xs border border-slate-200 dark:border-zinc-700 shrink-0 text-slate-900 dark:text-zinc-100">
                        {item.sym}
                      </span>
                      <div className="min-w-0">
                        <span className="text-[11px] font-black block truncate leading-tight">
                          {item.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-black uppercase text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Remover Legenda</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#ff6a00] hover:bg-[#e65f00] text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all border border-orange-400"
              >
                <Check size={15} />
                <span>Salvar Legenda</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default LegendSymbolSelectorModal;
