
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Briefcase, 
  Truck, 
  FileText, 
  Upload, 
  Send, 
  CheckCircle2, 
  X, 
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  Calendar,
  MapPin,
  CreditCard,
  History,
  Eye,
  Plus,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { db } from '../services/database';
import { JobApplication, AppNotification, User as AppUser, JobVacancy } from '../types';
import { cpfMask, phoneMask, currencyMask, cepMask } from '../utils/masks';
import VacanciesView from './VacanciesView';

interface JobApplicationFormProps {
  onSuccess?: () => void;
  addToast: (message: string, type: 'success' | 'error' | 'warning') => void;
  currentUser?: AppUser | null;
}

const JobApplicationForm: React.FC<JobApplicationFormProps> = ({ onSuccess, addToast, currentUser }) => {
  const [activeView, setActiveView] = useState<'form' | 'list' | 'vacancies'>('vacancies');
  const [myApplications, setMyApplications] = useState<JobApplication[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [formData, setFormData] = useState<Partial<JobApplication>>({
    has_cnh: false,
    knows_signage: false,
    status: 'Triagem',
    is_first_job: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // State for resume upload
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false); // State for photo upload
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [vacancies, setVacancies] = useState<JobVacancy[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState<{ resume: boolean; photo: boolean }>({ resume: false, photo: false });

  useEffect(() => {
    fetchVacancies();
    
    // Subscribe to vacancy changes
    const vacancyChannel = supabase
      .channel('job-vacancies-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_vacancies' }, () => {
        fetchVacancies();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(vacancyChannel);
    };
  }, []);

  const fetchVacancies = async () => {
    try {
      const data = await db.getJobVacancies();
      setVacancies(data?.filter(v => v.is_active) || []);
    } catch (error) {
      console.error('Error fetching vacancies:', error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadMyApplications();
      // Pre-fill form with user data if available
      setFormData(prev => ({
        ...prev,
        full_name: currentUser.full_name || currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone,
        cpf: currentUser.cpf,
        address_street: currentUser.address_street,
        address_number: currentUser.address_number,
        address_neighborhood: currentUser.address_neighborhood,
        address_city: currentUser.address_city,
        address_state: currentUser.address_state,
        address_cep: currentUser.cep
      }));
    }
  }, [currentUser]);

  const loadMyApplications = async () => {
    if (!currentUser?.email) return;
    setIsLoadingList(true);
    try {
      const data = await db.getJobApplications();
      setMyApplications(data?.filter(app => app.email === currentUser.email) || []);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    
    if ('files' in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      file = e.dataTransfer.files[0];
    }

    if (!file) return;

    if (file.type !== 'application/pdf') {
      addToast('Por favor, envie apenas arquivos PDF para o currículo.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const systemId = currentUser?.system_id || vacancies.find(v => v.job_title === formData.desired_position)?.system_id || 'public';
      const fileName = `${systemId}/resume_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(fileName, file);

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          addToast('Erro: O bucket "resumes" não foi encontrado no sistema ViaLivre Gestão.', 'error');
          setIsUploading(false);
          return;
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, resume_url: publicUrl }));
      addToast('Currículo enviado com sucesso!', 'success');
    } catch (error: any) {
      console.error('Upload error:', error);
      addToast('Erro ao enviar currículo: ' + error.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    
    if ('files' in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      file = e.dataTransfer.files[0];
    }

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Por favor, envie apenas arquivos de imagem para a foto.', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const systemId = currentUser?.system_id || vacancies.find(v => v.job_title === formData.desired_position)?.system_id || 'public';
      const fileName = `${systemId}/photo_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file);

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          addToast('Erro: O bucket "photos" não foi encontrado no sistema ViaLivre Gestão.', 'error');
          setIsUploadingPhoto(false);
          return;
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, photo_url: publicUrl }));
      addToast('Foto enviada com sucesso!', 'success');
    } catch (error: any) {
      console.error('Photo upload error:', error);
      addToast('Erro ao enviar foto: ' + error.message, 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDrag = (e: React.DragEvent, type: 'resume' | 'photo', active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [type]: active }));
  };

  const handleDrop = (e: React.DragEvent, type: 'resume' | 'photo') => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [type]: false }));
    
    if (type === 'resume') {
      handleFileChange(e);
    } else {
      handlePhotoChange(e);
    }
  };

  const validate = () => {
    const required = [
      'full_name', 'email', 'phone', 'birth_date', 'cpf',
      'address_street', 'address_number', 'address_neighborhood',
      'address_city', 'address_state', 'address_cep',
      'desired_position', 'experience_summary', 'resume_url', 'photo_url'
    ];

    const missing: string[] = [];
    
    required.forEach(field => {
      if (!formData[field as keyof JobApplication]) {
        missing.push(field);
      }
    });

    if (formData.desired_position === 'Motorista' && formData.knows_signage === undefined) {
      missing.push('knows_signage');
    }

    if (missing.length > 0) {
      // Map field names to user-friendly labels
      const labels: Record<string, string> = {
        full_name: 'Nome Completo',
        email: 'E-mail',
        phone: 'Telefone',
        birth_date: 'Data de Nascimento',
        cpf: 'CPF',
        address_street: 'Rua',
        address_number: 'Número',
        address_neighborhood: 'Bairro',
        address_city: 'Cidade',
        address_state: 'Estado',
        address_cep: 'CEP',
        desired_position: 'Cargo Desejado',
        experience_summary: 'Resumo da Experiência',
        resume_url: 'Currículo (PDF)',
        photo_url: 'Foto do Candidato',
        knows_signage: 'Sabe por letreiro?'
      };

      const missingLabels = missing.map(m => labels[m] || m).join(', ');
      addToast(`Os seguintes campos são obrigatórios: ${missingLabels}`, 'error');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationAttempted(true);

    if (!validate()) return;
    
    if (!formData.confirmed) {
      addToast('Você deve confirmar que os dados são verdadeiros antes de concluir.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedVacancy = vacancies.find(v => v.job_title === formData.desired_position);
      const systemId = currentUser?.system_id || selectedVacancy?.system_id;

      const data = await db.create<JobApplication>('job_applications', {
        ...formData,
        system_id: systemId,
        created_at: new Date().toISOString()
      });

      if (!data) throw new Error('Falha ao salvar candidatura');

      // Real-time notification to RH
      await supabase.channel('job-applications-changes').send({
        type: 'broadcast',
        event: 'new-application',
        payload: { 
          message: `Novo Candidato: ${formData.full_name} para a vaga de ${formData.desired_position}`,
          candidate_name: formData.full_name,
          position: formData.desired_position
        }
      });

      // Also create a notification record in the database if the table exists
      try {
        await db.create<AppNotification>('notifications', {
          title: 'Novo Candidato',
          message: `Novo Candidato: ${formData.full_name} para a vaga de ${formData.desired_position}`,
          type: 'INFO',
          category: 'SYSTEM',
          target_role: 'ADMIN',
          is_read: false,
          created_at: new Date().toISOString(),
          link: 'recruitment',
          metadata: { applicationId: data.id }
        });
      } catch (err) {
        console.warn('Could not create notification record, but application was saved.');
      }

      addToast('Candidatura enviada com sucesso! Boa sorte.', 'success');
      if (onSuccess) onSuccess();
      
      // Reset form
      setFormData({
        has_cnh: false,
        knows_signage: false,
        status: 'Triagem'
      });
      setValidationAttempted(false);
    } catch (error: any) {
      console.error('Submission error:', error);
      addToast('Erro ao enviar candidatura: ' + error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (field: string, required: boolean = true) => {
    const value = formData[field as keyof JobApplication];
    const isMissing = !value || (typeof value === 'string' && value.trim() === '');
    return `w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl font-bold dark:text-zinc-100 outline-none transition-all border-2 ${
      validationAttempted && isMissing && required ? 'border-red-500 animate-shake' : 'border-slate-50 dark:border-zinc-800 focus:border-yellow-400'
    }`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-10 bg-white dark:bg-zinc-950 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-zinc-800">
      <div className="flex flex-col items-center mb-12">
        <div className="w-[65px] h-[65px] bg-yellow-400 rounded-2xl flex items-center justify-center mb-6 shadow-xl border-2 border-slate-900">
          <Briefcase className="text-slate-900" size={32} />
        </div>
        <h2 className="text-[1.2rem] font-black text-slate-900 dark:text-white uppercase italic tracking-tighter text-center">
          Trabalhe Conosco - ViaLivre Gestão
        </h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
          Faça parte da nossa equipe de excelência
        </p>

        <div className="mt-8 flex flex-wrap justify-center bg-slate-100 dark:bg-zinc-900 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800 gap-2">
          <button 
            onClick={() => setActiveView('vacancies')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeView === 'vacancies' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-yellow-400 shadow-md' : 'text-slate-400'}`}
          >
            <Briefcase size={14} /> Vagas
          </button>
          {currentUser && (
            <button 
              onClick={() => setActiveView('list')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeView === 'list' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-yellow-400 shadow-md' : 'text-slate-400'}`}
            >
              <History size={14} /> Meus Cadastros
            </button>
          )}
          <button 
            onClick={() => setActiveView('form')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeView === 'form' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-yellow-400 shadow-md' : 'text-slate-400'}`}
          >
            <Plus size={14} /> Nova Candidatura
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'vacancies' ? (
          <motion.div
            key="vacancies"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <VacanciesView 
              vacancies={vacancies} 
              onApply={(vacancy) => {
                setFormData(prev => ({ ...prev, desired_position: vacancy.job_title }));
                setActiveView('form');
              }} 
            />
          </motion.div>
        ) : activeView === 'list' && currentUser ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {isLoadingList ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-yellow-400" size={48} />
              </div>
            ) : myApplications.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 dark:bg-zinc-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-zinc-800">
                <Briefcase className="mx-auto text-slate-300 mb-4" size={48} />
                <p className="text-xs font-black text-slate-400 uppercase">Você ainda não possui candidaturas registradas.</p>
                <button 
                  onClick={() => setActiveView('form')}
                  className="mt-6 px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-black transition-all"
                >
                  Começar Agora
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {myApplications.map(app => (
                  <div key={app.id} className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 flex items-center justify-between group hover:border-yellow-400 transition-all">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-slate-400">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase italic text-slate-900 dark:text-white">{app.desired_position}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(app.created_at || '').toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        app.status === 'Triagem' ? 'bg-blue-100 text-blue-600' :
                        app.status === 'Entrevista' ? 'bg-orange-100 text-orange-600' :
                        app.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {app.status}
                      </div>
                      <button className="p-2 text-slate-300 hover:text-yellow-500 transition-colors">
                        <Eye size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.form 
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleSubmit} 
            className="space-y-12"
          >
            {/* Foto do Candidato - Moved to top */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600">
                  <Plus size={18} />
                </div>
                <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-zinc-100">Foto do Candidato</h3>
              </div>
              
              <div 
                onClick={() => photoInputRef.current?.click()}
                onDragEnter={(e) => handleDrag(e, 'photo', true)}
                onDragLeave={(e) => handleDrag(e, 'photo', false)}
                onDragOver={(e) => handleDrag(e, 'photo', true)}
                onDrop={(e) => handleDrop(e, 'photo')}
                className={`w-full p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer relative overflow-hidden ${
                  formData.photo_url ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 
                  dragActive.photo ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' :
                  'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900'
                }`}
              >
                {isUploadingPhoto ? (
                  <Loader2 className="animate-spin text-yellow-400" size={32} />
                ) : formData.photo_url ? (
                  <div className="flex flex-col items-center">
                    <img 
                      src={formData.photo_url} 
                      alt="Preview" 
                      className="w-24 h-24 object-cover rounded-xl mb-2 shadow-md border-2 border-white dark:border-zinc-800"
                      referrerPolicy="no-referrer"
                    />
                    <p className="text-[10px] font-black text-emerald-600 uppercase">Foto Enviada!</p>
                  </div>
                ) : (
                  <>
                    <Plus className="text-slate-400 mb-2" size={32} />
                    <p className="text-[10px] font-black text-slate-400 uppercase">Clique ou arraste sua foto</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Formatos: JPG, PNG</p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={photoInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handlePhotoChange} 
                />
              </div>
            </section>

        {/* Dados Pessoais */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
              <User size={18} />
            </div>
            <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-zinc-100">Dados Pessoais</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Nome Completo *</label>
              <input 
                className={inputClass('full_name')} 
                value={formData.full_name || ''} 
                onChange={e => setFormData({...formData, full_name: e.target.value})} 
                placeholder="Ex: João da Silva" 
              />
            </div>
            
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">E-mail *</label>
              <div className="relative">
                <Mail className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                  type="email"
                  className={`${inputClass('email')} pl-12`} 
                  value={formData.email || ''} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  placeholder="seu@email.com" 
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Telefone *</label>
              <div className="relative">
                <Phone className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                  className={`${inputClass('phone')} pl-12`} 
                  value={formData.phone || ''} 
                  onChange={e => setFormData({...formData, phone: phoneMask(e.target.value)})} 
                  placeholder="(00) 0 0000-0000" 
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Data de Nascimento *</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                  type="date"
                  className={`${inputClass('birth_date')} pl-12`} 
                  value={formData.birth_date || ''} 
                  onChange={e => setFormData({...formData, birth_date: e.target.value})} 
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">CPF *</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                  className={`${inputClass('cpf')} pl-12`} 
                  value={formData.cpf || ''} 
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 11) {
                      setFormData({...formData, cpf: cpfMask(val)});
                    }
                  }} 
                  placeholder="000.000.000-00" 
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 pt-4">
            <div className="w-full">
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Rua *</label>
              <input className={`${inputClass('address_street')} py-5`} value={formData.address_street || ''} onChange={e => setFormData({...formData, address_street: e.target.value})} placeholder="Nome da rua ou avenida" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1">
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Número *</label>
                <input className={inputClass('address_number')} value={formData.address_number || ''} onChange={e => setFormData({...formData, address_number: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Complemento</label>
                <input className={inputClass('address_complement', false)} value={formData.address_complement || ''} onChange={e => setFormData({...formData, address_complement: e.target.value})} placeholder="Apto, Bloco, etc." />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Bairro *</label>
                <input className={inputClass('address_neighborhood')} value={formData.address_neighborhood || ''} onChange={e => setFormData({...formData, address_neighborhood: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-3">
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Cidade *</label>
                <input className={inputClass('address_city')} value={formData.address_city || ''} onChange={e => setFormData({...formData, address_city: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-1">
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">UF (Estado) *</label>
                <input className={inputClass('address_state')} value={formData.address_state || ''} onChange={e => setFormData({...formData, address_state: e.target.value})} placeholder="Ex: RJ" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">CEP *</label>
                <input className={inputClass('address_cep')} value={formData.address_cep || ''} onChange={e => setFormData({...formData, address_cep: cepMask(e.target.value)})} placeholder="00000-000" />
              </div>
            </div>
          </div>
        </section>

        {/* Experiência Profissional */}
        <section className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                <Briefcase size={18} />
              </div>
              <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-zinc-100">Experiência Profissional</h3>
            </div>
            
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.is_first_job ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-200 dark:border-zinc-800'}`}>
                {formData.is_first_job && <CheckCircle2 size={16} />}
              </div>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={formData.is_first_job} 
                onChange={e => setFormData({...formData, is_first_job: e.target.checked})} 
              />
              <span className="text-[10px] font-black uppercase text-slate-600 dark:text-zinc-400">Primeiro Emprego</span>
            </label>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Cargo Desejado *</label>
              <select 
                className={inputClass('desired_position')} 
                value={formData.desired_position || ''} 
                onChange={e => setFormData({...formData, desired_position: e.target.value})}
              >
                <option value="">Selecione um cargo...</option>
                {vacancies.length > 0 ? (
                  vacancies.map(vacancy => (
                    <option key={vacancy.id} value={vacancy.job_title}>
                      {vacancy.job_title}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Motorista">Motorista</option>
                    <option value="Cobrador">Cobrador</option>
                    <option value="Fiscal">Fiscal</option>
                    <option value="Mecânico">Mecânico</option>
                    <option value="Auxiliar de Limpeza">Auxiliar de Limpeza</option>
                    <option value="Administrativo">Administrativo</option>
                  </>
                )}
              </select>
            </div>
            
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Resumo da Experiência *</label>
              <textarea 
                className={`${inputClass('experience_summary')} min-h-[120px] resize-none py-4`} 
                value={formData.experience_summary || ''} 
                onChange={e => setFormData({...formData, experience_summary: e.target.value})}
                placeholder={formData.is_first_job ? "Conte-nos sobre seus objetivos profissionais e por que deseja trabalhar conosco..." : "Conte-nos brevemente sobre suas experiências anteriores..."}
              />
            </div>

            {!formData.is_first_job && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden"
              >
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Última Empresa</label>
                  <input className={inputClass('exp1_company', false)} value={formData.exp1_company || ''} onChange={e => setFormData({...formData, exp1_company: e.target.value})} placeholder="Nome da Empresa" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Cargo</label>
                  <input className={inputClass('exp1_role', false)} value={formData.exp1_role || ''} onChange={e => setFormData({...formData, exp1_role: e.target.value})} placeholder="Seu cargo" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Data de Admissão</label>
                  <input type="date" className={inputClass('exp1_admission_date', false)} value={formData.exp1_admission_date || ''} onChange={e => setFormData({...formData, exp1_admission_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Data de Demissão</label>
                  <input type="date" className={inputClass('exp1_resignation_date', false)} value={formData.exp1_resignation_date || ''} onChange={e => setFormData({...formData, exp1_resignation_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Motivo da Saída</label>
                  <input className={inputClass('exp1_reason_for_leaving', false)} value={formData.exp1_reason_for_leaving || ''} onChange={e => setFormData({...formData, exp1_reason_for_leaving: e.target.value})} placeholder="Ex: Melhores oportunidades" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Último Salário</label>
                  <input className={inputClass('exp1_last_salary', false)} value={formData.exp1_last_salary || ''} onChange={e => setFormData({...formData, exp1_last_salary: currencyMask(e.target.value)})} placeholder="R$ 0,00" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Atividades realizadas</label>
                  <input className={inputClass('exp1_activities', false)} value={formData.exp1_activities || ''} onChange={e => setFormData({...formData, exp1_activities: e.target.value})} placeholder="Principais atividades" />
                </div>

                <div className="md:col-span-2 border-t border-slate-100 dark:border-zinc-800 my-4"></div>

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Penúltima Empresa</label>
                  <input className={inputClass('exp2_company', false)} value={formData.exp2_company || ''} onChange={e => setFormData({...formData, exp2_company: e.target.value})} placeholder="Nome da Empresa" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Cargo</label>
                  <input className={inputClass('exp2_role', false)} value={formData.exp2_role || ''} onChange={e => setFormData({...formData, exp2_role: e.target.value})} placeholder="Seu cargo" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Data de Admissão</label>
                  <input type="date" className={inputClass('exp2_admission_date', false)} value={formData.exp2_admission_date || ''} onChange={e => setFormData({...formData, exp2_admission_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Data de Demissão</label>
                  <input type="date" className={inputClass('exp2_resignation_date', false)} value={formData.exp2_resignation_date || ''} onChange={e => setFormData({...formData, exp2_resignation_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Motivo da Saída</label>
                  <input className={inputClass('exp2_reason_for_leaving', false)} value={formData.exp2_reason_for_leaving || ''} onChange={e => setFormData({...formData, exp2_reason_for_leaving: e.target.value})} placeholder="Ex: Melhores oportunidades" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Último Salário</label>
                  <input className={inputClass('exp2_last_salary', false)} value={formData.exp2_last_salary || ''} onChange={e => setFormData({...formData, exp2_last_salary: currencyMask(e.target.value)})} placeholder="R$ 0,00" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Atividades realizadas</label>
                  <input className={inputClass('exp2_activities', false)} value={formData.exp2_activities || ''} onChange={e => setFormData({...formData, exp2_activities: e.target.value})} placeholder="Principais atividades" />
                </div>

                <div className="md:col-span-2 border-t border-slate-100 dark:border-zinc-800 my-4"></div>

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Antepenúltima Empresa</label>
                  <input className={inputClass('exp3_company', false)} value={formData.exp3_company || ''} onChange={e => setFormData({...formData, exp3_company: e.target.value})} placeholder="Nome da Empresa" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Cargo</label>
                  <input className={inputClass('exp3_role', false)} value={formData.exp3_role || ''} onChange={e => setFormData({...formData, exp3_role: e.target.value})} placeholder="Seu cargo" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Data de Admissão</label>
                  <input type="date" className={inputClass('exp3_admission_date', false)} value={formData.exp3_admission_date || ''} onChange={e => setFormData({...formData, exp3_admission_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Data de Demissão</label>
                  <input type="date" className={inputClass('exp3_resignation_date', false)} value={formData.exp3_resignation_date || ''} onChange={e => setFormData({...formData, exp3_resignation_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Motivo da Saída</label>
                  <input className={inputClass('exp3_reason_for_leaving', false)} value={formData.exp3_reason_for_leaving || ''} onChange={e => setFormData({...formData, exp3_reason_for_leaving: e.target.value})} placeholder="Ex: Melhores oportunidades" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Último Salário</label>
                  <input className={inputClass('exp3_last_salary', false)} value={formData.exp3_last_salary || ''} onChange={e => setFormData({...formData, exp3_last_salary: currencyMask(e.target.value)})} placeholder="R$ 0,00" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Atividades realizadas</label>
                  <input className={inputClass('exp3_activities', false)} value={formData.exp3_activities || ''} onChange={e => setFormData({...formData, exp3_activities: e.target.value})} placeholder="Principais atividades" />
                </div>
              </motion.div>
            )}
            
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Anexar Currículo (PDF) *</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(e) => handleDrag(e, 'resume', true)}
                onDragLeave={(e) => handleDrag(e, 'resume', false)}
                onDragOver={(e) => handleDrag(e, 'resume', true)}
                onDrop={(e) => handleDrop(e, 'resume')}
                className={`w-full p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer ${
                  formData.resume_url ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 
                  dragActive.resume ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' :
                  'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900'
                }`}
              >
                {isUploading ? (
                  <Loader2 className="animate-spin text-yellow-400" size={32} />
                ) : formData.resume_url ? (
                  <>
                    <CheckCircle2 className="text-emerald-500 mb-2" size={32} />
                    <p className="text-[10px] font-black text-emerald-600 uppercase">Currículo Anexado!</p>
                  </>
                ) : (
                  <>
                    <Upload className="text-slate-400 mb-2" size={32} />
                    <p className="text-[10px] font-black text-slate-400 uppercase">Clique ou arraste seu currículo em PDF</p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf" 
                  onChange={handleFileChange} 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Qualificações de Transporte */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600">
              <Truck size={18} />
            </div>
            <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-zinc-100">Qualificações de Transporte</h3>
          </div>
          
          <div className="space-y-8">
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.has_cnh ? 'bg-yellow-400 border-slate-900 text-slate-900' : 'border-slate-200 dark:border-zinc-800'}`}>
                  {formData.has_cnh && <CheckCircle2 size={16} />}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={formData.has_cnh} 
                  onChange={e => setFormData({...formData, has_cnh: e.target.checked, cnh_type: e.target.checked ? formData.cnh_type : undefined})} 
                />
                <span className="text-[10px] font-black uppercase text-slate-600 dark:text-zinc-400">Possuo CNH Profissional</span>
              </label>

              {formData.has_cnh && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="pl-9"
                >
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Categoria da CNH *</label>
                  <div className="flex gap-3">
                    {['D', 'E'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({...formData, cnh_type: type as 'D' | 'E'})}
                        className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${
                          formData.cnh_type === type ? 'bg-slate-900 text-white border-slate-900' : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-100 dark:border-zinc-800'
                        }`}
                      >
                        Categoria {type}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {formData.desired_position === 'Motorista' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-yellow-50 dark:bg-yellow-900/10 rounded-3xl border-2 border-yellow-100 dark:border-yellow-800/30"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-yellow-700 dark:text-yellow-400">Habilidade com Letreiro Eletrônico *</h4>
                    <p className="text-[8px] font-bold text-yellow-600/60 uppercase">Você sabe operar letreiros FRT/Mobitec?</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, knows_signage: true})}
                      className={`px-4 py-2 rounded-lg font-black text-[9px] uppercase border-2 transition-all ${
                        formData.knows_signage === true ? 'bg-yellow-400 border-slate-900 text-slate-900' : 'bg-white dark:bg-zinc-800 text-slate-400 border-transparent'
                      }`}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, knows_signage: false})}
                      className={`px-4 py-2 rounded-lg font-black text-[9px] uppercase border-2 transition-all ${
                        formData.knows_signage === false ? 'bg-red-400 border-slate-900 text-white' : 'bg-white dark:bg-zinc-800 text-slate-400 border-transparent'
                      }`}
                    >
                      Não
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </section>

        <div className="pt-10 border-t border-slate-100 dark:border-zinc-800 space-y-6">
          <div className="flex justify-center">
            <label className={`flex items-center gap-3 cursor-pointer group p-4 rounded-2xl transition-all border-2 ${validationAttempted && !formData.confirmed ? 'border-red-500 bg-red-50 dark:bg-red-900/10 animate-shake' : 'border-transparent'}`}>
              <div id="confirm-registration-check" className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${formData.confirmed ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
                {formData.confirmed && <CheckCircle2 size={20} />}
              </div>
              <input 
                type="checkbox" 
                id="confirm-registration"
                className="hidden" 
                checked={!!formData.confirmed} 
                onChange={e => setFormData({...formData, confirmed: e.target.checked})} 
              />
              <span className="text-xs font-black uppercase text-slate-700 dark:text-zinc-300">Confirmo que todos os dados acima são verdadeiros</span>
            </label>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting || isUploading || isUploadingPhoto}
            className="w-full py-5 bg-yellow-400 text-slate-900 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl border-2 border-slate-900 flex items-center justify-center gap-3 hover:bg-yellow-500 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Processando...
              </>
            ) : (
              <>
                <Send size={20} />
                Concluir Cadastro
              </>
            )}
          </button>
          <p className="text-center text-[8px] font-bold text-slate-400 uppercase mt-4">
            Ao clicar em Concluir, sua candidatura será enviada para o setor de RH.
          </p>
        </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};

export default JobApplicationForm;
