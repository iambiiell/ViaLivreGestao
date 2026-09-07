import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { BusRoute, Company, SystemSettings } from '../types';
import { 
  X, 
  Download, 
  Loader2, 
  Calendar, 
  Phone, 
  Mail, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Bus, 
  DollarSign, 
  Building2, 
  SlidersHorizontal,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeftRight,
  Copy,
  CheckCircle2,
  Navigation,
  Tag,
  Info,
  Sparkles,
  Check,
  CheckSquare,
  Square,
  Eye,
  ListChecks,
  Pencil,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DirectionalTimes {
  ida: string[];
  volta: string[];
}

export interface TimeLegendEntry {
  id: string;
  day: 'weekdays' | 'saturday' | 'sunday';
  direction: 'ida' | 'volta';
  times: string[];
  time?: string;
  symbol: string;
  text: string;
}

export interface TimetableExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  route: BusRoute;
  company?: Company;
  systemSettings?: SystemSettings;
  initialTimes?: {
    weekdays: string[] | DirectionalTimes | any;
    saturday: string[] | DirectionalTimes | any;
    sunday: string[] | DirectionalTimes | any;
  };
  addToast?: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

const parseDirectionalTimes = (input: any): DirectionalTimes => {
  if (!input) return { ida: [], volta: [] };

  if (typeof input === 'object' && !Array.isArray(input)) {
    if (Array.isArray(input.ida) || Array.isArray(input.volta)) {
      return {
        ida: Array.isArray(input.ida)
          ? Array.from(new Set<string>(input.ida.map((s: any) => String(s).trim()).filter(Boolean))).sort()
          : [],
        volta: Array.isArray(input.volta)
          ? Array.from(new Set<string>(input.volta.map((s: any) => String(s).trim()).filter(Boolean))).sort()
          : []
      };
    }
  }

  if (Array.isArray(input)) {
    const ida: string[] = [];
    const volta: string[] = [];
    input.forEach(item => {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed) ida.push(trimmed);
      } else if (item && typeof item === 'object') {
        const time = (item.time || item.horario || '').trim();
        if (time) {
          const dir = (item.direction || item.sentido || '').toUpperCase();
          if (dir === 'VOLTA') {
            volta.push(time);
          } else {
            ida.push(time);
          }
        }
      }
    });
    return {
      ida: Array.from(new Set(ida)).sort(),
      volta: Array.from(new Set(volta)).sort()
    };
  }

  return { ida: [], volta: [] };
};

