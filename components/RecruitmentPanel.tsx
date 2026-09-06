
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  ChevronRight, 
  X, 
  Briefcase, 
  MapPin, 
  Calendar, 
  Truck, 
  CheckCircle2, 
  Clock,
  User as UserIcon,
  Phone,
  Mail,
  FileText,
  Loader2,
  Bell,
  Plus,
  Trash2,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CommonLoader } from './CommonLoader';
import { JobApplication, JobVacancy, Company, User } from '../types';
import { supabase, db } from '../services/database';
import { formatDate } from '../utils/dateFormatter';

interface RecruitmentPanelProps {
  addToast: (message: string, type: 'success' | 'error' | 'warning') => void;
  initialApplicationId?: string;
  onImportToCollaborators?: (userData: Partial<User>) => void;
  currentUser: User | null;
}

const RecruitmentPanel: React.FC<RecruitmentPanelProps> = ({ addToast, initialApplicationId, onImportToCollaborators, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'applications' | 'vacancies'>('applications');
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [vacancies, setVacancies] = useState<JobVacancy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<string>('Todos');
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showVacancyModal, setShowVacancyModal] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<JobVacancy | null>(null);
  const [isSavingVacancy, setIsSavingVacancy] = useState(false);

  // Vacancy Form State
  const [vacancyForm, setVacancyForm] = useState<Partial<JobVacancy>>({
    job_title: '',
    company_name: '',
    requirements: '',
    activities: '',
    benefits: '',
    contact_info: '',
    is_active: true
  });

  useEffect(() => {
    fetchApplications();
    fetchVacancies();
    fetchCompanies();
    
    // Subscribe to real-time changes
    const appChannel = supabase
      .channel('job-applications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, () => {
        fetchApplications();
      })
      .on('broadcast', { event: 'new-application' }, () => {
        fetchApplications();
      })
      .subscribe();

    const vacancyChannel = supabase
      .channel('job-vacancies-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_vacancies' }, () => {
        fetchVacancies();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(appChannel);
      supabase.removeChannel(vacancyChannel);
    };
  }, []);

  useEffect(() => {
    if (initialApplicationId && applications.length > 0) {
      const app = applications.find(a => a.id === initialApplicationId);
      if (app) {
        setSelectedApp(app);
        setActiveTab('applications');
      }
    }
  }, [initialApplicationId, applications]);

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const data = await db.getJobApplications();
      const sortedData = (data || []).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setApplications(sortedData);
    } catch (error: any) {
      console.error('Error fetching applications:', error);
      addToast('Erro ao carregar candidaturas: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVacancies = async () => {
    try {
      const data = await db.getJobVacancies();
      setVacancies(data || []);
    } catch (error: any) {
      console.error('Error fetching vacancies:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const data = await db.getCompanies();
      setCompanies(data || []);
    } catch (error: any) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleSaveVacancy = async () => {
    if (!vacancyForm.job_title) {
      addToast('Nome do cargo é obrigatório', 'error');
      return;
    }

    setIsSavingVacancy(true);
    try {
      if (editingVacancy) {
        await db.update('job_vacancies', { ...editingVacancy, ...vacancyForm } as JobVacancy);
        addToast('Vaga atualizada com sucesso!', 'success');
      } else {
        await db.create('job_vacancies', {
          ...vacancyForm,
          created_at: new Date().toISOString()
        });
        addToast('Vaga cadastrada com sucesso!', 'success');
      }
      setShowVacancyModal(false);
      setEditingVacancy(null);
      setVacancyForm({
        job_title: '',
        company_name: '',
        requirements: '',
        activities: '',
        benefits: '',
        contact_info: '',
        is_active: true
      });
    } catch (error: any) {
      addToast('Erro ao salvar vaga: ' + error.message, 'error');
    } finally {
      setIsSavingVacancy(false);
    }
  };

  const handleDeleteVacancy = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta vaga?')) return;
    try {
      await db.delete('job_vacancies', id);
      addToast('Vaga excluída com sucesso!', 'success');
      await fetchVacancies();
    } catch (error: any) {
      addToast('Erro ao excluir vaga', 'error');
    }
  };

  const handleDeleteApplication = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta candidatura?')) return;
    try {
      await db.delete('job_applications', id);
      addToast('Candidatura excluída com sucesso!', 'success');
      if (selectedApp?.id === id) {
        setSelectedApp(null);
      }
      await fetchApplications();
    } catch (error: any) {
      addToast('Erro ao excluir candidatura', 'error');
    }
  };

  const handleImportToCollaborators = async () => {
    if (!selectedApp || !onImportToCollaborators) return;
    
    const userData: Partial<User> = {
      full_name: selectedApp.full_name,
      name: selectedApp.full_name.split(' ')[0],
      email: selectedApp.email,
      phone: selectedApp.phone,
      cpf: selectedApp.cpf,
      birth_date: selectedApp.birth_date,
      address_street: selectedApp.address_street,
      address_number: selectedApp.address_number,
      address_neighborhood: selectedApp.address_neighborhood,
      address_city: selectedApp.address_city,
      address_state: selectedApp.address_state,
      cep: selectedApp.address_cep,
      address_complement: selectedApp.address_complement,
      role: selectedApp.desired_position === 'Motorista' ? 'DRIVER' : 'PASSENGER',
      photo_url: selectedApp.photo_url,
      admission_date: new Date().toISOString()
    };

    onImportToCollaborators(userData);
  };

  const handleUpdateStatus = async (id: string, newStatus: JobApplication['status']) => {
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      setApplications(prev => prev.map(app => app.id === id ? { ...app, status: newStatus } : app));
      if (selectedApp?.id === id) {
        setSelectedApp(prev => prev ? { ...prev, status: newStatus } : null);
      }
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      addToast(`Status atualizado para ${newStatus}`, 'success');
    } catch (error: any) {
      console.error('Error updating status:', error);
      addToast('Erro ao atualizar status: ' + error.message, 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const fullName = app.full_name || '';
      const desiredPosition = app.desired_position || '';
      const city = app.address_city || '';

      const matchesSearch = 
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        desiredPosition.toLowerCase().includes(searchTerm.toLowerCase()) ||
        city.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = 
        filter === 'Todos' || desiredPosition === filter;

      return matchesSearch && matchesFilter;
    });
  }, [applications, searchTerm, filter]);

  const filterOptions = useMemo(() => {
    const options = new Set<string>();
    options.add('Todos');
    vacancies.forEach(v => options.add(v.job_title));
    // Also add positions from existing applications in case vacancies were deleted
    applications.forEach(app => options.add(app.desired_position));
    return Array.from(options);
  }, [vacancies, applications]);

  const getStatusColor = (status: JobApplication['status']) => {
    switch (status) {
      case 'Triagem': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Entrevista': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Aprovado': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Reprovado': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 transition-colors">
        <div className="flex items-center gap-6">
          <div className="w-[65px] h-[65px] bg-yellow-400 rounded-2xl flex items-center justify-center shadow-xl border-2 border-slate-900">
            <Briefcase className="text-slate-900" size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none">Recrutamento</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 border-l-2 border-yellow-400 pl-4">Gestão de Talentos e Candidaturas</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 dark:bg-zinc-950 p-1.5 rounded-2xl border-2 border-slate-200 dark:border-zinc-800">
            <button 
              onClick={() => setActiveTab('applications')}
              className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'applications' ? 'bg-yellow-400 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Cadastros
            </button>
            <button 
              onClick={() => setActiveTab('vacancies')}
              className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'vacancies' ? 'bg-yellow-400 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Vagas
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar candidatos..." 
              className="pl-12 pr-6 py-4 bg-slate-50 dark:bg-zinc-950 border-2 border-transparent focus:border-yellow-400 rounded-2xl outline-none text-[10px] font-black tracking-widest transition-all w-64"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'applications' ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            {filterOptions.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${
                  filter === f 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-105' 
                    : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-100 dark:border-zinc-800 hover:border-yellow-400'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-zinc-950/50 border-b dark:border-zinc-800">
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidato</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo Desejado</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cidade</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Envio</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-14 text-center">
                        <CommonLoader variant="bus-radar" message="Sincronizando talentos e candidaturas..." />
                      </td>
                    </tr>
                  ) : filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum candidato encontrado.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((app) => (
                      <tr 
                        key={app.id} 
                        onClick={() => setSelectedApp(app)}
                        className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-all cursor-pointer group"
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 group-hover:bg-yellow-400 group-hover:text-slate-900 transition-colors">
                              <UserIcon size={20} />
                            </div>
                            <span className="text-xs font-black text-slate-800 dark:text-zinc-100 uppercase">{app.full_name}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase">{app.desired_position}</span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                            <MapPin size={14} />
                            <span className="text-[10px] font-black uppercase">{app.address_city}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                            <Calendar size={14} />
                            <span className="text-[10px] font-black uppercase">{formatDate(app.created_at)}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${getStatusColor(app.status)}`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <ChevronRight className="text-slate-300 group-hover:text-yellow-500 transition-colors inline-block" size={20} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-800 dark:text-zinc-100 uppercase italic">Vagas Disponíveis</h3>
            <button 
              onClick={() => {
                setEditingVacancy(null);
                setVacancyForm({
                  job_title: '',
                  company_name: '',
                  requirements: '',
                  activities: '',
                  benefits: '',
                  contact_info: '',
                  is_active: true
                });
                setShowVacancyModal(true);
              }}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={20} /> Nova Vaga
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vacancies.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white dark:bg-zinc-900 rounded-[3rem] border border-slate-100 dark:border-zinc-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma vaga cadastrada.</p>
              </div>
            ) : (
              vacancies.map(vacancy => (
                <div key={vacancy.id} className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm space-y-6 group hover:border-yellow-400 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-lg border-2 border-slate-900">
                      <Briefcase className="text-slate-900" size={24} />
                    </div>
                    <div className="flex gap-2 items-center">
                      <button 
                        onClick={() => {
                          setEditingVacancy(vacancy);
                          setVacancyForm(vacancy);
                          setShowVacancyModal(true);
                        }}
                        className="p-2 bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-blue-500 rounded-xl transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteVacancy(vacancy.id)}
                        className="p-2 bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-red-500 rounded-xl transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-tight">{vacancy.job_title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black bg-yellow-400 text-slate-900 px-2 py-0.5 rounded uppercase">{vacancy.company_name || 'Empresa não informada'}</span>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cadastrada em {formatDate(vacancy.created_at)}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Requisitos</p>
                      <p className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 line-clamp-2">{vacancy.requirements}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Benefícios</p>
                      <p className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 line-clamp-2">{vacancy.benefits}</p>
                    </div>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border inline-block ${vacancy.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {vacancy.is_active ? 'Ativa' : 'Inativa'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Vacancy Modal */}
      <AnimatePresence>
        {showVacancyModal && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border-2 border-slate-100 dark:border-zinc-800 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-yellow-400 text-slate-900">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">{editingVacancy ? 'Editar Vaga' : 'Nova Vaga'}</h3>
                <button onClick={() => setShowVacancyModal(false)} className="p-2 bg-slate-900 text-white rounded-xl"><X size={20}/></button>
              </div>

              <div className="p-10 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nome do Cargo</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Motorista Urbano"
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black outline-none focus:ring-2 ring-yellow-400"
                      value={vacancyForm.job_title}
                      onChange={e => setVacancyForm({...vacancyForm, job_title: e.target.value})}
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Empresa Contratante</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black outline-none focus:ring-2 ring-yellow-400 appearance-none"
                      value={vacancyForm.company_name}
                      onChange={e => setVacancyForm({...vacancyForm, company_name: e.target.value})}
                    >
                      <option value="">Selecione a Empresa</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Requisitos</label>
                  <textarea 
                    placeholder="Descreva os requisitos necessários..."
                    rows={3}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black outline-none focus:ring-2 ring-yellow-400 resize-none"
                    value={vacancyForm.requirements || ''}
                    onChange={e => setVacancyForm({...vacancyForm, requirements: e.target.value})}
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Atividades</label>
                  <textarea 
                    placeholder="Descreva as principais atividades..."
                    rows={3}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black outline-none focus:ring-2 ring-yellow-400 resize-none"
                    value={vacancyForm.activities || ''}
                    onChange={e => setVacancyForm({...vacancyForm, activities: e.target.value})}
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Benefícios</label>
                  <textarea 
                    placeholder="Ex: VR, VA, Plano de Saúde..."
                    rows={3}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black outline-none focus:ring-2 ring-yellow-400 resize-none"
                    value={vacancyForm.benefits || ''}
                    onChange={e => setVacancyForm({...vacancyForm, benefits: e.target.value})}
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Contate-nos</label>
                  <input 
                    type="text" 
                    placeholder="E-mail ou Telefone para contato"
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black outline-none focus:ring-2 ring-yellow-400"
                    value={vacancyForm.contact_info}
                    onChange={e => setVacancyForm({...vacancyForm, contact_info: e.target.value})}
                  />
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl">
                  <input 
                    type="checkbox" 
                    id="is_active"
                    className="w-5 h-5 rounded border-slate-300 text-yellow-500 focus:ring-yellow-400"
                    checked={vacancyForm.is_active}
                    onChange={e => setVacancyForm({...vacancyForm, is_active: e.target.checked})}
                  />
                  <label htmlFor="is_active" className="text-[10px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-widest cursor-pointer">Vaga Ativa</label>
                </div>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex gap-4">
                <button 
                  onClick={() => setShowVacancyModal(false)}
                  className="flex-1 py-4 bg-white dark:bg-zinc-900 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 border-slate-100 dark:border-zinc-800 hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveVacancy}
                  disabled={isSavingVacancy}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl border-2 border-slate-800 flex items-center justify-center gap-3 hover:bg-black active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSavingVacancy ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  {editingVacancy ? 'Atualizar Vaga' : 'Cadastrar Vaga'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Drawer */}
      <AnimatePresence>
        {selectedApp && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedApp(null)}
              className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[100] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-zinc-950 z-[101] shadow-2xl border-l border-slate-100 dark:border-zinc-800 overflow-y-auto custom-scrollbar"
            >
              <div className="p-10 space-y-12">
                {/* Drawer Header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-6">
                    {selectedApp.photo_url ? (
                      <img 
                        src={selectedApp.photo_url} 
                        alt={selectedApp.full_name}
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-[1.5rem] object-cover shadow-lg border-2 border-slate-900"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-[1.5rem] bg-yellow-400 flex items-center justify-center shadow-lg border-2 border-slate-900">
                        <UserIcon className="text-slate-900" size={32} />
                      </div>
                    )}
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">{selectedApp.full_name}</h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${getStatusColor(selectedApp.status)}`}>
                          {selectedApp.status}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedApp.desired_position}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleDeleteApplication(selectedApp.id)}
                      title="Excluir Candidatura"
                      className="p-3 bg-red-50 dark:bg-red-950/40 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90"
                    >
                      <Trash2 size={20} />
                    </button>
                    <button 
                      onClick={() => setSelectedApp(null)}
                      className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-2xl text-slate-400 hover:text-red-500 transition-all active:scale-90"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>

                {/* Status Management */}
                <div className="bg-slate-50 dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Clock size={14} /> Alterar Status do Candidato
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(['Triagem', 'Entrevista', 'Aprovado', 'Reprovado'] as const).map(s => (
                      <button
                        key={s}
                        disabled={isUpdatingStatus}
                        onClick={() => handleUpdateStatus(selectedApp.id, s)}
                        className={`px-4 py-3 rounded-xl font-black text-[9px] uppercase border-2 transition-all ${
                          selectedApp.status === s 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                            : 'bg-white dark:bg-zinc-950 text-slate-400 border-transparent hover:border-yellow-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {selectedApp.status === 'Aprovado' && (
                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-zinc-800">
                      <button
                        onClick={handleImportToCollaborators}
                        disabled={isUpdatingStatus}
                        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <Download size={20} />
                        Importar para Colaboradores
                      </button>
                    </div>
                  )}
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center gap-4 p-6 bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-100 dark:border-zinc-800">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                      <Mail size={20} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase">E-mail</p>
                      <p className="text-xs font-black text-slate-800 dark:text-zinc-100 lowercase">{selectedApp.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-6 bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-100 dark:border-zinc-800">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                      <Phone size={20} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase">Telefone</p>
                      <p className="text-xs font-black text-slate-800 dark:text-zinc-100">{selectedApp.phone}</p>
                    </div>
                  </div>
                </div>

                {/* Experience History */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-600">
                      <Briefcase size={18} />
                    </div>
                    <h4 className="text-sm font-black uppercase italic text-slate-800 dark:text-zinc-100">Histórico Profissional</h4>
                  </div>
                  
                  <div className="space-y-4">
                    {[1, 2, 3].map(num => {
                      const company = selectedApp[`exp${num}_company` as keyof JobApplication];
                      const role = selectedApp[`exp${num}_role` as keyof JobApplication];
                      const admission = selectedApp[`exp${num}_admission_date` as keyof JobApplication];
                      const resignation = selectedApp[`exp${num}_resignation_date` as keyof JobApplication];
                      const reason = selectedApp[`exp${num}_reason_for_leaving` as keyof JobApplication];
                      const salary = selectedApp[`exp${num}_last_salary` as keyof JobApplication];
                      const activities = selectedApp[`exp${num}_activities` as keyof JobApplication];

                      if (!company) return null;
                      return (
                        <div key={num} className="p-6 bg-slate-50 dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Empresa {num}</p>
                              <p className="text-xs font-black text-slate-800 dark:text-zinc-100 uppercase">{company as string}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Cargo</p>
                              <p className="text-[10px] font-black text-slate-600 dark:text-zinc-400 uppercase">{role as string}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Admissão</p>
                              <p className="text-[10px] font-black text-slate-600 dark:text-zinc-400 uppercase">{admission ? formatDate(admission as string) : '-'}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Demissão</p>
                              <p className="text-[10px] font-black text-slate-600 dark:text-zinc-400 uppercase">{resignation ? formatDate(resignation as string) : '-'}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Último Salário</p>
                              <p className="text-[10px] font-black text-slate-600 dark:text-zinc-400 uppercase">{salary as string || '-'}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Motivo da Saída</p>
                              <p className="text-[10px] font-black text-slate-600 dark:text-zinc-400 uppercase">{reason as string || '-'}</p>
                            </div>
                          </div>

                          {activities && (
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Atividades</p>
                              <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase leading-tight">{activities as string}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!selectedApp.exp1_company && (
                      <p className="text-[10px] font-black text-slate-400 uppercase italic">Nenhum histórico detalhado informado.</p>
                    )}
                  </div>
                </div>

                {/* Qualifications */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600">
                      <Truck size={18} />
                    </div>
                    <h4 className="text-sm font-black uppercase italic text-slate-800 dark:text-zinc-100">Qualificações de Transporte</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Categoria CNH</p>
                      {selectedApp.has_cnh ? (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 size={16} />
                          <span className="text-xs font-black uppercase">Categoria {selectedApp.cnh_type}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-black text-slate-300 uppercase">Não possui</span>
                      )}
                    </div>
                    <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Sabe por letreiro?</p>
                      {selectedApp.knows_signage ? (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 size={16} />
                          <span className="text-xs font-black uppercase">Sim, capacitado</span>
                        </div>
                      ) : (
                        <span className="text-xs font-black text-red-400 uppercase">Não</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resume Download */}
                {selectedApp.resume_url && (
                  <div className="pt-8 border-t border-slate-100 dark:border-zinc-800">
                    <button 
                      onClick={() => window.open(selectedApp.resume_url, '_blank')}
                      className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-xl border-2 border-slate-800 flex items-center justify-center gap-3 hover:bg-black active:scale-[0.98] transition-all"
                    >
                      <Download size={20} />
                      Baixar Currículo PDF
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecruitmentPanel;
