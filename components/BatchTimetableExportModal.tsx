import React, { useState, useMemo, useRef } from 'react';
import { BusRoute, Company, Trip, SystemSettings } from '../types';
import { 
  X, 
  Download, 
  Search, 
  CheckSquare, 
  Square, 
  Loader2, 
  Calendar, 
  Bus, 
  FolderArchive, 
  CheckCircle2, 
  AlertCircle,
  FileArchive,
  Phone,
  Mail,
  RefreshCw,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { supabase } from '../services/supabaseClient';

interface BatchTimetableExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: BusRoute[];
  companies: Company[];
  systemSettings?: SystemSettings;
  trips?: Trip[];
  addToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface TimeLegendEntry {
  id: string;
  day: 'weekdays' | 'saturday' | 'sunday';
  direction: 'ida' | 'volta';
  time?: string;
  times?: string[];
  symbol: string;
  text: string;
}

interface ParsedRouteSchedule {
  weekdays: { ida: string[]; volta: string[] };
  saturday: { ida: string[]; volta: string[] };
  sunday: { ida: string[]; volta: string[] };
}

export const BatchTimetableExportModal: React.FC<BatchTimetableExportModalProps> = ({
  isOpen,
  onClose,
  routes = [],
  companies = [],
  systemSettings,
  trips = [],
  addToast
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRouteIds, setSelectedRouteIds] = useState<Set<string>>(() => new Set(routes.map(r => r.id)));
  const [simultaneousDepartures, setSimultaneousDepartures] = useState(false);
  const [includeIda, setIncludeIda] = useState(true);
  const [includeVolta, setIncludeVolta] = useState(true);
  
  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }, []);
  const [effectiveDate, setEffectiveDate] = useState(todayStr);

  // Progress state during batch generation
  const [isExporting, setIsExporting] = useState(false);
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0, routeName: '', percent: 0 });
  const [completedList, setCompletedList] = useState<{ id: string; name: string; success: boolean; error?: string }[]>([]);

  // Hidden poster ref and state for current rendering route
  const hiddenPosterRef = useRef<HTMLDivElement>(null);
  const [renderingRoute, setRenderingRoute] = useState<{
    route: BusRoute;
    company: Company | null;
    companyName: string;
    contactPhone: string;
    contactEmail: string;
    tariff: string;
    lineCode: string;
    schedule: ParsedRouteSchedule;
    legends: TimeLegendEntry[];
  } | null>(null);

  // Filtered routes based on search
  const filteredRoutes = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return routes;
    return routes.filter(r => 
      (r.prefixo_linha || '').toLowerCase().includes(term) ||
      (r.origin || '').toLowerCase().includes(term) ||
      (r.destination || '').toLowerCase().includes(term) ||
      (r.route_type || '').toLowerCase().includes(term)
    );
  }, [routes, searchTerm]);

  // Handle select / deselect all
  const handleSelectAll = () => {
    setSelectedRouteIds(new Set(filteredRoutes.map(r => r.id)));
  };

  const handleDeselectAll = () => {
    setSelectedRouteIds(new Set());
  };

  const toggleRouteSelection = (id: string) => {
    setSelectedRouteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Helper to fetch schedule for a single route
  const fetchRouteSchedule = async (route: BusRoute): Promise<ParsedRouteSchedule> => {
    let weekdaysIda: string[] = [];
    let weekdaysVolta: string[] = [];
    let saturdayIda: string[] = [];
    let saturdayVolta: string[] = [];
    let sundayIda: string[] = [];
    let sundayVolta: string[] = [];

    try {
      const { data, error } = await supabase
        .from('timetables')
        .select('*')
        .or(`route_id.eq.${route.id},route_id.eq.${route.prefixo_linha}`);

      if (!error && Array.isArray(data) && data.length > 0) {
        data.forEach((row: any) => {
          if (row.schedule && typeof row.schedule === 'object') {
            const extractItems = (arr: any[], targetIda: string[], targetVolta: string[]) => {
              if (Array.isArray(arr)) {
                arr.forEach((x: any) => {
                  const t = typeof x === 'string' ? x : x?.time;
                  if (!t) return;
                  const dir = typeof x === 'object' && x?.direction ? x.direction : 'IDA';
                  if (dir === 'VOLTA') targetVolta.push(t);
                  else targetIda.push(t);
                });
              }
            };
            extractItems(row.schedule.weekdays, weekdaysIda, weekdaysVolta);
            extractItems(row.schedule.saturday, saturdayIda, saturdayVolta);
            extractItems(row.schedule.sunday, sundayIda, sundayVolta);
          }

          const rawDay = (row.day_type || row.day_of_week || row.tipo_dia || row.category || '').toString().toLowerCase();
          const rawTime = row.time || row.departure_time || row.horario;
          const rowDir = (row.direction || row.sentido || '').toString().toUpperCase() === 'VOLTA' ? 'VOLTA' : 'IDA';

          if (rawTime) {
            const timeStr = String(rawTime).slice(0, 5);
            if (rawDay.includes('week') || rawDay.includes('util') || rawDay.includes('segunda') || rawDay.includes('sexta')) {
              if (rowDir === 'VOLTA') weekdaysVolta.push(timeStr);
              else weekdaysIda.push(timeStr);
            } else if (rawDay.includes('sat') || rawDay.includes('sab') || rawDay.includes('sábado')) {
              if (rowDir === 'VOLTA') saturdayVolta.push(timeStr);
              else saturdayIda.push(timeStr);
            } else if (rawDay.includes('sun') || rawDay.includes('dom') || rawDay.includes('domingo')) {
              if (rowDir === 'VOLTA') sundayVolta.push(timeStr);
              else sundayIda.push(timeStr);
            }
          }
        });
      }
    } catch (err) {
      console.warn("Consulta Supabase timetables (batch):", err);
    }

    const appendFromRouteSchedule = (arr: any[] | undefined, targetIda: string[], targetVolta: string[]) => {
      if (Array.isArray(arr)) {
        arr.forEach((item: any) => {
          const t = typeof item === 'string' ? item : item?.time;
          if (!t) return;
          const dir = typeof item === 'object' && item?.direction ? item.direction : 'IDA';
          if (dir === 'VOLTA') targetVolta.push(t);
          else targetIda.push(t);
        });
      }
    };

    if (weekdaysIda.length === 0 && weekdaysVolta.length === 0) {
      appendFromRouteSchedule(route.schedule?.weekdays, weekdaysIda, weekdaysVolta);
    }
    if (saturdayIda.length === 0 && saturdayVolta.length === 0) {
      appendFromRouteSchedule(route.schedule?.saturday, saturdayIda, saturdayVolta);
    }
    if (sundayIda.length === 0 && sundayVolta.length === 0) {
      appendFromRouteSchedule(route.schedule?.sunday, sundayIda, sundayVolta);
    }

    const routeTrips = trips.filter(t => t.route_id === route.id && t.departure_time);
    const hasAnySchedule = weekdaysIda.length > 0 || weekdaysVolta.length > 0 ||
      saturdayIda.length > 0 || saturdayVolta.length > 0 ||
      sundayIda.length > 0 || sundayVolta.length > 0;

    if (!hasAnySchedule && routeTrips.length > 0) {
      routeTrips.forEach(t => {
        const d = new Date(t.trip_date);
        const day = d.getDay();
        const time = String(t.departure_time).slice(0, 5);
        const dir = t.direction || 'IDA';
        if (day === 0) {
          if (dir === 'VOLTA') sundayVolta.push(time);
          else sundayIda.push(time);
        } else if (day === 6) {
          if (dir === 'VOLTA') saturdayVolta.push(time);
          else saturdayIda.push(time);
        } else {
          if (dir === 'VOLTA') weekdaysVolta.push(time);
          else weekdaysIda.push(time);
        }
      });
    }

    const sortAndDedupe = (arr: string[]) => {
      return Array.from(new Set(arr.map(t => t.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    };

    let finalSchedule: ParsedRouteSchedule = {
      weekdays: {
        ida: sortAndDedupe(weekdaysIda),
        volta: sortAndDedupe(weekdaysVolta)
      },
      saturday: {
        ida: sortAndDedupe(saturdayIda),
        volta: sortAndDedupe(saturdayVolta)
      },
      sunday: {
        ida: sortAndDedupe(sundayIda),
        volta: sortAndDedupe(sundayVolta)
      }
    };

    if (simultaneousDepartures) {
      const syncDay = (d: { ida: string[]; volta: string[] }) => {
        const merged = Array.from(new Set([...d.ida, ...d.volta])).sort((a, b) => a.localeCompare(b));
        return { ida: [...merged], volta: [...merged] };
      };
      finalSchedule = {
        weekdays: syncDay(finalSchedule.weekdays),
        saturday: syncDay(finalSchedule.saturday),
        sunday: syncDay(finalSchedule.sunday)
      };
    }

    return finalSchedule;
  };

  // Helper to retrieve saved legends for a route
  const getLegendsForRoute = (route: BusRoute): TimeLegendEntry[] => {
    try {
      const saved = localStorage.getItem(`consimp_route_legends_${route.id}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // ignore
    }
    return [];
  };

  // Execute Batch Export into ZIP
  const handleStartBatchExport = async () => {
    const selectedList = routes.filter(r => selectedRouteIds.has(r.id));
    if (selectedList.length === 0) {
      addToast?.("Selecione pelo menos uma rota para exportar.", "warning");
      return;
    }

    setIsExporting(true);
    setCompletedList([]);
    const zip = new JSZip();
    const total = selectedList.length;

    let successCount = 0;

    for (let i = 0; i < total; i++) {
      const currentRoute = selectedList[i];
      const routeDisplayName = `${currentRoute.prefixo_linha || ''} ${currentRoute.origin} x ${currentRoute.destination}`.trim();
      
      setCurrentProgress({
        current: i + 1,
        total,
        routeName: routeDisplayName,
        percent: Math.round(((i) / total) * 100)
      });

      try {
        const routeCompany = companies.find(c => c.id === currentRoute.company_id) || null;
        const compName = (
          routeCompany?.nome_fantasia || 
          routeCompany?.name || 
          routeCompany?.razao_social || 
          systemSettings?.company_name || 
          'EMPRESA'
        ).toUpperCase();

        const phone = routeCompany?.contact_phone || (routeCompany as any)?.phone || systemSettings?.support_phone || '';
        const email = routeCompany?.contact_email || (routeCompany as any)?.email || systemSettings?.support_email || '';
        const totalPrice = (currentRoute.price || 0) + (currentRoute.toll || 0) + (currentRoute.fees || 0);
        const tariffStr = totalPrice > 0 ? totalPrice.toFixed(2).replace('.', ',') : '0,00';
        const lineCodeStr = (currentRoute.prefixo_linha || currentRoute.code || '').trim();

        const schedule = await fetchRouteSchedule(currentRoute);
        const legends = getLegendsForRoute(currentRoute);

        // Mount the hidden poster element with this route's data
        setRenderingRoute({
          route: currentRoute,
          company: routeCompany,
          companyName: compName,
          contactPhone: phone,
          contactEmail: email,
          tariff: tariffStr,
          lineCode: lineCodeStr,
          schedule,
          legends
        });

        // Wait for DOM to paint fonts/images
        await new Promise(res => setTimeout(res, 220));

        if (hiddenPosterRef.current) {
          const dataUrl = await toPng(hiddenPosterRef.current, {
            pixelRatio: 3,
            cacheBust: true,
            backgroundColor: '#ffffff',
            filter: (node: HTMLElement) => !node.classList?.contains('no-export')
          });

          // Convert base64 dataUrl to pure base64 string
          const base64Data = dataUrl.split(',')[1];

          // Sanitize filename
          const cleanLineCode = lineCodeStr.replace(/[/\\?%*:|"<>]/g, '-');
          const cleanOrigin = (currentRoute.origin || 'Origem').trim().replace(/[/\\?%*:|"<>]/g, '-');
          const cleanDest = (currentRoute.destination || 'Destino').trim().replace(/[/\\?%*:|"<>]/g, '-');

          const filename = cleanLineCode
            ? `${cleanLineCode} - ${cleanOrigin} x ${cleanDest}.png`
            : `${cleanOrigin} x ${cleanDest}.png`;

          zip.file(filename, base64Data, { base64: true });
          successCount++;
          setCompletedList(prev => [...prev, { id: currentRoute.id, name: routeDisplayName, success: true }]);
        } else {
          throw new Error("Elemento do cartaz não encontrado no DOM");
        }
      } catch (err: any) {
        console.error(`Erro ao gerar PNG para rota ${routeDisplayName}:`, err);
        setCompletedList(prev => [...prev, { id: currentRoute.id, name: routeDisplayName, success: false, error: err?.message || 'Erro ao renderizar' }]);
      }
    }

    // Finished processing all routes - generate zip
    setCurrentProgress({
      current: total,
      total,
      routeName: "Compactando arquivo ZIP...",
      percent: 100
    });

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        // Optional progress inside ZIP generation
      });

      const dateStr = effectiveDate.replace(/\//g, '-');
      const zipFilename = `Grades_de_Horarios_ViaLivre_${dateStr}.zip`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      addToast?.(`Exportação concluída! ${successCount} grades foram compactadas com sucesso em ${zipFilename}.`, "success");
    } catch (zipErr) {
      console.error("Erro ao gerar arquivo compactado ZIP:", zipErr);
      addToast?.("Erro ao compactar o arquivo ZIP.", "error");
    } finally {
      setIsExporting(false);
      setRenderingRoute(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white dark:bg-zinc-900 w-full max-w-5xl max-h-[92vh] rounded-3xl shadow-2xl border-2 border-yellow-400 flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-5 sm:px-8 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-[#ff6a00] flex items-center justify-center text-slate-950 font-black shadow-lg">
              <FolderArchive size={26} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center gap-2">
                <span>Exportação em Lote de Grades (ZIP)</span>
                <span className="text-[10px] not-italic font-sans font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full uppercase tracking-normal">
                  Alta Resolução (PNG)
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Selecione as rotas desejadas para gerar e baixar um arquivo compactado (.ZIP) com todas as grades em PNG.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Modal Controls and Filter Bar */}
        <div className="p-5 bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shrink-0">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por prefixo, linha, origem ou destino..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isExporting}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-900 dark:text-zinc-100 outline-none focus:border-amber-400 transition-all shadow-xs"
            />
          </div>

          {/* Quick Configuration Options */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Partidas Simultâneas */}
            <label className={`flex items-center gap-2 cursor-pointer select-none px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
              simultaneousDepartures
                ? 'bg-amber-400 border-amber-500 text-slate-950 font-black shadow-sm'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-amber-400 shadow-xs'
            }`}>
              <input
                type="checkbox"
                checked={simultaneousDepartures}
                onChange={(e) => setSimultaneousDepartures(e.target.checked)}
                disabled={isExporting}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-400 cursor-pointer"
              />
              <span>Partidas Simultâneas</span>
            </label>

            {/* Data de Vigência */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-xs">
              <Calendar size={14} className="text-amber-500 shrink-0" />
              <span className="text-[10px] font-black uppercase text-slate-400">Vigência:</span>
              <input
                type="text"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                disabled={isExporting}
                placeholder="DD/MM/AAAA"
                className="w-24 text-xs font-mono font-bold bg-transparent outline-none dark:text-zinc-200"
              />
            </div>
          </div>
        </div>

        {/* Selection Toolbar */}
        <div className="px-5 py-3 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-4 text-xs font-bold text-slate-600 dark:text-zinc-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900 dark:text-zinc-100">
              {selectedRouteIds.size} de {routes.length} rotas selecionadas
            </span>
            {selectedRouteIds.size > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-md text-[10px] font-black border border-amber-300 dark:border-amber-800">
                Pronto para compactar
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
            >
              <CheckSquare size={13} className="text-amber-500" />
              <span>Selecionar Todas</span>
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
            >
              <Square size={13} className="text-slate-400" />
              <span>Desmarcar Todas</span>
            </button>
          </div>
        </div>

        {/* Routes Selection Grid / List */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-100/60 dark:bg-zinc-950/40">
          {filteredRoutes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bus size={40} className="text-slate-300 dark:text-zinc-700 mb-3" />
              <p className="text-sm font-black text-slate-400 uppercase">Nenhum itinerário encontrado</p>
              <p className="text-xs text-slate-400 mt-1">Verifique o termo digitado no campo de busca.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredRoutes.map((route) => {
                const isSelected = selectedRouteIds.has(route.id);
                const company = companies.find(c => c.id === route.company_id);
                const totalTimesCount = 
                  (route.schedule?.weekdays?.length || 0) +
                  (route.schedule?.saturday?.length || 0) +
                  (route.schedule?.sunday?.length || 0);

                return (
                  <div
                    key={route.id}
                    onClick={() => !isExporting && toggleRouteSelection(route.id)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-400 shadow-md ring-1 ring-amber-400'
                        : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 shadow-xs'
                    } ${isExporting ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm px-2.5 py-1 bg-slate-900 text-yellow-400 rounded-xl shadow-xs border border-slate-700">
                            {route.prefixo_linha || 'S/P'}
                          </span>
                          <span className="text-[10px] font-black uppercase text-slate-400">
                            {route.route_type || 'URBANO'}
                          </span>
                        </div>
                        <div className="text-amber-500">
                          {isSelected ? <CheckSquare size={20} className="text-amber-500 fill-amber-100 dark:fill-amber-950" /> : <Square size={20} className="text-slate-300 dark:text-zinc-600" />}
                        </div>
                      </div>

                      <h4 className="font-black text-xs uppercase italic text-slate-800 dark:text-zinc-100 line-clamp-2 leading-snug">
                        {route.origin} <span className="text-amber-500 not-italic font-sans">x</span> {route.destination}
                      </h4>

                      {company && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 truncate">
                          Empresa: {company.nome_fantasia || company.name}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-2.5 mt-3 text-[10px] font-bold">
                      <span className="text-slate-500 dark:text-zinc-400">
                        {totalTimesCount > 0 ? `${totalTimesCount} horários cadastrados` : 'Sem horários diretos'}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">
                        R$ {((route.price || 0) + (route.toll || 0) + (route.fees || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Batch Export In-Progress Overlay / Drawer */}
        <AnimatePresence>
          {isExporting && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="p-5 bg-slate-900 text-white border-t-2 border-yellow-400 shrink-0 space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black animate-pulse">
                    <Loader2 size={22} className="animate-spin text-slate-950" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-yellow-300">
                      Processando {currentProgress.current} de {currentProgress.total} grades
                    </h4>
                    <p className="text-xs text-slate-300 truncate max-w-md">
                      {currentProgress.routeName}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xl font-mono font-black text-amber-400">
                    {currentProgress.percent}%
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    Progresso Geral
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-[#ff6a00] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${currentProgress.percent}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:px-8 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Cada grade é gerada individualmente em <strong>PNG Alta Resolução (3x)</strong> e adicionada ao arquivo <strong>.ZIP</strong>.
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleStartBatchExport}
              disabled={isExporting || selectedRouteIds.size === 0}
              className="flex-1 sm:flex-none px-8 py-3 bg-gradient-to-r from-amber-400 to-[#ff6a00] hover:from-amber-500 hover:to-[#e65f00] text-slate-950 font-black rounded-xl text-xs uppercase flex items-center justify-center gap-2 shadow-xl border-2 border-slate-950 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-slate-950" />
                  <span>Gerando ZIP ({currentProgress.current}/{currentProgress.total})...</span>
                </>
              ) : (
                <>
                  <FileArchive size={16} className="text-slate-950" />
                  <span>Baixar ZIP ({selectedRouteIds.size} Rotas)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* ========================================================================= */}
      {/* CONTAINER OFF-SCREEN / OCULTO PARA RENDERIZAR CADA CARTAZ DURANTE O LOTE */}
      {/* ========================================================================= */}
      <div 
        style={{ 
          position: 'fixed', 
          top: '-99999px', 
          left: '-99999px', 
          zIndex: -100, 
          pointerEvents: 'none', 
          opacity: 0 
        }}
      >
        {renderingRoute && (
          <div
            ref={hiddenPosterRef}
            className="bg-white text-slate-900 w-[820px] min-h-[960px] flex flex-row border-[6px] border-[#08456c] shadow-2xl relative select-text"
            style={{
              fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              boxSizing: 'border-box'
            }}
          >
            {/* Coluna Principal */}
            <div className="flex-1 flex flex-col justify-between bg-white">
              {/* 1. CABEÇALHO SUPERIOR */}
              <div className="bg-[#ff6a00] p-6 sm:p-7 text-white flex items-center justify-between border-b-4 border-orange-700 shadow-md">
                <div className="flex items-center gap-5">
                  {renderingRoute.company?.logo_url ? (
                    <div className="w-20 h-20 bg-white rounded-2xl p-1.5 flex items-center justify-center shadow-xl border-4 border-white/90 shrink-0 overflow-hidden">
                      <img 
                        src={renderingRoute.company.logo_url} 
                        alt={renderingRoute.companyName} 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-white rounded-full flex flex-col items-center justify-center text-[#ff6a00] shadow-xl border-4 border-white/90 shrink-0">
                      <Bus size={32} className="text-[#ff6a00]" />
                      <span className="text-[10px] font-black uppercase tracking-tighter leading-none mt-0.5 text-slate-900">
                        {renderingRoute.companyName.slice(0, 8)}
                      </span>
                    </div>
                  )}

                  <div>
                    <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white leading-none drop-shadow-sm whitespace-nowrap">
                      QUADRO DE HORÁRIOS
                    </h1>
                    <p className="text-sm sm:text-base font-black uppercase tracking-wide text-yellow-200 mt-1.5 leading-tight drop-shadow-sm">
                      {renderingRoute.companyName}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. LINHA / TRAJETO */}
              <div className="py-5 px-6 bg-slate-50 border-b-4 border-slate-200 text-center shadow-inner">
                <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-slate-900 leading-tight flex items-center justify-center flex-wrap gap-2.5">
                  {renderingRoute.lineCode && (
                    <span className="not-italic font-mono font-black text-lg sm:text-xl px-3 py-1 bg-slate-900 text-yellow-400 rounded-xl shadow-md border border-slate-700 inline-flex items-center shrink-0">
                      {renderingRoute.lineCode}
                    </span>
                  )}
                  <span>{renderingRoute.route.origin}</span>
                  <span className="text-slate-400 not-italic font-sans text-xl">x</span>
                  <span>{renderingRoute.route.destination}</span>
                </h2>

                {simultaneousDepartures && (
                  <div className="mt-3 inline-block mx-auto py-1.5 px-6 bg-amber-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-widest rounded-lg border-2 border-slate-900 shadow-sm">
                    ★ Saídas Simultâneas ★
                  </div>
                )}
              </div>

              {/* 3. SEÇÕES DE HORÁRIOS */}
              <div className="p-6 space-y-4 flex-1 flex flex-col justify-start">
                {[
                  { key: 'weekdays' as const, label: 'Segunda a Sexta-feira' },
                  { key: 'saturday' as const, label: 'Sábados' },
                  { key: 'sunday' as const, label: 'Domingos e Feriados' }
                ].map(day => {
                  const dayTimes = renderingRoute.schedule[day.key];
                  const hasTimes = dayTimes.ida.length > 0 || dayTimes.volta.length > 0;

                  const renderTimeList = (list: string[], dir: 'ida' | 'volta') => {
                    if (list.length === 0) {
                      return <span className="text-xs text-white/50 italic py-1 block text-center">Nenhum horário cadastrado</span>;
                    }
                    return (
                      <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 py-1">
                        {list.map((time, idx) => {
                          const leg = renderingRoute.legends.find(l => {
                            if (l.day !== day.key) return false;
                            if (!simultaneousDepartures && l.direction !== dir) return false;
                            const tList = (l.times && l.times.length > 0) ? l.times : (l.time ? [l.time] : []);
                            return tList.includes(time);
                          });

                          return (
                            <React.Fragment key={`${time}-${idx}`}>
                              <span className={`inline-flex items-baseline font-black text-sm sm:text-base font-mono tracking-wider ${leg ? 'text-yellow-200' : 'text-white'}`}>
                                <span>{time}</span>
                                {leg && (
                                  <sup className="text-yellow-400 font-black ml-0.5 text-xs font-sans tracking-normal select-none drop-shadow-sm">
                                    {leg.symbol}
                                  </sup>
                                )}
                              </span>
                              {idx < list.length - 1 && (
                                <span className="text-blue-300/40 select-none font-sans text-xs">•</span>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    );
                  };

                  return (
                    <div key={day.key} className="rounded-2xl overflow-hidden border-2 border-[#0b5c8f] shadow-md bg-[#0b5c8f]">
                      <div className="bg-[#08456c] py-2.5 px-5 text-white flex items-center justify-between border-b-2 border-blue-900">
                        <h3 className="font-black text-base uppercase tracking-widest">{day.label}</h3>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                          {simultaneousDepartures 
                            ? `${dayTimes.ida.length} horários • Saídas Simultâneas`
                            : `${dayTimes.ida.length} Ida • ${dayTimes.volta.length} Volta`}
                        </span>
                      </div>

                      {simultaneousDepartures ? (
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
                            {renderTimeList(dayTimes.ida, 'ida')}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 divide-x-2 divide-[#08456c]">
                          {/* Coluna 1: IDA */}
                          <div className="flex flex-col bg-[#0b5c8f]">
                            <div className="bg-[#073959] py-2 px-3 text-center border-b-2 border-[#08456c] flex items-center justify-center gap-2">
                              <span className="px-2 py-0.5 bg-yellow-400 text-slate-950 font-black text-[10px] uppercase rounded font-mono shadow-sm">
                                IDA
                              </span>
                              <span className="font-black text-xs sm:text-sm uppercase tracking-wide text-white truncate">
                                Saída: {renderingRoute.route.origin}
                              </span>
                            </div>
                            <div className="p-4 flex-1 flex flex-col justify-center">
                              {renderTimeList(dayTimes.ida, 'ida')}
                            </div>
                          </div>

                          {/* Coluna 2: VOLTA */}
                          <div className="flex flex-col bg-[#0b5c8f]">
                            <div className="bg-[#073959] py-2 px-3 text-center border-b-2 border-[#08456c] flex items-center justify-center gap-2">
                              <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] uppercase rounded font-mono shadow-sm">
                                VOLTA
                              </span>
                              <span className="font-black text-xs sm:text-sm uppercase tracking-wide text-white truncate">
                                Saída: {renderingRoute.route.destination}
                              </span>
                            </div>
                            <div className="p-4 flex-1 flex flex-col justify-center">
                              {renderTimeList(dayTimes.volta, 'volta')}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 3.5 LEGENDAS (SE EXISTIREM) */}
              {renderingRoute.legends.length > 0 && (
                <div className="bg-slate-100 border-t-4 border-slate-300 px-6 py-3.5 text-slate-900 shadow-inner">
                  <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-200">
                    <span className="px-2.5 py-0.5 bg-[#08456c] text-yellow-300 font-black text-[11px] uppercase rounded font-mono shadow-xs">
                      LEGENDA
                    </span>
                    <h4 className="font-black text-xs sm:text-sm uppercase tracking-wider text-slate-800">
                      Observações de Itinerário / Outras Direções
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    {renderingRoute.legends.map((item) => (
                      <div key={item.id} className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                        <span className="font-mono font-black text-slate-950 bg-yellow-400 px-2.5 py-0.5 rounded text-xs shrink-0 shadow-xs border border-yellow-500">
                          {item.symbol}
                        </span>
                        <span className="font-black text-slate-900 text-xs sm:text-sm uppercase leading-snug">
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. TARIFA */}
              <div className="bg-[#ff6a00] py-3.5 px-6 text-white text-center border-t-4 border-orange-700 shadow-md">
                <p className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white drop-shadow-sm">
                  Tarifa: R$ {renderingRoute.tariff}
                </p>
              </div>

              {/* 5. RODAPÉ DE ATENDIMENTO */}
              <div className="bg-[#08456c] text-white py-4 sm:py-5 px-6 border-t-4 border-slate-900">
                <div className="flex flex-col items-center justify-center text-center space-y-2">
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-[0.25em] text-yellow-300">
                    SERVIÇO DE ATENDIMENTO AO CLIENTE
                  </h4>
                  <div className="text-xs sm:text-sm font-bold text-slate-100 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
                    <span className="flex items-center gap-2">
                      <Phone size={14} className="text-yellow-400 shrink-0" />
                      <span>{renderingRoute.contactPhone || 'Telefone não informado'}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Mail size={14} className="text-yellow-400 shrink-0" />
                      <span>{renderingRoute.contactEmail || 'E-mail não informado'}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* DATA DE ATUALIZAÇÃO: Tarja Vertical */}
            <div className="w-14 bg-[#08456c] text-white border-l-4 border-slate-900 flex flex-col items-center justify-center py-6 px-1 select-none shrink-0">
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
        )}
      </div>
    </div>
  );
};

export default BatchTimetableExportModal;
