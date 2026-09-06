
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Trip, BusRoute, Company, User, PassengerDetails, TicketSale, IssueReport, DriverLog } from '../types';
import { FileText, Search, Building2, UserCircle, Download, Printer, TrendingUp, DollarSign, X, Clock, MapPin, Bus, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, Wallet, History, Users, Loader2, Calendar, ClipboardList, Wrench, BarChart as BarChartIcon, LayoutGrid } from 'lucide-react';
import { db } from '../services/database';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import SchedulePoster from './SchedulePoster';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDate, formatDateTime } from '../utils/dateFormatter';

declare const html2pdf: any;

interface ReportManagerProps {
  trips: Trip[];
  routes: BusRoute[];
  companies: Company[];
  users: User[];
  currentUser: User | null;
  onDeleteTrip: (id: string) => void;
}

const COLORS = ['#FACC15', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F43F5E', '#14B8A6'];

const formatDateBr = (dateStr: string) => formatDate(dateStr);
const formatDateTimeBr = (dateStr: string) => formatDateTime(dateStr);

const ReportManager: React.FC<ReportManagerProps> = ({ trips = [], routes = [], companies = [], users = [], currentUser, onDeleteTrip }) => {
  const [activeTab, setActiveTab] = useState<'revenue' | 'daily-logs' | 'maintenance' | 'schedules'>('revenue');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [tripSales, setTripSales] = useState<TicketSale[]>([]);
  const [tripIssues, setTripIssues] = useState<IssueReport[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DriverLog[]>([]);
  const [maintenanceIssues, setMaintenanceIssues] = useState<IssueReport[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // New State for Detailed Download
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadPeriod, setDownloadPeriod] = useState({ start: '', end: '' });
  const [allTicketSales, setAllTicketSales] = useState<TicketSale[]>([]);
  const detailedReportRef = useRef<HTMLDivElement>(null);
  const dossierRef = useRef<HTMLDivElement>(null);

  // States and Refs for Current Active Tab Export to PDF
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const tabRevenueRef = useRef<HTMLDivElement>(null);
  const tabDailyLogsRef = useRef<HTMLDivElement>(null);
  const tabMaintenanceRef = useRef<HTMLDivElement>(null);
  const tabSchedulesRef = useRef<HTMLDivElement>(null);

  const getActiveRef = () => {
    switch (activeTab) {
      case 'revenue': return tabRevenueRef;
      case 'daily-logs': return tabDailyLogsRef;
      case 'maintenance': return tabMaintenanceRef;
      case 'schedules': return tabSchedulesRef;
      default: return null;
    }
  };

  const handleExportTabToPDF = async () => {
    const activeRef = getActiveRef();
    if (!activeRef || !activeRef.current) {
        alert("Nenhum conteúdo para exportar nessa aba.");
        return;
    }
    
    setIsExportingPDF(true);
    try {
        const element = activeRef.current;
        const isDark = document.documentElement.classList.contains('dark');
        
        const canvas = await html2canvas(element, {
            scale: 2, // High resolution crisp output
            useCORS: true,
            logging: false,
            backgroundColor: isDark ? '#18181b' : '#ffffff' // zinc-900 or white
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        // Define orientations: landscape for schedules (usually wide), portrait for tables (tall lists)
        const landscape = canvas.width > canvas.height;
        const pdf = new jsPDF({
            orientation: landscape ? 'landscape' : 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const margin = 10; // 10mm margins
        const contentWidth = pdfWidth - (margin * 2);
        const contentHeight = (canvas.height * contentWidth) / canvas.width;
        
        let heightLeft = contentHeight;
        let position = margin;
        
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
        heightLeft -= (pdfHeight - margin * 2);
        
        while (heightLeft > 0) {
            position = heightLeft - contentHeight + margin;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
            heightLeft -= (pdfHeight - margin * 2);
        }
        
        const tabLabels: Record<string, string> = {
            'revenue': 'Receita_e_Faturamento',
            'daily-logs': 'Diario_de_Bordo',
            'maintenance': 'Ocorrencias_e_Manutencao',
            'schedules': 'Quadro_de_Horarios'
        };
        const activeLabel = tabLabels[activeTab] || activeTab;
        
        pdf.save(`relatorio_${activeLabel}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
        console.error("Erro ao exportar PDF:", e);
        alert("Houve um erro técnico ao gerar o arquivo PDF.");
    } finally {
        setIsExportingPDF(false);
    }
  };

  useEffect(() => {
    const handleCloseAll = () => {
      setSelectedTrip(null);
      setIsDownloadModalOpen(false);
    };
    window.addEventListener('close-all-modals', handleCloseAll);
    return () => window.removeEventListener('close-all-modals', handleCloseAll);
  }, []);

  const isFiscal = currentUser?.role === 'FISCAL';

  useEffect(() => {
    if (activeTab === 'daily-logs') {
        loadDailyLogs();
    } else if (activeTab === 'maintenance') {
        loadMaintenanceIssues();
    } else if (activeTab === 'revenue') {
        loadAllSales();
    }
  }, [activeTab]);

  const loadAllSales = async () => {
      try {
          const sales = await db.getSales();
          setAllTicketSales(sales);
      } catch (e) {
          console.error(e);
      }
  };

  useEffect(() => {
    if (selectedTrip) {
      loadTripDetails(selectedTrip.id);
    } else {
      setTripSales([]);
      setTripIssues([]);
    }
  }, [selectedTrip]);

  const loadDailyLogs = async () => {
      setIsLoadingDetails(true);
      try {
          const logs = await db.fetchAll<DriverLog>('driver_logs');
          setDailyLogs(logs);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoadingDetails(false);
      }
  };

  const loadMaintenanceIssues = async () => {
      setIsLoadingDetails(true);
      try {
          const issues = await db.fetchAll<IssueReport>('occurrences');
          setMaintenanceIssues(issues);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoadingDetails(false);
      }
  };

  const loadTripDetails = async (tripId: string) => {
    setIsLoadingDetails(true);
    try {
      const [sales, issues] = await Promise.all([
        db.getSales(),
        db.getReports()
      ]);
      setTripSales(sales.filter(s => s.trip_id === tripId));
      setTripIssues(issues.filter(i => i.trip_id === tripId));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const calculateRevenue = (trip: Trip) => {
    const route = routes.find(r => r.id === trip.route_id);
    if (!route) return { total: 0 };
    let total = 0;
    Object.entries(trip.passengers || {}).forEach(([sec, p]) => {
        const pd = p as PassengerDetails;
        const fare = sec === 'default' ? route.price : (route.sections?.find(s => s.name === sec)?.price || route.price);
        total += (pd.pagantes + pd.vale_transporte) * fare + (pd.imp_card * fare * 0.7);
    });
    return { total };
  };

  const filteredData = useMemo(() => {
      return trips.filter(t => {
          if (isFiscal && t.fiscal_id !== currentUser?.id) return false;
          const route = routes.find(r => r.id === t.route_id);
          const matchesDate = !filterDate || t.trip_date === filterDate;
          const matchesSearch = !searchTerm || 
            t.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            route?.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.bus_number.includes(searchTerm);
          
          return matchesDate && matchesSearch;
      }).sort((a,b) => a.trip_date.localeCompare(b.trip_date)); 
  }, [trips, routes, isFiscal, currentUser, searchTerm, filterDate]);

  const filteredLogs = useMemo(() => {
      return dailyLogs.filter(log => {
          const matchesDate = !filterDate || log.created_at.startsWith(filterDate);
          return matchesDate;
      }).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [dailyLogs, filterDate]);

  const filteredMaintenance = useMemo(() => {
      return maintenanceIssues.filter(issue => {
          const matchesDate = !filterDate || issue.timestamp.startsWith(filterDate);
          const matchesSearch = !searchTerm || issue.description.toLowerCase().includes(searchTerm.toLowerCase());
          return matchesDate && matchesSearch;
      }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [maintenanceIssues, filterDate, searchTerm]);

  const stats = useMemo(() => {
      let pax = 0; let rev = 0;
      filteredData.forEach(t => {
          rev += calculateRevenue(t).total;
          Object.values(t.passengers || {}).forEach(p => {
              const pd = p as PassengerDetails;
              pax += pd.pagantes + pd.vale_transporte + pd.imp_card + pd.gratuitos;
          });
      });
      return { pax, rev, trips: filteredData.length };
  }, [filteredData, routes]);

  const getPunctualityStatus = (trip: Trip) => {
    if (!trip.actual_start_time) return { label: 'Não Iniciada', color: 'text-slate-400' };
    
    const planned = trip.departure_time;
    const actual = trip.actual_start_time;
    
    if (actual < planned) return { label: 'Adiantado', color: 'text-blue-500' };
    if (actual === planned) return { label: 'No Horário', color: 'text-emerald-500' };
    return { label: 'Atrasado', color: 'text-red-500' };
  };

  const handleDownloadDossier = async () => {
    if (!selectedTrip || !dossierRef.current) return;
    setIsDownloading(true);
    
    const element = dossierRef.current;
    const fileName = `auditoria_viagem_${selectedTrip.id.slice(-6).toUpperCase()}.pdf`;

    const opt = {
      margin: 10,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, logging: false, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      if (typeof html2pdf !== 'undefined') {
        await html2pdf().set(opt).from(element).save();
      } else {
        alert("Biblioteca PDF não carregada.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDetailedDownload = async () => {
    if (!downloadPeriod.start || !downloadPeriod.end || !detailedReportRef.current) return;
    setIsDownloading(true);
    
    const opt = {
      margin: 5,
      filename: `relatorio_consolidado_${downloadPeriod.start}_a_${downloadPeriod.end}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, logging: false, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    try {
      if (typeof html2pdf !== 'undefined') {
        await html2pdf().set(opt).from(detailedReportRef.current).save();
        setIsDownloadModalOpen(false);
      } else {
        alert("Biblioteca PDF não carregada.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  // Data for Consolidated Report
  const consolidatedData = useMemo(() => {
      if (!downloadPeriod.start || !downloadPeriod.end) return null;
      
      const periodTrips = trips.filter(t => t.trip_date >= downloadPeriod.start && t.trip_date <= downloadPeriod.end);
      let totalRev = 0;
      let totalPax = 0;
      const dailyRevenue: Record<string, number> = {};
      const linePax: Record<string, number> = {};
      const timePax: Record<string, number> = {};
      const payments: Record<string, { total: number; count: number }> = {
          'DINHEIRO': { total: 0, count: 0 },
          'PIX': { total: 0, count: 0 },
          'CREDITO': { total: 0, count: 0 },
          'DEBITO': { total: 0, count: 0 },
          'IMPCARD': { total: 0, count: 0 },
          'VALE_TRANSPORTE': { total: 0, count: 0 },
      };

      periodTrips.forEach(t => {
          const rev = calculateRevenue(t).total;
          totalRev += rev;
          dailyRevenue[t.trip_date] = (dailyRevenue[t.trip_date] || 0) + rev;

          const route = routes.find(r => r.id === t.route_id);
          const lineName = route ? `${route.prefixo_linha} - ${route.destination}` : 'Desconhecida';
          
          let tripPax = 0;
          Object.values(t.passengers || {}).forEach(p => {
              const pd = p as PassengerDetails;
              const count = pd.pagantes + pd.vale_transporte + pd.imp_card + pd.gratuitos;
              tripPax += count;
              totalPax += count;
          });

          linePax[lineName] = (linePax[lineName] || 0) + tripPax;
          timePax[t.departure_time] = (timePax[t.departure_time] || 0) + tripPax;

          // Payments from allTicketSales for this trip or fallback to trip totals
          const sales = allTicketSales.filter(s => s.trip_id === t.id);
          if (sales.length > 0) {
            sales.forEach(s => {
                const normM = (s.payment_method || 'DINHEIRO').toUpperCase().replace(/[ ]/g, '_');
                if (!payments[normM]) {
                  payments[normM] = { total: 0, count: 0 };
                }
                payments[normM].total += s.total_price || 0;
                payments[normM].count += 1;
            });
          } else if (t.payment_breakdown && Object.keys(t.payment_breakdown).length > 0) {
            Object.entries(t.payment_breakdown).forEach(([method, amt]) => {
              const normM = method.toUpperCase().replace(/[ ]/g, '_');
              if (!payments[normM]) {
                payments[normM] = { total: 0, count: 0 };
              }
              payments[normM].total += Number(amt) || 0;
              payments[normM].count += (t.payment_counts?.[normM] || (Number(amt) > 0 ? 1 : 0));
            });
          } else {
            if (t.cash_total) {
              payments['DINHEIRO'].total += t.cash_total;
              payments['DINHEIRO'].count += 1;
            }
            if (t.card_pix_total) {
              if (!payments['DIGITAL_OUTROS']) payments['DIGITAL_OUTROS'] = { total: 0, count: 0 };
              payments['DIGITAL_OUTROS'].total += t.card_pix_total;
              payments['DIGITAL_OUTROS'].count += 1;
            }
          }
      });

      const today = new Date().toISOString().split('T')[0];
      const dailyRevVal = dailyRevenue[today] || 0;
      
      // Weekly Revenue (last 7 days of period)
      // For simplicity, just sum period as it's user defined
      
      return {
          totalRev,
          dailyRevVal,
          totalPax,
          dailyRevenue: Object.entries(dailyRevenue).map(([date, value]) => ({ date: formatDateBr(date), value })),
          linePax: Object.entries(linePax).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
          timePax: Object.entries(timePax).map(([time, value]) => ({ time, value })).sort((a,b) => a.time.localeCompare(b.time)),
          payments: Object.entries(payments).map(([name, data]) => ({ name, value: data.total, count: data.count }))
      };
  }, [trips, routes, allTicketSales, downloadPeriod]);

  return (
    <div className="space-y-6 animate-in fade-in transition-all">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 transition-colors gap-4">
        <div className="flex-1 w-full">
            <div className="flex justify-between items-center w-full">
                <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none">{isFiscal ? 'Meus Resultados' : 'Relatórios e Auditoria'}</h2>
                {!isFiscal && (
                    <button 
                        onClick={() => setIsDownloadModalOpen(true)}
                        className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-xl hover:bg-black active:scale-95 transition-all"
                    >
                        <Download size={16}/> Baixar Relatório Consolidado
                    </button>
                )}
            </div>

            
            <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('revenue')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'revenue' ? 'bg-yellow-400 text-slate-900 shadow-md' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
                    <DollarSign size={14}/> Receita
                </button>
                <button onClick={() => setActiveTab('daily-logs')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'daily-logs' ? 'bg-yellow-400 text-slate-900 shadow-md' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
                    <ClipboardList size={14}/> Diário de Bordo
                </button>
                <button onClick={() => setActiveTab('maintenance')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'maintenance' ? 'bg-yellow-400 text-slate-900 shadow-md' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
                    <Wrench size={14}/> Manutenção
                </button>
                <button onClick={() => setActiveTab('schedules')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'schedules' ? 'bg-yellow-400 text-slate-900 shadow-md' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
                    <LayoutGrid size={14}/> Quadro de Horários
                </button>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Filtrar..." 
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black uppercase outline-none dark:text-zinc-300 shadow-inner"
                        value={searchTerm || ''}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <Calendar className="absolute left-4 top-4 text-slate-400" size={18} />
                    <input 
                        type="date" 
                        className="pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black uppercase outline-none dark:text-zinc-300 shadow-inner"
                        value={filterDate || ''}
                        onChange={e => setFilterDate(e.target.value)}
                    />
                </div>
                <button
                    onClick={handleExportTabToPDF}
                    disabled={isExportingPDF}
                    className="px-6 py-4 bg-slate-900 dark:bg-yellow-400 hover:bg-slate-800 dark:hover:bg-yellow-500 text-yellow-400 dark:text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-xl hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-55 border-2 border-yellow-400 dark:border-slate-900"
                    title="Gerar PDF do relatório ativo"
                >
                    {isExportingPDF ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Gerando PDF...</span>
                        </>
                    ) : (
                        <>
                            <Download size={16} />
                            <span>Gerar PDF</span>
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>

      {activeTab === 'revenue' && (
          <div ref={tabRevenueRef} className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border dark:border-zinc-800 shadow-sm flex items-center justify-between h-full">
                        <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Viagens</p><h4 className="text-2xl font-black dark:text-white">{stats.trips}</h4></div>
                        <FileText className="text-blue-500 opacity-20" size={32}/>
                    </div>
                </div>
                <div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border dark:border-zinc-800 shadow-sm flex items-center justify-between h-full">
                        <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pax Transportado</p><h4 className="text-2xl font-black dark:text-white">{stats.pax}</h4></div>
                        <TrendingUp className="text-yellow-500 opacity-20" size={32}/>
                    </div>
                </div>
                <div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border dark:border-zinc-800 shadow-sm flex items-center justify-between h-full">
                        <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Faturamento Líquido</p><h4 className="text-2xl font-black text-emerald-600">R$ {stats.rev.toFixed(2)}</h4></div>
                        <DollarSign className="text-emerald-500 opacity-20" size={32}/>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden transition-colors">
                <table className="w-full text-left text-[10px]">
                    <thead className="bg-slate-50 dark:bg-zinc-800 font-black uppercase text-slate-400 dark:text-zinc-500">
                        <tr>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">VTR</th>
                            <th className="px-6 py-4">Linha</th>
                            <th className="px-6 py-4">Motorista</th>
                            <th className="px-6 py-4">Receita</th>
                            <th className="px-6 py-4 text-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-zinc-800 transition-colors">
                        {filteredData.map(t => {
                            const r = routes.find(ro => ro.id === t.route_id);
                            return (
                                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                    <td className="px-6 py-4 font-bold dark:text-zinc-300">{formatDateBr(t.trip_date)}</td>
                                    <td className="px-6 py-4 dark:text-zinc-300 font-black">#{t.bus_number}</td>
                                    <td className="px-6 py-4 dark:text-zinc-300 font-bold uppercase">{r?.prefixo_linha} - {r?.destination}</td>
                                    <td className="px-6 py-4 dark:text-zinc-300 font-bold uppercase">{t.driver_name}</td>
                                    <td className="px-6 py-4 text-emerald-600 font-black">R$ {calculateRevenue(t).total.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => setSelectedTrip(t)} className="px-4 py-2 bg-slate-900 dark:bg-zinc-800 text-white rounded-xl font-black uppercase text-[8px] hover:scale-105 active:scale-95 transition-all">Ver Detalhes</button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
          </div>
      )}

      {activeTab === 'daily-logs' && (
          <div ref={tabDailyLogsRef} className="bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden transition-colors animate-in fade-in">
              <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-50 dark:bg-zinc-800 font-black uppercase text-slate-400 dark:text-zinc-500">
                      <tr>
                          <th className="px-6 py-4">Data/Hora</th>
                          <th className="px-6 py-4">Motorista</th>
                          <th className="px-6 py-4">Veículo</th>
                          <th className="px-6 py-4">KM Inicial</th>
                          <th className="px-6 py-4">KM Final</th>
                          <th className="px-6 py-4">Combustível</th>
                          <th className="px-6 py-4">Avarias</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-zinc-800 transition-colors">
                      {filteredLogs.map(log => {
                          const driver = users.find(u => u.id === log.driver_id)?.name || 'Desconhecido';
                          // Vehicle info might need to be fetched or passed in props if not available in 'routes_logs' directly (it has vehicle_id)
                          // Assuming we can match vehicle_id to vehicles prop if available, but ReportManager doesn't have vehicles prop.
                          // I'll just show ID or if I can pass vehicles prop. ReportManagerProps doesn't have vehicles.
                          // I'll assume vehicle_id is what we have.
                          return (
                              <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                  <td className="px-6 py-4 font-bold dark:text-zinc-300">{formatDateTimeBr(log.created_at)}</td>
                                  <td className="px-6 py-4 dark:text-zinc-300 font-bold uppercase">{driver}</td>
                                  <td className="px-6 py-4 dark:text-zinc-300 font-black">VTR-{log.vehicle_id.slice(0,4)}</td>
                                  <td className="px-6 py-4 dark:text-zinc-300">{log.odometer_start}</td>
                                  <td className="px-6 py-4 dark:text-zinc-300">{log.odometer_end || '-'}</td>
                                  <td className="px-6 py-4 dark:text-zinc-300">{log.fuel_level_start}</td>
                                  <td className="px-6 py-4">
                                      {log.damage_details ? (
                                          <span className="text-red-500 font-black flex items-center gap-1"><AlertTriangle size={12}/> SIM</span>
                                      ) : (
                                          <span className="text-emerald-500 font-black flex items-center gap-1"><CheckCircle2 size={12}/> NÃO</span>
                                      )}
                                  </td>
                              </tr>
                          )
                      })}
                      {filteredLogs.length === 0 && (
                          <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400 font-black uppercase italic">Nenhum registro encontrado</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      )}

      {activeTab === 'maintenance' && (
          <div ref={tabMaintenanceRef} className="bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden transition-colors animate-in fade-in">
              <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-50 dark:bg-zinc-800 font-black uppercase text-slate-400 dark:text-zinc-500">
                      <tr>
                          <th className="px-6 py-4">Data/Hora</th>
                          <th className="px-6 py-4">Tipo</th>
                          <th className="px-6 py-4">Descrição</th>
                          <th className="px-6 py-4">Severidade</th>
                          <th className="px-6 py-4">Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-zinc-800 transition-colors">
                      {filteredMaintenance.map(issue => (
                          <tr key={issue.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                              <td className="px-6 py-4 font-bold dark:text-zinc-300">{formatDateTimeBr(issue.timestamp)}</td>
                              <td className="px-6 py-4 dark:text-zinc-300 font-bold uppercase">{issue.type}</td>
                              <td className="px-6 py-4 dark:text-zinc-300 italic">"{issue.description}"</td>
                              <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${issue.severity === 'ALTA' ? 'bg-red-100 text-red-600' : issue.severity === 'MEDIA' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>{issue.severity}</span>
                              </td>
                              <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${issue.status === 'Concluído' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>{issue.status}</span>
                              </td>
                          </tr>
                      ))}
                      {filteredMaintenance.length === 0 && (
                          <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-black uppercase italic">Nenhuma ocorrência encontrada</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      )}

      {activeTab === 'schedules' && (
          <div ref={tabSchedulesRef} className="space-y-8 animate-in fade-in">
             <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border dark:border-zinc-800 shadow-sm transition-colors">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 ml-2">Selecione o Itinerário para Gerar o Poster</label>
                <select 
                  className="w-full max-w-md px-6 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-2xl font-black text-xs transition-all dark:text-white"
                  value={selectedRouteId}
                  onChange={e => setSelectedRouteId(e.target.value)}
                >
                  <option value="">Selecione uma linha...</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.prefixo_linha} - {r.origin} / {r.destination}</option>
                  ))}
                </select>
             </div>

             {selectedRouteId ? (
               <SchedulePoster 
                 route={routes.find(r => r.id === selectedRouteId)!} 
                 trips={trips.filter(t => t.route_id === selectedRouteId)} 
               />
             ) : (
               <div className="p-20 text-center bg-slate-50 dark:bg-zinc-900/50 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-zinc-800 transition-colors">
                 <LayoutGrid className="mx-auto text-slate-200 dark:text-zinc-800 mb-6" size={80} />
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                   Selecione uma linha acima para visualizar o quadro de horários<br/>no padrão oficial de terminal rodoviário.
                 </p>
               </div>
             )}
          </div>
      )}

      {selectedTrip && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] border-4 border-yellow-400 overflow-hidden relative transition-colors">
            <button onClick={() => setSelectedTrip(null)} className="absolute top-6 right-6 text-slate-400 hover:text-red-500 z-10 transition-colors"><X size={32}/></button>
            
            <div ref={dossierRef} className="flex-1 flex flex-col bg-white overflow-y-auto custom-scrollbar">
                <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 transition-colors">
                   <div className="flex items-center gap-4 mb-2">
                      <div className="p-3 bg-yellow-400 rounded-2xl text-slate-900 transition-colors"><Bus size={24}/></div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic leading-none transition-colors">Dossiê de Viagem</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Viagem ID: {selectedTrip.id.slice(-8).toUpperCase()} • {formatDateBr(selectedTrip.trip_date)}</p>
                      </div>
                   </div>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-zinc-950 transition-colors">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 dark:bg-zinc-900 p-5 rounded-2xl border dark:border-zinc-800 transition-colors">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Programado</p>
                            <div className="flex items-center gap-2 text-lg font-black dark:text-white transition-colors"><Clock size={16} className="text-yellow-500"/> {selectedTrip.departure_time}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-zinc-900 p-5 rounded-2xl border dark:border-zinc-800 transition-colors">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Início Real</p>
                            <div className="flex items-center gap-2 text-lg font-black dark:text-white transition-colors"><History size={16} className="text-indigo-500"/> {selectedTrip.actual_start_time || '--:--'}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-zinc-900 p-5 rounded-2xl border dark:border-zinc-800 transition-colors">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Pontualidade</p>
                            <div className={`flex items-center gap-2 text-sm font-black transition-colors ${getPunctualityStatus(selectedTrip).color}`}>{getPunctualityStatus(selectedTrip).label}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-zinc-900 p-5 rounded-2xl border dark:border-zinc-800 transition-colors">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Fim da Rota</p>
                            <div className="flex items-center gap-2 text-lg font-black dark:text-white transition-colors"><CheckCircle2 size={16} className="text-emerald-500"/> {selectedTrip.actual_end_time || 'Em trânsito'}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Users size={14}/> Passageiros por Seção</h4>
                            <div className="space-y-2">
                                {Object.entries(selectedTrip.passengers || {}).map(([sec, data]) => (
                                    <div key={sec} className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 flex justify-between items-center transition-colors">
                                        <span className="text-[10px] font-black uppercase text-slate-500 transition-colors">{sec === 'default' ? 'Trecho Principal' : sec}</span>
                                        <div className="flex gap-3">
                                            <div className="text-center"><p className="text-[8px] text-slate-400 font-bold uppercase">Pagantes</p><p className="text-sm font-black dark:text-white transition-colors">{(data as PassengerDetails).pagantes}</p></div>
                                            <div className="text-center"><p className="text-[8px] text-slate-400 font-bold uppercase">VT</p><p className="text-sm font-black dark:text-white transition-colors">{(data as PassengerDetails).vale_transporte}</p></div>
                                            <div className="text-center"><p className="text-[8px] text-slate-400 font-bold uppercase">Grat.</p><p className="text-sm font-black dark:text-white transition-colors">{(data as PassengerDetails).gratuitos}</p></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Wallet size={14}/> Receita por Meio de Pagamento</h4>
                            <div className="space-y-2">
                                {Array.from(new Set([
                                    'DINHEIRO', 'PIX', 'CREDITO', 'DEBITO', 'IMPCARD', 'VALE_TRANSPORTE',
                                    ...tripSales.map(s => (s.payment_method || '').toUpperCase().replace(/[ ]/g, '_')),
                                    ...Object.keys(selectedTrip.payment_breakdown || {}).map(m => m.toUpperCase().replace(/[ ]/g, '_'))
                                ])).filter(Boolean).map(method => {
                                    const salesForMethod = tripSales.filter(s => (s.payment_method || '').toUpperCase().replace(/[ ]/g, '_') === method);
                                    let total = salesForMethod.reduce((acc, s) => acc + (s.total_price || 0), 0);
                                    let count = salesForMethod.length;

                                    if (count === 0 && selectedTrip.payment_breakdown && selectedTrip.payment_breakdown[method] !== undefined) {
                                        total = selectedTrip.payment_breakdown[method] || 0;
                                        count = selectedTrip.payment_counts?.[method] || (total > 0 ? 1 : 0);
                                    } else if (count === 0 && tripSales.length === 0) {
                                        if (method === 'DINHEIRO' && selectedTrip.cash_total) {
                                            total = selectedTrip.cash_total;
                                            count = 1;
                                        } else if (method === 'PIX' && selectedTrip.card_pix_total && !selectedTrip.payment_breakdown) {
                                            total = selectedTrip.card_pix_total;
                                            count = 1;
                                        }
                                    }

                                    return (
                                        <div key={method} className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 flex justify-between items-center transition-colors">
                                            <span className="text-[10px] font-black uppercase text-slate-500 transition-colors">{method.replace(/_/g, ' ')}</span>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-emerald-600 transition-colors">R$ {total.toFixed(2)}</p>
                                                <p className="text-[8px] text-slate-400 font-bold uppercase transition-colors">{count} Bilhetes</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t dark:border-zinc-800">
                        <h4 className="text-[10px] font-black text-red-500 uppercase mb-4 flex items-center gap-2"><ShieldAlert size={14}/> Ocorrências Registradas</h4>
                        {isLoadingDetails ? (
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black animate-pulse"><Loader2 size={12} className="animate-spin"/> Cruzando dados...</div>
                        ) : tripIssues.length === 0 ? (
                            <div className="p-6 text-center bg-emerald-50 dark:bg-emerald-900/10 border-2 border-dashed border-emerald-200 dark:border-emerald-900/30 rounded-3xl transition-colors">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"><CheckCircle2 size={16}/> Operação Segura: Sem intercorrências</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {tripIssues.map(issue => (
                                    <div key={issue.id} className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl flex justify-between items-start transition-colors">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-2 py-0.5 bg-red-500 text-white rounded text-[8px] font-black">{(issue as any).category}</span>
                                                <span className="text-[10px] font-black text-slate-700 dark:text-red-200 uppercase transition-colors">{issue.type}</span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 leading-tight italic transition-colors">"{issue.description}"</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full transition-colors ${issue.status === 'Concluído' ? 'bg-emerald-500 text-white' : 'bg-yellow-400 text-slate-900'}`}>{issue.status}</span>
                                            <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase transition-colors">{new Date(issue.timestamp).toLocaleTimeString('pt-BR')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-8 border-t dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest transition-colors">Receita Total da Viagem</p>
                    <p className="text-3xl font-black text-emerald-600 italic leading-none transition-colors">R$ {calculateRevenue(selectedTrip).total.toFixed(2)}</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={async () => { if(confirm('Excluir este relatório permanentemente?')) { await onDeleteTrip(selectedTrip.id); setSelectedTrip(null); } }} className="px-6 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">Excluir Registro</button>
                    <button 
                      disabled={isDownloading}
                      onClick={handleDownloadDossier} 
                      className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-xl hover:bg-black active:scale-95 transition-all transition-colors"
                    >
                        {isDownloading ? <Loader2 className="animate-spin" size={18}/> : <Download size={18}/>}
                        Baixar Auditoria
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[3rem] shadow-2xl border dark:border-zinc-800 overflow-hidden">
                <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic">Baixar Relatório</h3>
                    <button onClick={() => setIsDownloadModalOpen(false)} className="text-slate-400 hover:rotate-90 transition-transform"><X size={32}/></button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Data Inicial</label>
                            <input 
                                type="date" 
                                className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" 
                                value={downloadPeriod.start || ''} 
                                onChange={e => setDownloadPeriod({...downloadPeriod, start: e.target.value})} 
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Data Final</label>
                            <input 
                                type="date" 
                                className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" 
                                value={downloadPeriod.end || ''} 
                                onChange={e => setDownloadPeriod({...downloadPeriod, end: e.target.value})} 
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleDetailedDownload}
                        disabled={!downloadPeriod.start || !downloadPeriod.end || isDownloading}
                        className="w-full py-5 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isDownloading ? <Loader2 className="animate-spin"/> : <Download size={20}/>}
                        Gerar e Baixar PDF
                    </button>
                    
                    {/* Hidden Container for PDF Generation */}
                    <div className="hidden">
                        <div ref={detailedReportRef} className="p-10 bg-white text-slate-900 space-y-10" style={{ width: '297mm' }}>
                            <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8">
                                <div>
                                    <h1 className="text-4xl font-black uppercase italic mb-2 tracking-tighter">Relatório de Desempenho Operacional</h1>
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">Período: {formatDateBr(downloadPeriod.start)} a {formatDateBr(downloadPeriod.end)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black uppercase text-slate-400">Emissão</p>
                                    <p className="text-sm font-bold">{new Date().toLocaleString('pt-BR')}</p>
                                </div>
                            </div>

                            {consolidatedData && (
                                <>
                                    <div className="grid grid-cols-4 gap-6">
                                        <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Receita Total</p>
                                            <p className="text-3xl font-black text-emerald-600">R$ {consolidatedData.totalRev.toFixed(2)}</p>
                                        </div>
                                        <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Receita Diária (Média)</p>
                                            <p className="text-3xl font-black text-slate-900">R$ {(consolidatedData.totalRev / (consolidatedData.dailyRevenue.length || 1)).toFixed(2)}</p>
                                        </div>
                                        <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Pax Transportado</p>
                                            <p className="text-3xl font-black text-slate-900">{consolidatedData.totalPax}</p>
                                        </div>
                                        <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Pax Média/Viagem</p>
                                            <p className="text-3xl font-black text-slate-900">{(consolidatedData.totalPax / (trips.filter(t => t.trip_date >= downloadPeriod.start && t.trip_date <= downloadPeriod.end).length || 1)).toFixed(1)}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-10">
                                        <div className="space-y-4">
                                            <h3 className="text-md font-black uppercase italic border-l-4 border-yellow-400 pl-4">Fluxo de Receita Diário</h3>
                                            <div className="h-[300px] w-full min-w-0 min-h-[300px]">
                                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                    <BarChart data={consolidatedData.dailyRevenue}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis dataKey="date" fontSize={10} fontStyle="bold" />
                                                        <YAxis fontSize={10} fontStyle="bold" />
                                                        <Tooltip />
                                                        <Bar dataKey="value" fill="#FACC15" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <h3 className="text-md font-black uppercase italic border-l-4 border-emerald-400 pl-4">Distribuição de Meios de Pagamento</h3>
                                            <div className="h-[300px] w-full min-w-0 min-h-[300px]">
                                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                    <PieChart>
                                                        <Pie
                                                            data={consolidatedData.payments.filter(p => p.value > 0)}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={60}
                                                            outerRadius={100}
                                                            paddingAngle={5}
                                                            dataKey="value"
                                                        >
                                                            {consolidatedData.payments.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                                                        <Legend verticalAlign="bottom" height={36}/>
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-md font-black uppercase italic border-l-4 border-blue-400 pl-4">Demanda por Linha (Itinerário)</h3>
                                        <div className="h-[300px] w-full min-w-0 min-h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                <BarChart layout="vertical" data={consolidatedData.linePax.slice(0, 10)}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                    <XAxis type="number" fontSize={10} />
                                                    <YAxis dataKey="name" type="category" fontSize={8} width={150} />
                                                    <Tooltip />
                                                    <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-md font-black uppercase italic border-l-4 border-indigo-400 pl-4">Picos de Horário (Total Pax)</h3>
                                        <div className="h-[300px] w-full min-w-0 min-h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                <BarChart data={consolidatedData.timePax}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="time" fontSize={10} />
                                                    <YAxis fontSize={10} />
                                                    <Tooltip />
                                                    <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="pt-10 border-t-2 border-slate-100 text-center">
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Viação Nicolau S/A • Versão v2.0 • Relatório de Auditoria Consolidada</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ReportManager;