export const TimetableExportModal: React.FC<TimetableExportModalProps> = ({
  isOpen,
  onClose,
  route,
  company,
  systemSettings,
  initialTimes,
  addToast
}) => {
  const posterRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // Controles solicitados: Opções de Horário de Ida e Horário de Volta
  const [includeIda, setIncludeIda] = useState(true);
  const [includeVolta, setIncludeVolta] = useState(true);
  const [simultaneousDepartures, setSimultaneousDepartures] = useState(false);
  
  // Effective date (defaults to current date formatted DD/MM/YYYY)
  const defaultDateStr = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }, []);
  const [effectiveDate, setEffectiveDate] = useState(defaultDateStr);

  // Default fare
  const defaultPrice = useMemo(() => {
    const total = (route.price || 0) + (route.toll || 0) + (route.fees || 0);
    return total > 0 ? total.toFixed(2).replace('.', ',') : '0,00';
  }, [route]);
  const [tariff, setTariff] = useState(defaultPrice);

  // Código da Linha (ex: L-01 ou 102)
  const lineCode = useMemo(() => {
    return (route.prefixo_linha || route.code || '').trim();
  }, [route.prefixo_linha, route.code]);

  // Dynamic Company info strictly following the route's company
  const companyName = useMemo(() => {
    return (
      company?.nome_fantasia || 
      company?.name || 
      company?.razao_social || 
      systemSettings?.company_name || 
      'EMPRESA'
    ).toUpperCase();
  }, [company, systemSettings]);

  // Telefone e email devem seguir o cadastro da empresa da rota a ser exportada
  const defaultContactPhone = useMemo(() => {
    return company?.contact_phone || (company as any)?.phone || systemSettings?.support_phone || '';
  }, [company, systemSettings]);

  const defaultContactEmail = useMemo(() => {
    return company?.contact_email || (company as any)?.email || systemSettings?.support_email || '';
  }, [company, systemSettings]);

  const [contactPhone, setContactPhone] = useState(defaultContactPhone);
  const [contactEmail, setContactEmail] = useState(defaultContactEmail);

  // Sincronizar quando a empresa ou rota mudar
  useEffect(() => {
    setContactPhone(defaultContactPhone);
    setContactEmail(defaultContactEmail);
  }, [defaultContactPhone, defaultContactEmail]);

  // Times state (Segunda a Sexta, Sábado, Domingo) com separação de IDA e VOLTA
  const [times, setTimes] = useState<{
    weekdays: DirectionalTimes;
    saturday: DirectionalTimes;
    sunday: DirectionalTimes;
  }>({
    weekdays: { ida: [], volta: [] },
    saturday: { ida: [], volta: [] },
    sunday: { ida: [], volta: [] }
  });

  // Referência fiel aos horários originalmente cadastrados no sistema
  const originalRegisteredTimesRef = useRef<{
    weekdays: DirectionalTimes;
    saturday: DirectionalTimes;
    sunday: DirectionalTimes;
  }>({
    weekdays: { ida: [], volta: [] },
    saturday: { ida: [], volta: [] },
    sunday: { ida: [], volta: [] }
  });

  // Custom added time inputs
  const [newTimeInputs, setNewTimeInputs] = useState({
    weekdays: { ida: '', volta: '' },
    saturday: { ida: '', volta: '' },
    sunday: { ida: '', volta: '' }
  });

  const [activeDrawerTab, setActiveDrawerTab] = useState<'weekdays' | 'saturday' | 'sunday'>('weekdays');
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0.75);

  // Legendas e outras direções da rota (ex: passa pelo centro, não passa pelo centro)
  const [timeLegends, setTimeLegends] = useState<TimeLegendEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`consimp_route_legends_${route.id}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // ignore
    }
    return [];
  });

  // Salvar legendas no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`consimp_route_legends_${route.id}`, JSON.stringify(timeLegends));
    } catch (e) {
      // ignore
    }
  }, [timeLegends, route.id]);

  // Modal de edição / criação de legenda para horário específico
  const [isLegendModalOpen, setIsLegendModalOpen] = useState(false);
  const [legendFormDay, setLegendFormDay] = useState<'weekdays' | 'saturday' | 'sunday'>('weekdays');
  const [legendFormDirection, setLegendFormDirection] = useState<'ida' | 'volta'>('ida');
  const [legendFormTimes, setLegendFormTimes] = useState<string[]>([]);
  const [legendFormCustomInput, setLegendFormCustomInput] = useState<string>('');
  const [legendFormSymbol, setLegendFormSymbol] = useState<string>('*');
  const [legendFormText, setLegendFormText] = useState<string>('');
  const [editingLegendId, setEditingLegendId] = useState<string | null>(null);

  const getLegendForTime = (day: 'weekdays' | 'saturday' | 'sunday', direction: 'ida' | 'volta', time: string) => {
    return timeLegends.find(l => {
      if (l.day !== day) return false;
      if (!simultaneousDepartures && l.direction !== direction) return false;
      const list = (l.times && l.times.length > 0) ? l.times : (l.time ? [l.time] : []);
      return list.includes(time);
    });
  };

  const activeLegendsList = useMemo(() => {
    const list: {
      legendId: string;
      originalLegend: TimeLegendEntry;
      symbol: string;
      text: string;
      appliedTimes: string[];
    }[] = [];

    timeLegends.forEach(leg => {
      const dayTimes = times[leg.day];
      if (!dayTimes) return;
      const tList = (leg.times && leg.times.length > 0) ? leg.times : (leg.time ? [leg.time] : []);

      tList.forEach(time => {
        const exists = (leg.direction === 'ida' && dayTimes.ida?.includes(time)) ||
                       (leg.direction === 'volta' && dayTimes.volta?.includes(time)) ||
                       (simultaneousDepartures && (dayTimes.ida?.includes(time) || dayTimes.volta?.includes(time)));
        if (!exists) return;

        // Agrupa estritamente pelo símbolo para garantir que cada legenda nunca seja duplicada no cartaz
        const cleanSym = leg.symbol.trim().toLowerCase();
        const existing = list.find(item => item.symbol.trim().toLowerCase() === cleanSym);
        if (existing) {
          if (!existing.appliedTimes.includes(time)) {
            existing.appliedTimes.push(time);
          }
          if (!existing.text && leg.text) {
            existing.text = leg.text;
          }
        } else {
          list.push({
            legendId: leg.id,
            originalLegend: leg,
            symbol: leg.symbol,
            text: leg.text,
            appliedTimes: [time]
          });
        }
      });
    });

    list.forEach(item => item.appliedTimes.sort((a, b) => a.localeCompare(b)));
    return list;
  }, [timeLegends, times, simultaneousDepartures]);

  // Sincroniza automaticamente a descrição da legenda ao clicar ou digitar um símbolo
  const handleSelectSymbol = (sym: string) => {
    setLegendFormSymbol(sym);
    const cleanSym = sym.trim().toLowerCase();
    if (cleanSym) {
      const match = timeLegends.find(l => 
        l.symbol.trim().toLowerCase() === cleanSym && 
        l.text && l.text.trim()
      );
      if (match) {
        setLegendFormText(match.text.trim());
      }
    }
  };

  const handleEditLegend = (legend: TimeLegendEntry) => {
    const tList = (legend.times && legend.times.length > 0) ? legend.times : (legend.time ? [legend.time] : []);
    setEditingLegendId(legend.id);
    setLegendFormDay(legend.day);
    setLegendFormDirection(legend.direction);
    setLegendFormTimes([...tList]);
    setLegendFormSymbol(legend.symbol);
    setLegendFormText(legend.text);
    setLegendFormCustomInput('');
    setIsLegendModalOpen(true);
  };

  const handleOpenLegendModal = (
    day?: 'weekdays' | 'saturday' | 'sunday',
    direction?: 'ida' | 'volta',
    time?: string
  ) => {
    const targetDay = day || activeDrawerTab || 'weekdays';
    const targetDirection = direction || 'ida';

    if (time) {
      // Se este horário já possui legenda, abre diretamente para edição
      const existing = timeLegends.find(l => {
        if (l.day !== targetDay) return false;
        if (!simultaneousDepartures && l.direction !== targetDirection) return false;
        const list = (l.times && l.times.length > 0) ? l.times : (l.time ? [l.time] : []);
        return list.includes(time);
      });

      if (existing) {
        handleEditLegend(existing);
        return;
      }
    }

    setLegendFormDay(targetDay);
    setLegendFormDirection(targetDirection);
    setLegendFormCustomInput('');
    setEditingLegendId(null);
    setLegendFormTimes(time ? [time] : []);

    const usedSymbols = new Set(timeLegends.map(l => l.symbol));
    const candidates = ['*', '**', '***', '(1)', '(2)', '(3)', '(A)', '(B)'];
    const nextSym = candidates.find(c => !usedSymbols.has(c)) || '*';
    setLegendFormSymbol(nextSym);

    // Se o próximo símbolo sugerido já possui alguma descrição cadastrada, sincroniza automaticamente
    const match = timeLegends.find(l => 
      l.symbol.trim().toLowerCase() === nextSym.trim().toLowerCase() && 
      l.text && l.text.trim()
    );
    setLegendFormText(match ? match.text.trim() : '');

    setIsLegendModalOpen(true);
  };

  const toggleLegendTime = (t: string) => {
    setLegendFormTimes(prev => 
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t].sort((a, b) => a.localeCompare(b))
    );
  };

  const handleSelectAllLegendTimes = () => {
    const avTimes = simultaneousDepartures 
      ? times[legendFormDay].ida 
      : legendFormDirection === 'ida' 
        ? times[legendFormDay].ida 
        : times[legendFormDay].volta;
    setLegendFormTimes([...avTimes]);
  };

  const handleClearAllLegendTimes = () => {
    setLegendFormTimes([]);
  };

  const handleAddCustomLegendTime = () => {
    if (!legendFormCustomInput.trim()) return;
    const parts = legendFormCustomInput
      .split(/[,;\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    setLegendFormTimes(prev => {
      const merged = Array.from(new Set([...prev, ...parts])).sort((a, b) => a.localeCompare(b));
      return merged;
    });
    setLegendFormCustomInput('');
  };

  const handleSaveLegend = () => {
    if (legendFormTimes.length === 0) {
      addToast?.("Selecione pelo menos um horário para aplicar a legenda.", "warning");
      return;
    }
    if (!legendFormText.trim()) {
      addToast?.("Digite o texto da legenda / itinerário (ex: Passa pelo Centro).", "warning");
      return;
    }

    const cleanSymbol = legendFormSymbol.trim() || '*';
    const cleanText = legendFormText.trim();
    const cleanTimes = Array.from(new Set(legendFormTimes.map(t => t.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

    setTimeLegends(prev => {
      let updated = [...prev];

      if (editingLegendId) {
        // Atualiza a legenda existente
        updated = updated.map(l => {
          if (l.id === editingLegendId) {
            return {
              ...l,
              day: legendFormDay,
              direction: legendFormDirection,
              times: cleanTimes,
              time: cleanTimes[0] || '',
              symbol: cleanSymbol,
              text: cleanText
            };
          }
          return l;
        });

        // Se já existia outra entrada com o mesmo símbolo, unifica para nunca duplicar
        const dupIdx = updated.findIndex(l => 
          l.id !== editingLegendId &&
          l.symbol.trim().toLowerCase() === cleanSymbol.toLowerCase() &&
          l.day === legendFormDay &&
          (simultaneousDepartures || l.direction === legendFormDirection)
        );

        if (dupIdx >= 0) {
          const dup = updated[dupIdx];
          const target = updated.find(l => l.id === editingLegendId)!;
          const merged = Array.from(new Set([...(target.times || []), ...(dup.times || [])])).sort((a, b) => a.localeCompare(b));
          target.times = merged;
          target.time = merged[0] || '';
          target.text = cleanText || dup.text;
          updated = updated.filter(l => l.id !== dup.id);
        }
      } else {
        // Ao adicionar nova legenda: verifica se já existe uma com este símbolo para este dia/sentido
        const existingIdx = updated.findIndex(l => 
          l.symbol.trim().toLowerCase() === cleanSymbol.toLowerCase() &&
          l.day === legendFormDay &&
          (simultaneousDepartures || l.direction === legendFormDirection)
        );

        if (existingIdx >= 0) {
          // Unifica os horários na legenda existente, evitando duplicar a legenda
          const existing = updated[existingIdx];
          const mergedTimes = Array.from(new Set([...(existing.times || []), ...cleanTimes])).sort((a, b) => a.localeCompare(b));
          updated[existingIdx] = {
            ...existing,
            times: mergedTimes,
            time: mergedTimes[0] || '',
            symbol: cleanSymbol,
            text: cleanText || existing.text
          };
        } else {
          // Cria uma única legenda para todos os horários selecionados
          const newEntry: TimeLegendEntry = {
            id: `leg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            day: legendFormDay,
            direction: legendFormDirection,
            times: cleanTimes,
            time: cleanTimes[0] || '',
            symbol: cleanSymbol,
            text: cleanText
          };
          updated.push(newEntry);
        }
      }

      // Evita conflitos de símbolos removendo esses horários de outras legendas com símbolos distintos
      const activeLegendId = editingLegendId || updated.find(l => 
        l.symbol.trim().toLowerCase() === cleanSymbol.toLowerCase() &&
        l.day === legendFormDay &&
        (simultaneousDepartures || l.direction === legendFormDirection)
      )?.id;

      if (activeLegendId) {
        updated = updated.map(l => {
          if (l.id === activeLegendId) return l;
          if (l.day === legendFormDay && (simultaneousDepartures || l.direction === legendFormDirection)) {
            const rem = (l.times || []).filter(t => !cleanTimes.includes(t));
            return {
              ...l,
              times: rem,
              time: rem[0] || ''
            };
          }
          return l;
        }).filter(l => l.id === activeLegendId || (l.times && l.times.length > 0));
      }

      return updated;
    });

    addToast?.(`Legenda salva com sucesso para os horários selecionados!`, "success");
    setIsLegendModalOpen(false);
  };

  const handleRemoveLegend = (id: string) => {
    setTimeLegends(prev => prev.filter(l => l.id !== id));
    addToast?.("Legenda removida do horário.", "success");
    if (editingLegendId === id) {
      setIsLegendModalOpen(false);
    }
  };

  // Populate times when modal opens or initialTimes change
  useEffect(() => {
    const registered = initialTimes ? {
      weekdays: parseDirectionalTimes(initialTimes.weekdays),
      saturday: parseDirectionalTimes(initialTimes.saturday),
      sunday: parseDirectionalTimes(initialTimes.sunday)
    } : {
      weekdays: parseDirectionalTimes(route.schedule?.weekdays),
      saturday: parseDirectionalTimes(route.schedule?.saturday),
      sunday: parseDirectionalTimes(route.schedule?.sunday)
    };

    originalRegisteredTimesRef.current = registered;

    if (simultaneousDepartures) {
      const syncDay = (d: DirectionalTimes) => {
        const merged = Array.from(new Set([...d.ida, ...d.volta])).sort((a, b) => a.localeCompare(b));
        return { ida: [...merged], volta: [...merged] };
      };
      setTimes({
        weekdays: syncDay(registered.weekdays),
        saturday: syncDay(registered.saturday),
        sunday: syncDay(registered.sunday)
      });
    } else {
      setTimes({
        weekdays: { ida: [...registered.weekdays.ida], volta: [...registered.weekdays.volta] },
        saturday: { ida: [...registered.saturday.ida], volta: [...registered.saturday.volta] },
        sunday: { ida: [...registered.sunday.ida], volta: [...registered.sunday.volta] }
      });
    }
    setTariff(defaultPrice);
    setEffectiveDate(defaultDateStr);
  }, [initialTimes, route, defaultPrice, defaultDateStr, isOpen]);

  // Adjust default zoom on smaller screens
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) {
        setZoomLevel(0.42);
      } else if (window.innerWidth < 1024) {
        setZoomLevel(0.62);
      } else {
        setZoomLevel(0.82);
      }
    }
  }, []);

  const handleToggleIda = (checked: boolean) => {
    if (!checked && !includeVolta) {
      addToast?.("Pelo menos uma opção (Ida ou Volta) deve estar selecionada.", "warning");
      return;
    }
    setIncludeIda(checked);
  };

  const handleToggleVolta = (checked: boolean) => {
    if (!checked && !includeIda) {
      addToast?.("Pelo menos uma opção (Ida ou Volta) deve estar selecionada.", "warning");
      return;
    }
    setIncludeVolta(checked);
  };

  const handleAddTime = (day: 'weekdays' | 'saturday' | 'sunday', direction: 'ida' | 'volta') => {
    const val = newTimeInputs[day][direction].trim();
    if (!val) return;
    let formatted = val;
    if (/^\d:\d{2}$/.test(formatted)) formatted = `0${formatted}`;
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(formatted)) {
      addToast?.("Formato de horário inválido. Utilize HH:MM", "error");
      return;
    }

    if (times[day][direction].includes(formatted)) {
      addToast?.(`Este horário já está cadastrado`, "warning");
      return;
    }

    if (simultaneousDepartures) {
      setTimes(prev => {
        const updated = Array.from(new Set([...prev[day].ida, formatted])).sort((a, b) => a.localeCompare(b));
        return {
          ...prev,
          [day]: {
            ida: updated,
            volta: [...updated]
          }
        };
      });
      setNewTimeInputs(prev => ({
        ...prev,
        [day]: { ida: '', volta: '' }
      }));
      return;
    }

    setTimes(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [direction]: [...prev[day][direction], formatted].sort((a, b) => a.localeCompare(b))
      }
    }));
    setNewTimeInputs(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [direction]: ''
      }
    }));
  };

  const handleRemoveTime = (day: 'weekdays' | 'saturday' | 'sunday', direction: 'ida' | 'volta', timeToRemove: string) => {
    // Também limpa horários de legendas associadas
    setTimeLegends(prev => prev.map(l => {
      if (l.day === day && (simultaneousDepartures || l.direction === direction)) {
        const tList = (l.times && l.times.length > 0) ? l.times : (l.time ? [l.time] : []);
        const remaining = tList.filter(t => t !== timeToRemove);
        return {
          ...l,
          times: remaining,
          time: remaining[0] || ''
        };
      }
      return l;
    }).filter(l => (l.times && l.times.length > 0) || l.time));

    if (simultaneousDepartures) {
      setTimes(prev => {
        const filtered = prev[day].ida.filter(t => t !== timeToRemove);
        return {
          ...prev,
          [day]: {
            ida: filtered,
            volta: filtered
          }
        };
      });
      return;
    }

    setTimes(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [direction]: prev[day][direction].filter(t => t !== timeToRemove)
      }
    }));
  };

  const handleCopyTimes = (day: 'weekdays' | 'saturday' | 'sunday', from: 'ida' | 'volta', to: 'ida' | 'volta') => {
    setTimes(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [to]: [...prev[day][from]]
      }
    }));
    const dayLabel = day === 'weekdays' ? 'Segunda a Sexta' : day === 'saturday' ? 'Sábado' : 'Domingo';
    addToast?.(`Horários de ${from.toUpperCase()} copiados para ${to.toUpperCase()} em ${dayLabel}!`, "success");
  };

  const handleToggleSimultaneous = (checked: boolean) => {
    setSimultaneousDepartures(checked);
    const registered = originalRegisteredTimesRef.current;
    if (checked) {
      setIncludeIda(true);
      setIncludeVolta(true);
      const syncDay = (d: DirectionalTimes) => {
        const merged = Array.from(new Set([...d.ida, ...d.volta])).sort((a, b) => a.localeCompare(b));
        return { ida: [...merged], volta: [...merged] };
      };
      setTimes({
        weekdays: syncDay(registered.weekdays),
        saturday: syncDay(registered.saturday),
        sunday: syncDay(registered.sunday)
      });
      addToast?.("Partidas simultâneas ativadas: horários equalizados de acordo com o cadastro!", "success");
    } else {
      setTimes({
        weekdays: { ida: [...registered.weekdays.ida], volta: [...registered.weekdays.volta] },
        saturday: { ida: [...registered.saturday.ida], volta: [...registered.saturday.volta] },
        sunday: { ida: [...registered.sunday.ida], volta: [...registered.sunday.volta] }
      });
      addToast?.("Partidas simultâneas desmarcadas: horários de Ida e Volta restaurados de acordo com o cadastro!", "warning");
    }
  };

  const handleSyncSimultaneous = () => {
    handleToggleSimultaneous(true);
  };

  // High-Resolution Export via html-to-image (pixelRatio: 3) ajustado para Folha A4
  const handleDownloadPNG = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 250));

      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: '#ffffff',
        filter: (node: HTMLElement) => {
          return !node.classList?.contains('no-export');
        }
      });

      const link = document.createElement('a');
      // Padrão solicitado: "Código da Linha": "Ponto de Origem" x "Ponto de Destino"
      const lineCode = (route.prefixo_linha || route.code || '').trim();
      const origin = (route.origin || 'Origem').trim();
      const destination = (route.destination || 'Destino').trim();

      const exportFilename = lineCode 
        ? `${lineCode}: ${origin} x ${destination} (A4).png`
        : `${origin} x ${destination} (A4).png`;

      link.download = exportFilename;
      link.href = dataUrl;
      link.click();

      addToast?.("Grade de horários exportada com sucesso em alta resolução (PNG A4)!", "success");
    } catch (error) {
      console.error("Erro ao gerar PNG do quadro de horários:", error);
      addToast?.("Não foi possível gerar a imagem PNG. Tente novamente.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  // Exportação em PDF diretamente formatada para Folha de Tamanho A4 (210mm x 297mm)
  const handleDownloadPDF = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 250));

      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: '#ffffff',
        filter: (node: HTMLElement) => {
          return !node.classList?.contains('no-export');
        }
      });

      // Criação do documento PDF em padrão internacional Folha A4
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Folha A4 tem exatamente 210 x 297 milímetros
      pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

      const lineCode = (route.prefixo_linha || route.code || '').trim();
      const origin = (route.origin || 'Origem').trim();
      const destination = (route.destination || 'Destino').trim();

      const exportFilename = lineCode 
        ? `${lineCode}: ${origin} x ${destination} (A4).pdf`
        : `${origin} x ${destination} (A4).pdf`;

      pdf.save(exportFilename);

      addToast?.("Grade de horários exportada com sucesso em PDF (Folha A4)!", "success");
    } catch (error) {
      console.error("Erro ao gerar PDF do quadro de horários:", error);
      addToast?.("Não foi possível gerar o arquivo PDF. Tente novamente.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const renderTimeBlock = (
    list: string[], 
    dayKey?: 'weekdays' | 'saturday' | 'sunday',
    direction?: 'ida' | 'volta',
    emptyText = "SEM OPERAÇÃO / NÃO HÁ PARTIDAS CADASTRADAS"
  ) => {
    if (!list || list.length === 0) {
      return (
        <span className="font-bold text-xs uppercase tracking-widest text-blue-200/60 text-center italic py-2 block">
          {emptyText}
        </span>
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 py-1">
        {list.map((time, idx) => {
          const leg = dayKey && direction ? getLegendForTime(dayKey, direction, time) : null;
          return (
            <React.Fragment key={`${time}-${idx}`}>
              <span 
                onClick={() => dayKey && direction && handleOpenLegendModal(dayKey, direction, time)}
                className={`inline-flex items-baseline font-black text-sm sm:text-base font-mono tracking-wider cursor-pointer group transition-transform hover:scale-105 ${
                  leg ? 'text-yellow-200' : 'text-white'
                }`}
                title={
                  leg 
                    ? `Horário ${time} • Legenda: ${leg.symbol} (${leg.text}) - Clique para editar`
                    : `Horário ${time} - Clique para associar uma legenda/direção`
                }
              >
                <span className="group-hover:underline">{time}</span>
                {leg && (
                  <sup className="text-yellow-400 font-black ml-0.5 text-xs font-sans tracking-normal select-none drop-shadow-sm">
                    {leg.symbol}
                  </sup>
                )}
              </span>
              {idx < list.length - 1 && (
                <span className="text-blue-300/40 select-none font-sans text-xs">
                  •
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const daysConfig: { key: 'weekdays' | 'saturday' | 'sunday'; label: string; badge: string }[] = [
    { key: 'weekdays', label: 'Segunda a Sexta-feira', badge: 'Dias Úteis' },
    { key: 'saturday', label: 'Sábados', badge: 'Sábado' },
    { key: 'sunday', label: 'Domingos e Feriados', badge: 'Domingo' }
  ];

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white dark:bg-zinc-900 w-full max-w-7xl max-h-[96vh] rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden"
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:px-6 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff6a00] flex items-center justify-center text-white font-black shadow-md">
              <Bus size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase italic tracking-tight text-white leading-tight">
                Exportar Grade de Horários (PNG)
              </h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {route.prefixo_linha ? `${route.prefixo_linha} • ` : ''}{route.origin} x {route.destination}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfigDrawer(!showConfigDrawer)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all border ${
                showConfigDrawer 
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md' 
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
              title="Ajustar dados e horários de ida e volta"
            >
              <SlidersHorizontal size={15} />
              <span className="hidden sm:inline">Ajustar Horários</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all border border-slate-700 disabled:opacity-50"
              title="Exportar grade em documento PDF formatado para folha A4"
            >
              <FileText size={15} className="text-rose-400" />
              <span className="hidden sm:inline">PDF (A4)</span>
            </button>

            <button
              onClick={handleDownloadPNG}
              disabled={isExporting}
              className="px-4 py-2 bg-[#ff6a00] hover:bg-[#e65f00] text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg active:scale-95 transition-all border border-orange-400 disabled:opacity-50"
              title="Baixar imagem em alta resolução ajustada em folha A4 (300 DPI)"
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>PNG (A4)</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              title="Fechar"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Barra Superior de Controles e Seleção de Sentidos (Ida / Volta) */}
        <div className="p-3 sm:px-6 bg-slate-100 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Controles de Sentido Solicitados */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mr-1 hidden sm:inline">
              Sentidos na Grade:
            </span>

            {/* Checkbox Opção Horário de Ida */}
            <label 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all select-none ${
                simultaneousDepartures
                  ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-500'
                  : includeIda 
                    ? 'bg-yellow-100 dark:bg-yellow-950/60 border-yellow-400 text-slate-900 dark:text-yellow-200 shadow-sm cursor-pointer' 
                    : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-400 hover:text-slate-600 cursor-pointer'
              }`}
              title={simultaneousDepartures ? "Desative 'Partidas simultâneas' para filtrar apenas Ida ou Volta" : "Incluir coluna de saída do Ponto de Origem"}
            >
              <input
                type="checkbox"
                checked={includeIda}
                disabled={simultaneousDepartures}
                onChange={(e) => handleToggleIda(e.target.checked)}
                className="w-4 h-4 text-yellow-500 rounded border-slate-300 focus:ring-yellow-400 focus:ring-2 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 bg-yellow-400 text-slate-950 rounded text-[9px] font-black uppercase">
                  IDA
                </span>
                <span className="truncate max-w-[140px] sm:max-w-[200px]" title={route.origin}>
                  Origem: {route.origin}
                </span>
              </span>
            </label>

            {/* Checkbox Opção Horário de Volta */}
            <label 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all select-none ${
                simultaneousDepartures
                  ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-500'
                  : includeVolta 
                    ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 text-slate-900 dark:text-amber-200 shadow-sm cursor-pointer' 
                    : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-400 hover:text-slate-600 cursor-pointer'
              }`}
              title={simultaneousDepartures ? "Desative 'Partidas simultâneas' para filtrar apenas Ida ou Volta" : "Incluir coluna de saída do Ponto de Destino"}
            >
              <input
                type="checkbox"
                checked={includeVolta}
                disabled={simultaneousDepartures}
                onChange={(e) => handleToggleVolta(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400 focus:ring-2 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 rounded text-[9px] font-black uppercase">
                  VOLTA
                </span>
                <span className="truncate max-w-[140px] sm:max-w-[200px]" title={route.destination}>
                  Destino: {route.destination}
                </span>
              </span>
            </label>

            {/* Checkbox Partidas Simultâneas */}
            <label className={`flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-xl border transition-all ${
              simultaneousDepartures
                ? 'bg-amber-400 border-amber-500 text-slate-950 font-black shadow-sm'
                : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:border-amber-400 shadow-sm'
            }`}>
              <input
                type="checkbox"
                checked={simultaneousDepartures}
                onChange={(e) => handleToggleSimultaneous(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-400 focus:ring-2 cursor-pointer"
              />
              <span className="text-xs font-bold">
                Partidas simultâneas
              </span>
            </label>

            {/* Botão de Legendas / Outras Direções */}
            <button
              type="button"
              onClick={() => handleOpenLegendModal()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                activeLegendsList.length > 0
                  ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 text-slate-900 dark:text-amber-200 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-amber-400 shadow-sm'
              }`}
              title="Adicionar ou editar legendas/direções para horários específicos (ex: Passa pelo Centro)"
            >
              <Tag size={13} className="text-amber-500" />
              <span>Legendas ({activeLegendsList.length})</span>
            </button>
          </div>

          {/* Quick Date, Tariff e Zoom Controls */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-zinc-700 shadow-sm">
              <Calendar size={13} className="text-slate-400" />
              <span className="text-[10px] font-black uppercase text-slate-500">Vigência:</span>
              <input
                type="text"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                placeholder="DD/MM/AAAA"
                className="w-24 text-xs font-bold bg-transparent outline-none text-slate-800 dark:text-zinc-200"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-zinc-700 shadow-sm">
              <DollarSign size={13} className="text-emerald-500" />
              <span className="text-[10px] font-black uppercase text-slate-500">Tarifa:</span>
              <input
                type="text"
                value={tariff}
                onChange={(e) => setTariff(e.target.value)}
                placeholder="0,00"
                className="w-16 text-xs font-bold bg-transparent outline-none text-slate-800 dark:text-zinc-200"
              />
            </div>

            {/* Folha A4 Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-[#08456c] dark:text-blue-300 rounded-xl border border-blue-200 dark:border-blue-800 text-[11px] font-black uppercase tracking-wider shadow-xs">
              <span>Folha A4</span>
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 font-mono">(210 × 297 mm)</span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-300 dark:border-zinc-700 shadow-sm">
              <button
                onClick={() => setZoomLevel(prev => Math.max(0.35, prev - 0.1))}
                className="p-1.5 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg"
                title="Reduzir Visualização"
              >
                <ZoomOut size={13} />
              </button>
              <span className="text-[10px] font-black px-1 text-slate-600 dark:text-zinc-300">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(1.2, prev + 0.1))}
                className="p-1.5 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg"
                title="Aumentar Visualização"
              >
                <ZoomIn size={13} />
              </button>
              <button
                onClick={() => setZoomLevel(0.75)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
                title="Redefinir Zoom (100% A4)"
              >
                <RotateCcw size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Edit Times Drawer (Separado por Ida e Volta para cada Dia) */}
        <AnimatePresence>
          {showConfigDrawer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-slate-50 dark:bg-zinc-900 border-b-2 border-slate-200 dark:border-zinc-700 overflow-hidden"
            >
              <div className="p-4 sm:p-5 space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-black uppercase text-[11px] text-slate-700 dark:text-zinc-300">
                      Dia da Semana:
                    </span>
                    <div className="flex gap-1 bg-slate-200 dark:bg-zinc-800 p-1 rounded-xl">
                      {daysConfig.map(day => (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => setActiveDrawerTab(day.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                            activeDrawerTab === day.key
                              ? 'bg-amber-400 text-slate-950 shadow-sm'
                              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {day.badge}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyTimes(activeDrawerTab, 'ida', 'volta')}
                      className="px-2.5 py-1.5 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 hover:border-amber-400"
                      title="Copiar lista de horários da Ida para a Volta neste dia"
                    >
                      <Copy size={12} />
                      <span>Copiar Ida ➔ Volta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyTimes(activeDrawerTab, 'volta', 'ida')}
                      className="px-2.5 py-1.5 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 hover:border-amber-400"
                      title="Copiar lista de horários da Volta para a Ida neste dia"
                    >
                      <Copy size={12} />
                      <span>Copiar Volta ➔ Ida</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSyncSimultaneous}
                      className="px-2.5 py-1.5 bg-amber-400 text-slate-950 font-black rounded-lg text-[10px] uppercase flex items-center gap-1.5 hover:bg-amber-300"
                      title="Sincronizar horários para partidas simultâneas em todos os dias"
                    >
                      <ArrowLeftRight size={12} />
                      <span>Equalizar Ida/Volta</span>
                    </button>
                  </div>
                </div>

                {/* Subseções: Quando Partidas Simultâneas estiver ativo, exibe bloco unificado com horários sincronizados */}
                {simultaneousDepartures ? (
                  <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border-2 border-amber-400 dark:border-amber-500/80 space-y-3 shadow-sm">
                    <div className="flex flex-wrap justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-2.5 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black rounded text-[10px] uppercase shadow-sm">
                          SIMULTÂNEAS
                        </span>
                        <span className="font-black uppercase text-slate-800 dark:text-zinc-200 text-xs sm:text-sm">
                          Saídas Simultâneas (Ida e Volta)
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                          (Horários idênticos partindo de {route.origin} e de {route.destination})
                        </span>
                      </div>
                      <span className="text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-bold border border-amber-200 dark:border-amber-800">
                        {times[activeDrawerTab].ida.length} horários simultâneos
                      </span>
                    </div>

                    <div className="flex gap-2 max-w-md">
                      <input
                        type="text"
                        placeholder="HH:MM (ex: 06:30)"
                        value={newTimeInputs[activeDrawerTab].ida}
                        onChange={(e) => setNewTimeInputs(p => ({
                          ...p,
                          [activeDrawerTab]: { ida: e.target.value, volta: e.target.value }
                        }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTime(activeDrawerTab, 'ida')}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-xs font-mono dark:bg-zinc-900 dark:text-zinc-200 outline-none focus:border-amber-400"
                      />
                      <button
                        onClick={() => handleAddTime(activeDrawerTab, 'ida')}
                        className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl font-black uppercase text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        title="Adicionar Horário de Saída Simultânea"
                      >
                        <Plus size={15} />
                        <span>Adicionar</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                      {times[activeDrawerTab].ida.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">
                          Nenhum horário cadastrado para este dia.
                        </p>
                      ) : (
                        times[activeDrawerTab].ida.map(t => {
                          const leg = getLegendForTime(activeDrawerTab, 'ida', t);
                          return (
                            <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/70 text-slate-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-lg font-mono text-xs font-bold shadow-xs">
                              <span>{t}</span>
                              {leg && (
                                <span className="bg-amber-400 text-slate-950 px-1 rounded text-[9px] font-black" title={leg.text}>
                                  {leg.symbol}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenLegendModal(activeDrawerTab, 'ida', t)}
                                className="text-amber-700 dark:text-amber-400 hover:text-amber-900 p-0.5 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50"
                                title={leg ? `Editar legenda: ${leg.text}` : 'Adicionar legenda a este horário (ex: Passa pelo Centro)'}
                              >
                                <Tag size={12} />
                              </button>
                              <button 
                                onClick={() => handleRemoveTime(activeDrawerTab, 'ida', t)} 
                                className="text-red-500 hover:text-red-700 ml-0.5 hover:scale-110 transition-transform"
                                title="Remover horário"
                              >
                                <X size={13} />
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  /* Subseções Lado a Lado: Horário de Ida (Origem) e Horário de Volta (Destino) */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bloco de Horários: IDA */}
                    <div className="bg-white dark:bg-zinc-950 p-3.5 rounded-2xl border-2 border-yellow-400/60 dark:border-yellow-400/40 space-y-2.5 shadow-sm">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-yellow-400 text-slate-950 font-black rounded text-[10px] uppercase">
                            IDA
                          </span>
                          <span className="font-black uppercase text-slate-800 dark:text-zinc-200 text-xs">
                            Ponto de Origem: {route.origin}
                          </span>
                        </div>
                        <span className="text-[10px] bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full font-bold border border-yellow-200 dark:border-yellow-800">
                          {times[activeDrawerTab].ida.length} horários
                        </span>
                      </div>

                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="HH:MM (ex: 06:30)"
                          value={newTimeInputs[activeDrawerTab].ida}
                          onChange={(e) => setNewTimeInputs(p => ({
                            ...p,
                            [activeDrawerTab]: { ...p[activeDrawerTab], ida: e.target.value }
                          }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTime(activeDrawerTab, 'ida')}
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs font-mono dark:bg-zinc-900 dark:text-zinc-200"
                        />
                        <button
                          onClick={() => handleAddTime(activeDrawerTab, 'ida')}
                          className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 rounded-lg font-black uppercase text-xs flex items-center gap-1 shadow-sm"
                          title="Adicionar Horário de Ida"
                        >
                          <Plus size={15} />
                          <span>Adicionar</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-1">
                        {times[activeDrawerTab].ida.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic py-2">
                            Nenhum horário de ida cadastrado para este dia.
                          </p>
                        ) : (
                          times[activeDrawerTab].ida.map(t => {
                            const leg = getLegendForTime(activeDrawerTab, 'ida', t);
                            return (
                              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-50 dark:bg-yellow-950 text-slate-900 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700 rounded-md font-mono text-[11px] font-bold">
                                <span>{t}</span>
                                {leg && (
                                  <button
                                    type="button"
                                    onClick={() => handleEditLegend(leg)}
                                    className="bg-yellow-400 hover:bg-yellow-500 text-slate-950 px-1 rounded text-[9px] font-black transition-colors"
                                    title={`Legenda: ${leg.symbol} (${leg.text}) - Clique para editar`}
                                  >
                                    {leg.symbol}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => leg ? handleEditLegend(leg) : handleOpenLegendModal(activeDrawerTab, 'ida', t)}
                                  className="text-amber-700 dark:text-amber-400 hover:text-amber-900 ml-0.5 p-0.5"
                                  title={leg ? `Editar legenda: ${leg.text}` : 'Adicionar legenda a este horário (ex: Passa pelo Centro)'}
                                >
                                  {leg ? <Pencil size={11} /> : <Tag size={11} />}
                                </button>
                                <button 
                                  onClick={() => handleRemoveTime(activeDrawerTab, 'ida', t)} 
                                  className="text-red-500 hover:text-red-700 ml-0.5"
                                  title="Remover horário"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Bloco de Horários: VOLTA */}
                    <div className="bg-white dark:bg-zinc-950 p-3.5 rounded-2xl border-2 border-amber-400/60 dark:border-amber-400/40 space-y-2.5 shadow-sm">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black rounded text-[10px] uppercase">
                            VOLTA
                          </span>
                          <span className="font-black uppercase text-slate-800 dark:text-zinc-200 text-xs">
                            Ponto de Destino: {route.destination}
                          </span>
                        </div>
                        <span className="text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-200 dark:border-amber-800">
                          {times[activeDrawerTab].volta.length} horários
                        </span>
                      </div>

                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="HH:MM (ex: 07:00)"
                          value={newTimeInputs[activeDrawerTab].volta}
                          onChange={(e) => setNewTimeInputs(p => ({
                            ...p,
                            [activeDrawerTab]: { ...p[activeDrawerTab], volta: e.target.value }
                          }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTime(activeDrawerTab, 'volta')}
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs font-mono dark:bg-zinc-900 dark:text-zinc-200"
                        />
                        <button
                          onClick={() => handleAddTime(activeDrawerTab, 'volta')}
                          className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg font-black uppercase text-xs flex items-center gap-1 shadow-sm"
                          title="Adicionar Horário de Volta"
                        >
                          <Plus size={15} />
                          <span>Adicionar</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-1">
                        {times[activeDrawerTab].volta.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic py-2">
                            Nenhum horário de volta cadastrado para este dia.
                          </p>
                        ) : (
                          times[activeDrawerTab].volta.map(t => {
                            const leg = getLegendForTime(activeDrawerTab, 'volta', t);
                            return (
                              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-950 text-slate-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-md font-mono text-[11px] font-bold">
                                <span>{t}</span>
                                {leg && (
                                  <button
                                    type="button"
                                    onClick={() => handleEditLegend(leg)}
                                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 px-1 rounded text-[9px] font-black transition-colors"
                                    title={`Legenda: ${leg.symbol} (${leg.text}) - Clique para editar`}
                                  >
                                    {leg.symbol}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => leg ? handleEditLegend(leg) : handleOpenLegendModal(activeDrawerTab, 'volta', t)}
                                  className="text-amber-700 dark:text-amber-400 hover:text-amber-900 ml-0.5 p-0.5"
                                  title={leg ? `Editar legenda: ${leg.text}` : 'Adicionar legenda a este horário (ex: Passa pelo Centro)'}
                                >
                                  {leg ? <Pencil size={11} /> : <Tag size={11} />}
                                </button>
                                <button 
                                  onClick={() => handleRemoveTime(activeDrawerTab, 'volta', t)} 
                                  className="text-red-500 hover:text-red-700 ml-0.5"
                                  title="Remover horário"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Bloco de Gestão de Outras Direções e Legendas de Horário */}
                <div className="bg-amber-50/50 dark:bg-zinc-950 p-4 rounded-2xl border-2 border-amber-300/80 dark:border-amber-500/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 dark:border-zinc-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-400 text-slate-950 rounded-lg">
                        <Tag size={15} />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black uppercase text-slate-900 dark:text-zinc-100">
                          Outras Direções e Legendas (Variações de Itinerário)
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                          Configure variações de trajeto por horário (ex: passa pelo centro, via expressa). A legenda será exportada na grade logo acima da Tarifa.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenLegendModal(activeDrawerTab, 'ida')}
                      className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl font-black uppercase text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                    >
                      <Plus size={14} />
                      <span>Nova Legenda</span>
                    </button>
                  </div>

                  {timeLegends.length === 0 ? (
                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-amber-300 dark:border-zinc-700 text-center">
                      <p className="text-xs text-slate-600 dark:text-zinc-400">
                        Nenhuma legenda de itinerário criada ainda. Clique em <strong>Nova Legenda</strong> ou no ícone <Tag size={12} className="inline text-amber-500" /> ao lado de qualquer horário para adicionar observações como "Passa pelo Centro".
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {timeLegends.map(leg => {
                        const tList = (leg.times && leg.times.length > 0) ? leg.times : (leg.time ? [leg.time] : []);
                        return (
                          <div 
                            key={leg.id}
                            onClick={() => handleEditLegend(leg)}
                            className="flex items-start justify-between p-2.5 bg-white dark:bg-zinc-900 hover:bg-amber-50/50 dark:hover:bg-zinc-800/80 rounded-xl border border-amber-200 dark:border-zinc-700 hover:border-amber-400 shadow-xs cursor-pointer group transition-all"
                            title="Clique para editar esta legenda"
                          >
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="font-mono font-black text-slate-950 bg-amber-400 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5 shadow-xs">
                                {leg.symbol}
                              </span>
                              <div className="min-w-0">
                                <span className="font-bold text-xs text-slate-900 dark:text-zinc-100 block leading-tight truncate group-hover:text-amber-600">
                                  {leg.text}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-mono mt-0.5">
                                  {tList.length === 1 ? (
                                    <>Horário: <strong className="text-slate-800 dark:text-zinc-200">{tList[0]}</strong></>
                                  ) : (
                                    <>Horários ({tList.length}): <strong className="text-slate-800 dark:text-zinc-200">{tList.join(', ')}</strong></>
                                  )}
                                  {' '}• {leg.day === 'weekdays' ? 'Dias Úteis' : leg.day === 'saturday' ? 'Sábado' : 'Domingo'} {simultaneousDepartures ? '(Simultâneo)' : `(${leg.direction.toUpperCase()})`}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditLegend(leg);
                                }}
                                className="px-2 py-1 text-slate-700 dark:text-zinc-200 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-1 text-[11px] font-bold transition-colors"
                                title="Editar esta legenda"
                              >
                                <Pencil size={11} />
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveLegend(leg.id);
                                }}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Remover esta legenda"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Informações e Contatos da Empresa da Rota */}
                <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {company?.logo_url ? (
                      <div className="w-12 h-12 bg-white rounded-xl p-1 border border-slate-200 dark:border-zinc-700 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                        <img 
                          src={company.logo_url} 
                          alt={companyName} 
                          className="w-full h-full object-contain" 
                          referrerPolicy="no-referrer" 
                          crossOrigin="anonymous"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 rounded-xl flex items-center justify-center text-amber-600 border border-amber-200 dark:border-amber-800 shrink-0">
                        <Building2 size={24} />
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider block">
                        Empresa da Rota
                      </span>
                      <h4 className="text-sm font-black uppercase text-slate-800 dark:text-zinc-100 leading-tight">
                        {companyName}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {company?.logo_url ? 'Logo cadastrada vinculada à imagem' : 'Sem logo cadastrada (configure na tela de Empresas)'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex-1 min-w-[170px]">
                      <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">
                        Telefone (Cadastro da Empresa)
                      </label>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700">
                        <Phone size={12} className="text-amber-500 shrink-0" />
                        <input
                          type="text"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder={company?.contact_phone || '(00) 0000-0000'}
                          className="w-full text-xs font-mono font-bold bg-transparent outline-none dark:text-zinc-200"
                        />
                      </div>
                    </div>

                    <div className="flex-1 min-w-[190px]">
                      <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">
                        E-mail (Cadastro da Empresa)
                      </label>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700">
                        <Mail size={12} className="text-amber-500 shrink-0" />
                        <input
                          type="text"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder={company?.contact_email || 'contato@empresa.com'}
                          className="w-full text-xs font-mono font-bold bg-transparent outline-none dark:text-zinc-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Poster Preview Container */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-start justify-center bg-slate-200 dark:bg-zinc-950/70 custom-scrollbar">
          <div 
            style={{ 
              transform: `scale(${zoomLevel})`, 
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
            className="shrink-0"
          >
            {/* ========================================================================= */}
            {/* O CARTAZ DE EXPORTAÇÃO (Formato Folha A4: 794x1123px / 210x297mm)         */}
            {/* ========================================================================= */}
            <div
              ref={posterRef}
              id="timetable-poster-element"
              className="bg-white text-slate-900 w-[794px] min-h-[1123px] flex flex-row border-[6px] border-[#08456c] shadow-2xl relative select-text"
              style={{
                fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                boxSizing: 'border-box'
              }}
            >
              {/* Coluna Principal (Conteúdo do Cartaz A4) */}
              <div className="flex-1 flex flex-col justify-between bg-white">
                
                {/* 1. CABEÇALHO SUPERIOR: Fundo Laranja (#ff6a00) */}
                <div className="bg-[#ff6a00] p-5 sm:p-6 text-white flex items-center justify-between border-b-4 border-orange-700 shadow-md">
                  <div className="flex items-center gap-4 sm:gap-5">
                    {/* Logo da Empresa cadastrada ou Iniciais */}
                    {company?.logo_url ? (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl p-1.5 flex items-center justify-center shadow-xl border-4 border-white/90 shrink-0 overflow-hidden">
                        <img 
                          src={company.logo_url} 
                          alt={companyName} 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex flex-col items-center justify-center text-[#ff6a00] shadow-xl border-4 border-white/90 shrink-0">
                        <Bus size={30} className="text-[#ff6a00]" />
                        <span className="text-[10px] font-black uppercase tracking-tighter leading-none mt-0.5 text-slate-900">
                          {companyName.slice(0, 8)}
                        </span>
                      </div>
                    )}

                    {/* Textos em Caixa Alta */}
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white leading-none drop-shadow-sm whitespace-nowrap">
                        QUADRO DE HORÁRIOS
                      </h1>
                      <p className="text-sm sm:text-base font-black uppercase tracking-wide text-yellow-200 mt-1.5 leading-tight drop-shadow-sm">
                        {companyName}
                      </p>
                    </div>
                  </div>

                  {/* Identificador Padrão A4 */}
                  <div className="hidden sm:flex flex-col items-end opacity-90">
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-100 bg-orange-700/60 px-2.5 py-1 rounded-md border border-orange-400/40">
                      PADRÃO A4
                    </span>
                  </div>
                </div>

                {/* 2. LINHA / TRAJETO E SENTIDOS SELECIONADOS */}
                <div className="py-5 px-6 bg-slate-50 border-b-4 border-slate-200 text-center shadow-inner">
                  {includeIda && includeVolta ? (
                    <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-slate-900 leading-tight flex items-center justify-center flex-wrap gap-2.5">
                      {lineCode && (
                        <span className="not-italic font-mono font-black text-lg sm:text-xl px-3 py-1 bg-slate-900 text-yellow-400 rounded-xl shadow-md border border-slate-700 inline-flex items-center shrink-0">
                          {lineCode}
                        </span>
                      )}
                      <span>{route.origin}</span>
                      <span className="text-slate-400 not-italic font-sans text-xl">x</span>
                      <span>{route.destination}</span>
                    </h2>
                  ) : includeIda ? (
                    <div className="flex items-center justify-center gap-2.5 flex-wrap">
                      <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-slate-900 leading-tight flex items-center gap-2.5">
                        {lineCode && (
                          <span className="not-italic font-mono font-black text-lg sm:text-xl px-3 py-1 bg-slate-900 text-yellow-400 rounded-xl shadow-md border border-slate-700 inline-flex items-center shrink-0">
                            {lineCode}
                          </span>
                        )}
                        <span>{route.origin}</span>
                        <span className="text-amber-500 font-sans font-bold not-italic">➔</span>
                        <span>{route.destination}</span>
                      </h2>
                      <span className="px-2.5 py-0.5 bg-yellow-400 text-slate-950 font-black rounded-lg text-xs uppercase font-sans not-italic shadow-sm">
                        Sentido Ida
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2.5 flex-wrap">
                      <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-slate-900 leading-tight flex items-center gap-2.5">
                        <span>{route.destination}</span>
                        <span className="text-amber-500 font-sans font-bold not-italic">➔</span>
                        {lineCode && (
                          <span className="not-italic font-mono font-black text-lg sm:text-xl px-3 py-1 bg-slate-900 text-yellow-400 rounded-xl shadow-md border border-slate-700 inline-flex items-center shrink-0">
                            {lineCode}
                          </span>
                        )}
                        <span>{route.origin}</span>
                      </h2>
                      <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black rounded-lg text-xs uppercase font-sans not-italic shadow-sm">
                        Sentido Volta
                      </span>
                    </div>
                  )}

                  {/* Controle Condicional: "Saídas Simultâneas" */}
                  {simultaneousDepartures && (
                    <div className="mt-3 inline-block mx-auto py-1.5 px-6 bg-amber-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-widest rounded-lg border-2 border-slate-900 shadow-sm">
                      ★ Saídas Simultâneas ★
                    </div>
                  )}
                </div>

                {/* 3. SEÇÕES DE HORÁRIOS SEPARADAS POR DIAS E COLUNAS DE IDA E VOLTA */}
                <div className="p-6 space-y-4 flex-1 flex flex-col justify-start">
                  {daysConfig.map((day) => {
                    const dayTimes = times[day.key];
                    const hasIda = dayTimes.ida.length > 0;
                    const hasVolta = dayTimes.volta.length > 0;

                    return (
                      <div 
                        key={day.key}
                        className="rounded-2xl overflow-hidden border-2 border-[#0b5c8f] shadow-md bg-[#0b5c8f]"
                      >
                        {/* Cabeçalho do Dia (Ex: Segunda a Sexta-feira) */}
                        <div className="bg-[#08456c] py-2.5 px-5 text-white flex items-center justify-between border-b-2 border-blue-900">
                          <h3 className="font-black text-base uppercase tracking-widest">
                            {day.label}
                          </h3>
                          <div className="flex items-center gap-2">
                            {simultaneousDepartures ? (
                              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                                {dayTimes.ida.length} horários • Saídas Simultâneas
                              </span>
                            ) : includeIda && includeVolta ? (
                              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                                {dayTimes.ida.length} Ida • {dayTimes.volta.length} Volta
                              </span>
                            ) : includeIda ? (
                              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                                {dayTimes.ida.length} partidas (Ida)
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                                {dayTimes.volta.length} partidas (Volta)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Conteúdo: Se Saídas Simultâneas, exibe o texto Saídas Simultâneas ao invés de Ponto de Origem ou Destino */}
                        {simultaneousDepartures ? (
                          /* Bloco Unificado: Saídas Simultâneas */
                          <div className="flex flex-col bg-[#0b5c8f]">
                            <div className="bg-[#073959] py-2.5 px-4 text-center border-b-2 border-[#08456c] flex items-center justify-center gap-2">
                              <span className="px-2.5 py-0.5 bg-yellow-400 text-slate-950 font-black text-xs uppercase rounded font-mono shadow-sm">
                                SIMULTÂNEAS
                              </span>
                              <span className="font-black text-sm sm:text-base uppercase tracking-wider text-white">
                                Saídas Simultâneas
                              </span>
                            </div>
                            <div className="p-5 flex-1 flex flex-col justify-center">
                              {renderTimeBlock(dayTimes.ida, day.key, 'ida')}
                            </div>
                          </div>
                        ) : includeIda && includeVolta ? (
                          /* Duas Colunas: Ida (Ponto de Origem) e Volta (Ponto de Destino) */
                          <div className="grid grid-cols-2 divide-x-2 divide-[#08456c]">
                            {/* Coluna 1: IDA (Ponto de Origem) */}
                            <div className="flex flex-col bg-[#0b5c8f]">
                              <div className="bg-[#073959] py-2 px-3 text-center border-b-2 border-[#08456c] flex items-center justify-center gap-2">
                                <span className="px-2 py-0.5 bg-yellow-400 text-slate-950 font-black text-[10px] uppercase rounded font-mono shadow-sm">
                                  IDA
                                </span>
                                <span className="font-black text-xs sm:text-sm uppercase tracking-wide text-white truncate" title={`Saída do Ponto de Origem: ${route.origin}`}>
                                  Saída: {route.origin}
                                </span>
                              </div>
                              <div className="p-4 flex-1 flex flex-col justify-center">
                                {renderTimeBlock(dayTimes.ida, day.key, 'ida')}
                              </div>
                            </div>

                            {/* Coluna 2: VOLTA (Ponto de Destino) */}
                            <div className="flex flex-col bg-[#0b5c8f]">
                              <div className="bg-[#073959] py-2 px-3 text-center border-b-2 border-[#08456c] flex items-center justify-center gap-2">
                                <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] uppercase rounded font-mono shadow-sm">
                                  VOLTA
                                </span>
                                <span className="font-black text-xs sm:text-sm uppercase tracking-wide text-white truncate" title={`Saída do Ponto de Destino: ${route.destination}`}>
                                  Saída: {route.destination}
                                </span>
                              </div>
                              <div className="p-4 flex-1 flex flex-col justify-center">
                                {renderTimeBlock(dayTimes.volta, day.key, 'volta')}
                              </div>
                            </div>
                          </div>
                        ) : includeIda ? (
                          /* Apenas Coluna de IDA */
                          <div className="flex flex-col bg-[#0b5c8f]">
                            <div className="bg-[#073959] py-2 px-4 text-center border-b-2 border-[#08456c] flex items-center justify-center gap-2">
                              <span className="px-2.5 py-0.5 bg-yellow-400 text-slate-950 font-black text-xs uppercase rounded font-mono shadow-sm">
                                IDA
                              </span>
                              <span className="font-black text-sm uppercase tracking-wide text-white">
                                Ponto de Origem: Saídas de {route.origin}
                              </span>
                            </div>
                            <div className="p-5">
                              {renderTimeBlock(dayTimes.ida, day.key, 'ida')}
                            </div>
                          </div>
                        ) : (
                          /* Apenas Coluna de VOLTA */
                          <div className="flex flex-col bg-[#0b5c8f]">
                            <div className="bg-[#073959] py-2 px-4 text-center border-b-2 border-[#08456c] flex items-center justify-center gap-2">
                              <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-xs uppercase rounded font-mono shadow-sm">
                                VOLTA
                              </span>
                              <span className="font-black text-sm uppercase tracking-wide text-white">
                                Ponto de Destino: Saídas de {route.destination}
                              </span>
                            </div>
                            <div className="p-5">
                              {renderTimeBlock(dayTimes.volta, day.key, 'volta')}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 3.5 LEGENDA / ITINERÁRIOS E OUTRAS DIREÇÕES (ACIMA DA TARIFA) */}
                {activeLegendsList.length > 0 && (
                  <div className="bg-slate-100 border-t-4 border-slate-300 px-6 py-3.5 text-slate-900 shadow-inner">
                    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-[#08456c] text-yellow-300 font-black text-[11px] uppercase rounded font-mono shadow-xs">
                          LEGENDA
                        </span>
                        <h4 className="font-black text-xs sm:text-sm uppercase tracking-wider text-slate-800">
                          Observações de Itinerário / Outras Direções
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          {activeLegendsList.length} {activeLegendsList.length === 1 ? 'variação cadastrada' : 'variações cadastradas'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenLegendModal(activeDrawerTab, 'ida')}
                          className="no-export px-2 py-0.5 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 shadow-xs transition-colors"
                          title="Adicionar nova variação de legenda"
                        >
                          <Plus size={11} />
                          <span>Nova</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      {activeLegendsList.map((item) => (
                        <div 
                          key={item.legendId} 
                          onClick={() => handleEditLegend(item.originalLegend)}
                          className="flex items-start justify-between gap-2.5 p-2.5 bg-white hover:bg-amber-50/70 rounded-xl border border-slate-200 hover:border-amber-400 shadow-xs cursor-pointer group transition-all"
                          title={`Clique para editar a legenda "${item.text}"`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="font-mono font-black text-slate-950 bg-yellow-400 px-2.5 py-0.5 rounded text-xs shrink-0 shadow-xs border border-yellow-500">
                              {item.symbol}
                            </span>
                            <div className="min-w-0">
                              <span className="font-black text-slate-900 text-xs sm:text-sm uppercase block leading-snug group-hover:text-amber-900">
                                {item.text}
                              </span>
                            </div>
                          </div>

                          <div className="no-export opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-300 transition-opacity">
                            <Pencil size={10} />
                            <span>Editar</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. TARIFA: Destaque no rodapé do bloco laranja */}
                <div className="bg-[#ff6a00] py-3.5 px-6 text-white text-center border-t-4 border-orange-700 shadow-md">
                  <p className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white drop-shadow-sm">
                    Tarifa: R$ {tariff}
                  </p>
                </div>

                {/* 5. RODAPÉ DE ATENDIMENTO: Fundo azul escuro (#08456c) */}
                <div className="bg-[#08456c] text-white py-4 sm:py-5 px-6 border-t-4 border-slate-900">
                  <div className="flex flex-col items-center justify-center text-center space-y-2">
                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-[0.25em] text-yellow-300">
                      SERVIÇO DE ATENDIMENTO AO CLIENTE
                    </h4>
                    <div className="text-xs sm:text-sm font-bold text-slate-100 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
                      <span className="flex items-center gap-2">
                        <Phone size={14} className="text-yellow-400 shrink-0" />
                        <span className="tracking-wide">
                          {contactPhone || company?.contact_phone || (company as any)?.phone || systemSettings?.support_phone || 'Telefone não informado'}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Mail size={14} className="text-yellow-400 shrink-0" />
                        <span className="tracking-wide">
                          {contactEmail || company?.contact_email || (company as any)?.email || systemSettings?.support_email || 'E-mail não informado'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* DATA DE ATUALIZAÇÃO: Tarja Vertical Rotacionada na Lateral Direita */}
              <div 
                className="w-14 bg-[#08456c] text-white border-l-4 border-slate-900 flex flex-col items-center justify-center py-6 px-1 select-none shrink-0"
              >
                <div 
                  className="font-black text-xs sm:text-sm uppercase tracking-[0.3em] whitespace-nowrap text-yellow-300"
                  style={{
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)'
                  }}
                >
                  ATUALIZADO EM {effectiveDate}
                </div>
              </div>

            </div>
            {/* Fim do Cartaz */}

          </div>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-4 sm:px-6 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 font-medium">
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-[#08456c] dark:text-blue-200 font-black rounded text-[10px] uppercase font-mono">
              Folha A4 • 210x297mm
            </span>
            <span className="hidden md:inline">
              Ajustado perfeitamente para impressão e exportação em folha A4 (proporção 1:√2 em 300 DPI).
            </span>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-black uppercase border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="px-4 sm:px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-md active:scale-95 transition-all border border-slate-700 disabled:opacity-50"
              title="Salvar grade em arquivo PDF de página única formato A4"
            >
              <FileText size={16} className="text-rose-400" />
              <span>Baixar PDF (A4)</span>
            </button>
            <button
              onClick={handleDownloadPNG}
              disabled={isExporting}
              className="px-5 sm:px-6 py-2.5 bg-[#ff6a00] hover:bg-[#e65f00] text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-xl active:scale-95 transition-all border border-orange-400 disabled:opacity-50"
              title="Baixar imagem PNG de alta resolução ajustada para folha A4"
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Baixar PNG (A4)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL / DIALOG: ADICIONAR / EDITAR LEGENDA DE HORÁRIO ESPECÍFICO           */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {isLegendModalOpen && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white dark:bg-zinc-900 border-2 border-amber-400 dark:border-amber-500/80 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                {/* Cabeçalho do Modal de Legenda */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-slate-950 text-amber-400 rounded-xl shadow-md">
                      <Tag size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm sm:text-base uppercase tracking-tight text-slate-950 leading-tight">
                          {editingLegendId ? 'Editar Legenda de Horário' : 'Nova Legenda de Horário'}
                        </h3>
                        {editingLegendId && (
                          <span className="px-2 py-0.5 bg-slate-950 text-amber-300 text-[10px] font-black uppercase rounded-md tracking-wider">
                            Modo Edição
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-slate-900/80 uppercase tracking-wide">
                        Variações de itinerário com múltiplos horários e escolha de símbolo
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsLegendModalOpen(false)}
                    className="p-1.5 text-slate-900 hover:bg-black/10 rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Corpo do Formulário de Legenda */}
                <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
                  {/* 1. Dia e Sentido */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-700">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-1">
                        Dia da Operação
                      </label>
                      <select
                        value={legendFormDay}
                        onChange={(e) => {
                          const val = e.target.value as 'weekdays' | 'saturday' | 'sunday';
                          setLegendFormDay(val);
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500"
                      >
                        <option value="weekdays">Segunda a Sexta (Dias Úteis)</option>
                        <option value="saturday">Sábado</option>
                        <option value="sunday">Domingo e Feriados</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-1">
                        Sentido da Linha
                      </label>
                      {simultaneousDepartures ? (
                        <div className="px-3 py-2 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold text-slate-900 dark:text-amber-200">
                          Partidas Simultâneas (Ida e Volta)
                        </div>
                      ) : (
                        <select
                          value={legendFormDirection}
                          onChange={(e) => {
                            const val = e.target.value as 'ida' | 'volta';
                            setLegendFormDirection(val);
                          }}
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500"
                        >
                          <option value="ida">Ida (Saída de {route.origin})</option>
                          <option value="volta">Volta (Saída de {route.destination})</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* 2. Seleção de Múltiplos Horários */}
                  <div className="bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-700 pb-2">
                      <div className="flex items-center gap-2">
                        <ListChecks size={16} className="text-amber-500" />
                        <div>
                          <label className="text-xs font-black uppercase text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                            <span>Horários com esta Legenda</span>
                            <span className="px-2 py-0.5 bg-amber-400 text-slate-950 rounded-full text-[10px] font-black">
                              {legendFormTimes.length} selecionado{legendFormTimes.length === 1 ? '' : 's'}
                            </span>
                          </label>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                            Clique para marcar ou desmarcar os horários que realizam esta rota.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSelectAllLegendTimes}
                          className="px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-lg text-[10px] font-bold text-slate-700 dark:text-zinc-300 transition-colors"
                        >
                          Selecionar Todos
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAllLegendTimes}
                          className="px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-lg text-[10px] font-bold text-slate-700 dark:text-zinc-300 transition-colors"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    {/* Grade de chips clicáveis dos horários cadastrados */}
                    {(() => {
                      const avTimes = simultaneousDepartures 
                        ? times[legendFormDay].ida 
                        : legendFormDirection === 'ida' 
                          ? times[legendFormDay].ida 
                          : times[legendFormDay].volta;

                      if (avTimes.length === 0) {
                        return (
                          <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 text-center">
                            <p className="text-xs text-amber-800 dark:text-amber-300">
                              Não há horários cadastrados para este dia/sentido. Digite horários avulsos abaixo.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2 p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 max-h-36 overflow-y-auto custom-scrollbar">
                            {avTimes.map(t => {
                              const isSelected = legendFormTimes.includes(t);
                              return (
                                <button
                                  type="button"
                                  key={t}
                                  onClick={() => toggleLegendTime(t)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                                    isSelected
                                      ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-500 shadow-sm font-black'
                                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700'
                                  }`}
                                >
                                  {isSelected ? (
                                    <Check size={13} className="stroke-[3] text-slate-950" />
                                  ) : (
                                    <Square size={13} className="text-slate-400 dark:text-zinc-500" />
                                  )}
                                  <span>{t}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Adicionar horário avulso ou múltiplos */}
                    <div className="flex gap-2 items-center pt-1">
                      <input
                        type="text"
                        value={legendFormCustomInput}
                        onChange={(e) => setLegendFormCustomInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomLegendTime()}
                        placeholder="Outro horário ou múltiplos (ex: 06:30, 08:00)"
                        className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-zinc-100 outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomLegendTime}
                        className="px-3 py-2 bg-slate-200 dark:bg-zinc-700 hover:bg-amber-400 hover:text-slate-950 text-slate-800 dark:text-zinc-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                      >
                        <Plus size={14} />
                        <span>Adicionar</span>
                      </button>
                    </div>

                    {/* Resumo dos horários marcados */}
                    {legendFormTimes.length > 0 && (
                      <div className="pt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-400 mr-1">
                          Selecionados:
                        </span>
                        {legendFormTimes.map(t => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 rounded-md font-mono text-[11px] font-bold border border-amber-300 dark:border-amber-700"
                          >
                            <span>{t}</span>
                            <button
                              type="button"
                              onClick={() => toggleLegendTime(t)}
                              className="text-amber-800 dark:text-amber-300 hover:text-red-600 ml-0.5"
                              title="Desmarcar horário"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Identificação e Escolha do Símbolo */}
                  <div className="bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-700 pb-2">
                      <div>
                        <label className="text-xs font-black uppercase text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <Tag size={15} className="text-amber-500" />
                          <span>Identificação do Símbolo da Legenda</span>
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                          Identifique e selecione qual símbolo deseja utilizar nos horários.
                        </p>
                      </div>

                      {/* Caixa de exibição do símbolo atualmente ativo */}
                      <div className="flex items-center gap-2 bg-amber-400 px-3 py-1.5 rounded-xl border border-amber-500 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider">
                          Símbolo Atual:
                        </span>
                        <span className="font-mono font-black text-sm text-slate-950 bg-white/90 px-2 py-0.5 rounded shadow-xs">
                          {legendFormSymbol || '*'}
                        </span>
                      </div>
                    </div>

                    {/* Campo de digitação personalizada */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-1">
                        Digitar Símbolo ou Sigla Personalizada (até 6 caracteres):
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={legendFormSymbol}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLegendFormSymbol(val);
                          const cleanSym = val.trim().toLowerCase();
                          if (cleanSym) {
                            const match = timeLegends.find(l => 
                              l.symbol.trim().toLowerCase() === cleanSym && 
                              l.text && l.text.trim()
                            );
                            if (match) {
                              setLegendFormText(match.text.trim());
                            }
                          }
                        }}
                        placeholder="Ex: *, **, (1), (A), CTR, EXP, 1, A"
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-700 rounded-xl text-xs font-mono font-black text-slate-900 dark:text-zinc-100 outline-none focus:border-amber-500"
                      />
                      {(() => {
                        const cleanSym = legendFormSymbol.trim().toLowerCase();
                        const matched = cleanSym ? timeLegends.find(l => l.symbol.trim().toLowerCase() === cleanSym && l.text && l.text.trim()) : null;
                        if (!matched) return null;
                        return (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800/80 mt-1.5">
                            <Check size={13} className="text-amber-600 shrink-0" />
                            <span className="truncate">Símbolo já cadastrado: descrição sincronizada automaticamente ("{matched.text}")</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Paleta de Símbolos por Categorias */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                        Símbolos e Ícones para Identificação Rápida:
                      </span>

                      {/* Ícones & Emojis Visuais */}
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 block mb-1">
                          Ícones Operacionais & Visuais:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: 'Ônibus', sym: '🚌', text: 'Atendimento com Ônibus Convencional' },
                            { label: 'Expresso', sym: '⚡', text: 'Linha Expressa sem paradas intermediárias' },
                            { label: 'Via Centro', sym: '📍', text: 'Passa pelo Centro Comercial' },
                            { label: 'Especial', sym: '⭐', text: 'Horário com Atendimento Especial' },
                            { label: 'Noturno', sym: '🌙', text: 'Horário Noturno / Corujão' },
                            { label: 'Centro', sym: '🏢', text: 'Atendimento aos Centros Empresariais' },
                            { label: 'Escolar', sym: '🏫', text: 'Atendimento aos Estudantes e Escolas' },
                            { label: 'Hospital', sym: '🏥', text: 'Atendimento à Região Hospitalar' },
                            { label: 'Aeroporto', sym: '✈️', text: 'Atendimento direto ao Terminal Aeroportuário' },
                            { label: 'Circular', sym: '🔄', text: 'Linha Circular / Retorno Contínuo' },
                            { label: 'Semidireto', sym: '⏱️', text: 'Viagem Semidireta / Poucas Paradas' }
                          ].map(item => (
                            <button
                              type="button"
                              key={item.sym}
                              onClick={() => {
                                handleSelectSymbol(item.sym);
                                if (!legendFormText) setLegendFormText(item.text);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black transition-all flex items-center gap-1 ${
                                legendFormSymbol === item.sym
                                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-500 shadow-xs scale-105'
                                  : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 border border-slate-200 dark:border-zinc-700'
                              }`}
                            >
                              <span>{item.sym}</span>
                              <span className="text-[9px] opacity-70 font-sans font-normal">({item.label})</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Marcadores e Asteriscos */}
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 block mb-1">
                          Asteriscos & Marcadores:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {['*', '**', '***', '****', '†', '‡', '§'].map(sym => (
                            <button
                              type="button"
                              key={sym}
                              onClick={() => handleSelectSymbol(sym)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black transition-all ${
                                legendFormSymbol === sym
                                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-500 shadow-xs scale-105'
                                  : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 border border-slate-200 dark:border-zinc-700'
                              }`}
                            >
                              {sym}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Números */}
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 block mb-1">
                          Numéricos:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {['(1)', '(2)', '(3)', '(4)', '[1]', '[2]', '¹', '²'].map(sym => (
                            <button
                              type="button"
                              key={sym}
                              onClick={() => handleSelectSymbol(sym)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black transition-all ${
                                legendFormSymbol === sym
                                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-500 shadow-xs scale-105'
                                  : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 border border-slate-200 dark:border-zinc-700'
                              }`}
                            >
                              {sym}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Letras */}
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 block mb-1">
                          Alfabéticos:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {['(A)', '(B)', '(C)', '(D)', '[A]', '[B]', 'A', 'B'].map(sym => (
                            <button
                              type="button"
                              key={sym}
                              onClick={() => handleSelectSymbol(sym)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black transition-all ${
                                legendFormSymbol === sym
                                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-500 shadow-xs scale-105'
                                  : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 border border-slate-200 dark:border-zinc-700'
                              }`}
                            >
                              {sym}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Formas Geométricas */}
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 block mb-1">
                          Formas Geométricas:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {['▲', '●', '◆', '■', '★'].map(sym => (
                            <button
                              type="button"
                              key={sym}
                              onClick={() => handleSelectSymbol(sym)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black transition-all ${
                                legendFormSymbol === sym
                                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-500 shadow-xs scale-105'
                                  : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 border border-slate-200 dark:border-zinc-700'
                              }`}
                            >
                              {sym}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Siglas e Abreviaturas */}
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 block mb-1">
                          Abreviaturas de Itinerário:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: 'Centro', sym: 'CTR' },
                            { label: 'Expresso', sym: 'EXP' },
                            { label: 'Direto', sym: 'DIR' },
                            { label: 'Rodoviária', sym: 'ROD' },
                            { label: 'Escolar', sym: 'ESC' },
                            { label: 'Variante', sym: 'VAR' }
                          ].map(item => (
                            <button
                              type="button"
                              key={item.sym}
                              onClick={() => handleSelectSymbol(item.sym)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-black transition-all flex items-center gap-1 ${
                                legendFormSymbol === item.sym
                                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-500 shadow-xs scale-105'
                                  : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 border border-slate-200 dark:border-zinc-700'
                              }`}
                            >
                              <span>{item.sym}</span>
                              <span className="text-[9px] opacity-60 font-sans font-normal">({item.label})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* PRÉVIA VISUAL EM TEMPO REAL NO CARTAZ */}
                    <div className="mt-3 p-3.5 bg-[#08456c] rounded-2xl border-2 border-yellow-400 text-white space-y-2 shadow-inner">
                      <div className="flex items-center justify-between border-b border-blue-400/30 pb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-yellow-300 flex items-center gap-1.5">
                          <Eye size={13} className="text-yellow-400" />
                          <span>Prévia de Como Aparecerá no Cartaz</span>
                        </span>
                        <span className="text-[9px] font-bold text-blue-200/80 uppercase">
                          Simulação em Tempo Real
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        {/* Prévia Instantânea (Mini-Card) */}
                        <div className="bg-slate-900/60 p-2.5 rounded-xl border border-blue-400/20 text-center w-full sm:w-auto">
                          <span className="text-[9px] text-blue-300 block uppercase font-bold mb-1">
                            Prévia Visual Instantânea (Mini-Card):
                          </span>
                          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-yellow-400/60 shadow-xs">
                            <span className="font-mono text-sm font-black text-white">
                              {legendFormTimes[0] || '06:30'}
                            </span>
                            <span className="px-2 py-0.5 bg-yellow-400 text-slate-950 font-black text-xs font-mono rounded-md shadow-xs">
                              {legendFormSymbol || '*'}
                            </span>
                          </div>
                        </div>

                        {/* No Rodapé de Legendas */}
                        <div className="bg-slate-900/60 p-2.5 rounded-xl border border-blue-400/20 flex-1 w-full text-left">
                          <span className="text-[9px] text-blue-300 block uppercase font-bold">
                            No Rodapé da Grade (acima da Tarifa):
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-yellow-400 text-slate-950 font-black text-xs font-mono rounded shrink-0 shadow-xs">
                              {legendFormSymbol || '*'}
                            </span>
                            <div className="min-w-0">
                              <span className="text-xs font-black text-white uppercase block truncate">
                                {legendFormText || 'Ex: Passa pelo Centro da Cidade'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Descrição da Legenda / Outra Direção */}
                  <div className="bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-2">
                    <label className="block text-xs font-black uppercase text-slate-800 dark:text-zinc-200">
                      Texto da Legenda / Variação de Itinerário
                    </label>
                    <input
                      type="text"
                      value={legendFormText}
                      onChange={(e) => setLegendFormText(e.target.value)}
                      placeholder="Ex: Passa pelo Centro da Cidade"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border-2 border-amber-400 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-zinc-100 outline-none focus:border-amber-500 shadow-sm"
                    />

                    {/* Sugestões Rápidas */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        Sugestões Rápidas de Itinerário:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Passa pelo Centro da Cidade',
                          'Não passa pelo Centro (Via Expressa)',
                          'Via Bairro / Periférico',
                          'Atendimento Escolar',
                          'Direto / Sem Paradas Intermediárias',
                          'Via Rodovia / Variante'
                        ].map(preset => (
                          <button
                            type="button"
                            key={preset}
                            onClick={() => setLegendFormText(preset)}
                            className="px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-[10px] font-semibold transition-colors border border-slate-200 dark:border-zinc-700"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rodapé de Ações do Modal de Legenda */}
                <div className="p-4 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2 shrink-0">
                  <div>
                    {editingLegendId && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLegend(editingLegendId)}
                        className="px-3 py-2 bg-red-100 dark:bg-red-950/60 hover:bg-red-200 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 size={13} />
                        <span>Excluir Legenda</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLegendModalOpen(false)}
                      className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveLegend}
                      className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                    >
                      <CheckCircle2 size={15} />
                      <span>Salvar Legenda ({legendFormTimes.length} horários)</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default TimetableExportModal;
