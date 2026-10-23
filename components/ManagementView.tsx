import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DollarSign, Timer, Briefcase, Save, ShieldCheck, List, Plus, Search, Trash2, Edit3, X, Loader2, Info, ChevronRight, Calculator, CheckSquare, Square, Database, CreditCard, Building2, Globe, Phone, Clock, Image as ImageIcon, QrCode as QrCodeIcon, Sparkles, ExternalLink, UploadCloud, RotateCcw, Palette, Check } from 'lucide-react';
import { PayrollRubric, RoleConfig, ViewState, SystemSettings, User, Company, VtCardCompanySettings, ImpCard } from '../types';
import { db, supabase } from '../services/database';
import { VIEW_LABELS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfirmDialog, ConfirmDialogModal } from './ConfirmDialog';
import BackupSchedulePanel from './BackupSchedulePanel';
import TransportCard from './TransportCard';

const SHIFTS = ['6x1', '5x1', '5x2', '12x36'];

const ACCESSIBLE_VIEWS: ViewState[] = [
  'operation-center',
  'monitoring',
  'dashboard',
  'management',
  'skins',
  'reports-view',
  'time-tracking',
  'payroll',
  'ticketing',
  'ticketing-config',
  'notices',
  'observations',
  'inspections',
  'maintenance',
  'companies',
  'cities',
  'bus-stations',
  'routes',
  'schedule',
  'dispatcher',
  'sac',
  'work-with-us',
  'vehicles',
  'drivers',
  'recruitment',
  'users',
  'subscriptions',
  'my-subscription',
  'notifications',
  'about'
];

const ManagementView: React.FC<{ addToast: (m: string, t?: any) => void; currentUser: User | null }> = ({ addToast, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'roles' | 'rubrics' | 'backup' | 'vt_data'>('roles');
  const [rubrics, setRubrics] = useState<PayrollRubric[]>([]);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedVtCompanyId, setSelectedVtCompanyId] = useState<string>('');
  const [vtForm, setVtForm] = useState<VtCardCompanySettings>({
    user_abbreviation: '',
    system_name: '',
    system_name_size: 'medium',
    system_name_font_size: 24,
    slogan: '',
    display_website: '',
    sac_name: '',
    sac_phone: '',
    sac_hours: '',
    front_background_url: '',
    back_background_url: '',
    qr_code_destination: '',
    color_category: '',
    color_system_name: '',
    color_slogan: '',
    color_city_state: '',
    color_user_name: '',
    color_user_label: '',
    color_nfc: '',
    color_operator_label: '',
    color_internal_code: '',
    color_card_number: '',
    color_user_name_back: '',
    color_legal_notice: '',
    color_info_service: '',
    color_display_website: '',
    color_sac_name: '',
    color_sac_phone: '',
    color_sac_hours: ''
  });
  const [vtPreviewSide, setVtPreviewSide] = useState<'front' | 'back'>('front');
  const [isSavingVt, setIsSavingVt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Partial<PayrollRubric> | null>(null);
  const [editingRole, setEditingRole] = useState<Partial<RoleConfig> | null>(null);

  // Estados de Drag & Drop para imagens de fundo do cartão
  const [isDraggingFront, setIsDraggingFront] = useState(false);
  const [isDraggingBack, setIsDraggingBack] = useState(false);
  const frontFileInputRef = useRef<HTMLInputElement | null>(null);
  const backFileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper para processamento otimizado de imagens locais do cartão (1011px x 638px)
  const processCardBackgroundImage = useCallback((file: File, callback: (dataUrl: string) => void) => {
    if (!file.type.startsWith('image/')) {
      addToast('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP).', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawResult = e.target?.result as string;
      if (!rawResult) return;
      
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 1011;
          canvas.height = 638;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
            const x = (canvas.width - img.width * scale) / 2;
            const y = (canvas.height - img.height * scale) / 2;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            const optimized = canvas.toDataURL('image/jpeg', 0.88);
            callback(optimized);
          } else {
            callback(rawResult);
          }
        } catch {
          callback(rawResult);
        }
      };
      img.onerror = () => {
        callback(rawResult);
      };
      img.src = rawResult;
    };
    reader.readAsDataURL(file);
  }, [addToast]);

  const { isOpen: isConfirmOpen, options: confirmOptions, confirm, handleClose: handleConfirmClose } = useConfirmDialog();

  const allowedViews = useMemo(() => {
    return ACCESSIBLE_VIEWS
      .filter(v => v !== 'subscriptions' || currentUser?.email === 'via.nicolau.sa@gmail.com')
      .sort((a, b) => (VIEW_LABELS[a] || a).localeCompare(VIEW_LABELS[b] || b, 'pt-BR'));
  }, [currentUser]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
        const [rubricsData, rolesData, settingsData, companiesData] = await Promise.all([
            db.getRubrics(),
            db.getRoleConfigs(),
            db.getSystemSettings(),
            db.getCompanies().catch(() => [])
        ]);
        setRubrics((rubricsData || []).sort((a, b) => a.name.localeCompare(b.name)));
        setRoles((rolesData || []).sort((a, b) => a.name.localeCompare(b.name)));
        setCompanies(companiesData || []);
        if (settingsData && settingsData.length > 0) {
          const loadedSetting = settingsData[0];
          let unpackedVal: any = {};
          try {
            if ((loadedSetting as any).value) {
              unpackedVal = typeof (loadedSetting as any).value === 'string'
                ? JSON.parse((loadedSetting as any).value)
                : (loadedSetting as any).value;
            }
          } catch {}
          setSettings({ ...loadedSetting, ...unpackedVal });
        } else {
          setSettings({ id: 'default', registration_pattern: 'FLX-000' });
        }
    } catch (e) {
        addToast("Erro ao carregar dados de gestão.", "error");
    } finally {
        setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
    const sub = db.subscribeTables(['role_configs', 'payroll_rubrics', 'system_settings'], () => {
      loadData();
    });
    return () => sub.unsubscribe();
  }, [loadData]);

  // Sincronizar empresa selecionada padrão
  useEffect(() => {
    if (companies.length > 0 && !selectedVtCompanyId) {
      setSelectedVtCompanyId(companies[0].id);
    }
  }, [companies, selectedVtCompanyId]);

  // Carregar dados de VT do formulário quando a empresa ou settings mudam
  useEffect(() => {
    const comp = companies.find(c => c.id === selectedVtCompanyId);
    const compSettings = selectedVtCompanyId && settings?.vt_card_settings ? settings.vt_card_settings[selectedVtCompanyId] : undefined;
    setVtForm({
      user_abbreviation: compSettings?.user_abbreviation || (settings as any)?.vt_user_abbreviation || '',
      system_name: compSettings?.system_name || (comp?.name ? `S.B.U. ${comp.name}` : settings?.vt_system_name || 'S.B.U. IntegraVias'),
      system_name_size: compSettings?.system_name_size || settings?.vt_system_name_size || 'medium',
      system_name_font_size: compSettings?.system_name_font_size || (settings as any)?.vt_system_name_font_size || 24,
      slogan: compSettings?.slogan || settings?.vt_slogan || 'Movendo pessoas, conectando cidades!',
      display_website: compSettings?.display_website || settings?.vt_display_website || 'vialivregestao.netlify.app',
      sac_name: compSettings?.sac_name || settings?.vt_sac_name || 'SAC Central do Usuário',
      sac_phone: compSettings?.sac_phone || settings?.vt_sac_phone || '(11) 4004-0000 / 0800 700 8090',
      sac_hours: compSettings?.sac_hours || settings?.vt_sac_hours || 'Segunda a Sexta, das 06:00 às 22:00',
      front_background_url: compSettings?.front_background_url || settings?.vt_front_bg_url || '',
      back_background_url: compSettings?.back_background_url || settings?.vt_back_bg_url || '',
      qr_code_destination: compSettings?.qr_code_destination || settings?.vt_qr_code_url || 'https://vialivregestao.netlify.app',
      color_category: compSettings?.color_category || (settings as any)?.vt_color_category || '',
      color_system_name: compSettings?.color_system_name || (settings as any)?.vt_color_system_name || '',
      color_slogan: compSettings?.color_slogan || (settings as any)?.vt_color_slogan || '',
      color_city_state: compSettings?.color_city_state || (settings as any)?.vt_color_city_state || '',
      color_user_name: compSettings?.color_user_name || (settings as any)?.vt_color_user_name || '',
      color_user_label: compSettings?.color_user_label || (settings as any)?.vt_color_user_label || '',
      color_nfc: compSettings?.color_nfc || (settings as any)?.vt_color_nfc || '',
      color_operator_label: compSettings?.color_operator_label || (settings as any)?.vt_color_operator_label || '',
      color_internal_code: compSettings?.color_internal_code || (settings as any)?.vt_color_internal_code || '',
      color_card_number: compSettings?.color_card_number || (settings as any)?.vt_color_card_number || '',
      color_user_name_back: compSettings?.color_user_name_back || (settings as any)?.vt_color_user_name_back || '',
      color_legal_notice: compSettings?.color_legal_notice || (settings as any)?.vt_color_legal_notice || '',
      color_info_service: compSettings?.color_info_service || (settings as any)?.vt_color_info_service || '',
      color_display_website: compSettings?.color_display_website || (settings as any)?.vt_color_display_website || '',
      color_sac_name: compSettings?.color_sac_name || (settings as any)?.vt_color_sac_name || '',
      color_sac_phone: compSettings?.color_sac_phone || (settings as any)?.vt_color_sac_phone || '',
      color_sac_hours: compSettings?.color_sac_hours || (settings as any)?.vt_color_sac_hours || ''
    });
  }, [selectedVtCompanyId, settings, companies]);

  const handleSaveVtSettings = async () => {
    setIsSavingVt(true);
    try {
      const currentVtSettings = settings?.vt_card_settings || {};
      const updatedCardSettings = {
        ...currentVtSettings,
        ...(selectedVtCompanyId ? { [selectedVtCompanyId]: vtForm } : {}),
        default: vtForm
      };

      const updatedSettings: SystemSettings = {
        ...(settings || { id: 'default', registration_pattern: 'FLX-000' }),
        vt_card_settings: updatedCardSettings,
        vt_system_name: vtForm.system_name,
        vt_system_name_size: vtForm.system_name_size,
        vt_system_name_font_size: vtForm.system_name_font_size || 24,
        vt_slogan: vtForm.slogan,
        vt_display_website: vtForm.display_website,
        vt_sac_name: vtForm.sac_name,
        vt_sac_phone: vtForm.sac_phone,
        vt_sac_hours: vtForm.sac_hours,
        vt_front_bg_url: vtForm.front_background_url,
        vt_back_bg_url: vtForm.back_background_url,
        vt_qr_code_url: vtForm.qr_code_destination,
        ...(vtForm.color_category ? { vt_color_category: vtForm.color_category } : {}),
        ...(vtForm.color_system_name ? { vt_color_system_name: vtForm.color_system_name } : {}),
        ...(vtForm.color_slogan ? { vt_color_slogan: vtForm.color_slogan } : {}),
        ...(vtForm.color_city_state ? { vt_color_city_state: vtForm.color_city_state } : {}),
        ...(vtForm.color_user_name ? { vt_color_user_name: vtForm.color_user_name } : {}),
        ...(vtForm.color_user_label ? { vt_color_user_label: vtForm.color_user_label } : {}),
        ...(vtForm.color_nfc ? { vt_color_nfc: vtForm.color_nfc } : {}),
        ...(vtForm.color_operator_label ? { vt_color_operator_label: vtForm.color_operator_label } : {}),
        ...(vtForm.color_internal_code ? { vt_color_internal_code: vtForm.color_internal_code } : {}),
        ...(vtForm.color_card_number ? { vt_color_card_number: vtForm.color_card_number } : {}),
        ...(vtForm.color_user_name_back ? { vt_color_user_name_back: vtForm.color_user_name_back } : {}),
        ...(vtForm.color_legal_notice ? { vt_color_legal_notice: vtForm.color_legal_notice } : {}),
        ...(vtForm.color_info_service ? { vt_color_info_service: vtForm.color_info_service } : {}),
        ...(vtForm.color_display_website ? { vt_color_display_website: vtForm.color_display_website } : {}),
        ...(vtForm.color_sac_name ? { vt_color_sac_name: vtForm.color_sac_name } : {}),
        ...(vtForm.color_sac_phone ? { vt_color_sac_phone: vtForm.color_sac_phone } : {}),
        ...(vtForm.color_sac_hours ? { vt_color_sac_hours: vtForm.color_sac_hours } : {})
      };

      // Garantir persistência real no Supabase Cloud na tabela system_settings
      let savedResult: SystemSettings | null = null;
      const existingList = await db.fetchAll<SystemSettings>('system_settings', { bypassSystemId: true });
      const activeRecord = (existingList && existingList.length > 0) ? existingList[0] : null;

      if (activeRecord && activeRecord.id && activeRecord.id !== 'default') {
        savedResult = await db.update('system_settings', {
          ...activeRecord,
          ...updatedSettings,
          id: activeRecord.id
        });
      } else if (settings?.id && settings.id !== 'default') {
        savedResult = await db.update('system_settings', {
          ...settings,
          ...updatedSettings,
          id: settings.id
        });
      } else {
        savedResult = await db.create('system_settings', updatedSettings);
      }

      let unpackedValue: any = {};
      try {
        if (savedResult && (savedResult as any).value) {
          unpackedValue = typeof (savedResult as any).value === 'string'
            ? JSON.parse((savedResult as any).value)
            : (savedResult as any).value;
        }
      } catch {}

      const finalSaved: SystemSettings = {
        ...updatedSettings,
        ...(savedResult || {}),
        ...(unpackedValue || {}),
        vt_card_settings: updatedCardSettings
      };
      setSettings(finalSaved);
      if (typeof window !== 'undefined') {
        localStorage.setItem('vialivre_system_settings', JSON.stringify(finalSaved));
        window.dispatchEvent(new CustomEvent('vialivre-system-settings-updated', { detail: finalSaved }));
        window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      }

      addToast("Configurações do Cartão de Vale Transporte salvas com sucesso no banco de dados!", "success");
    } catch (e) {
      console.error("Erro ao salvar configurações do Vale Transporte:", e);
      addToast("Erro ao persistir configurações na tabela system_settings.", "error");
    } finally {
      setIsSavingVt(false);
    }
  };

  const handleSaveRole = async () => {
    if (!editingRole?.name) return addToast("Preencha o nome do cargo.", "warning");
    
    setIsLoading(true);
    try {
        if (editingRole.id) {
            await db.update('role_configs', editingRole as RoleConfig);
            addToast("Cargo atualizado.", "success");
        } else {
            await db.create('role_configs', { ...editingRole });
            addToast("Cargo cadastrado.", "success");
        }
        setIsRoleModalOpen(false);
        await loadData();
    } catch (e) {
        addToast("Falha ao salvar cargo.", "error");
    } finally {
        setIsLoading(false);
    }
  };

  const handleSaveRubric = async () => {
    if (!editingRubric?.code || !editingRubric?.name || !editingRubric?.type) {
        return addToast("Preencha Código, Nome e Tipo.", "warning");
    }

    setIsLoading(true);
    try {
        const rubricToSave = {
            ...editingRubric,
            system_id: currentUser?.system_id,
            condition_value: editingRubric.condition_value 
                ? parseFloat(editingRubric.condition_value.toString().replace(',', '.')) 
                : null,
            updated_at: new Date().toISOString()
        };

        if (editingRubric.id) {
            await db.update('payroll_rubrics', rubricToSave as unknown as PayrollRubric);
            addToast("Rubrica atualizada com sucesso.", "success");
        } else {
            await db.create('payroll_rubrics', rubricToSave as unknown as Partial<PayrollRubric>);
            addToast("Rubrica cadastrada com sucesso.", "success");
        }

        setIsModalOpen(false);
        await loadData();
    } catch (e) {
        console.error('Erro ao salvar rubrica:', e);
        addToast("Falha operacional no banco.", "error");
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteRole = async (role: RoleConfig) => {
    if (!role.id) {
      addToast('ID do cargo não encontrado.', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Excluir Cargo',
      message: `Tem certeza que deseja excluir o cargo "${role.name}"? Esta operação é permanente.`,
      confirmText: 'Excluir Cargo',
      type: 'danger'
    });
    if (ok) {
      setIsLoading(true);
      try {
        await db.delete('role_configs', role.id);
        addToast('Cargo excluído com sucesso!', 'success');
        setRoles(prev => prev.filter(r => r.id !== role.id));
      } catch (error) {
        console.error('Erro ao excluir cargo:', error);
        addToast('Erro ao excluir cargo.', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDeleteRubric = async (rubric: PayrollRubric) => {
    if (!rubric.id) {
      addToast('ID da rubrica não encontrado.', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Excluir Rubrica',
      message: `Tem certeza que deseja excluir a rubrica [${rubric.code}] "${rubric.name}"? Esta operação é permanente.`,
      confirmText: 'Excluir Rubrica',
      type: 'danger'
    });
    if (ok) {
      setIsLoading(true);
      try {
        await db.delete('payroll_rubrics', rubric.id);
        addToast('Rubrica excluída com sucesso!', 'success');
        setRubrics(prev => prev.filter(r => r.id !== rubric.id));
      } catch (error) {
        console.error('Erro ao excluir rubrica:', error);
        addToast('Erro ao excluir rubrica.', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const filteredRubrics = useMemo(() => {
    const cleanSearch = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return rubrics.filter(r => {
      const codeClean = String(r.code || '').toLowerCase();
      const nameClean = String(r.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return codeClean.includes(cleanSearch) || nameClean.includes(cleanSearch);
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [rubrics, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in transition-all pb-24">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none">Gestão Global RH</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 border-l-2 border-yellow-400 pl-4">Configuração central de remuneração e eventos</p>
            </div>
            
            <div className="flex flex-wrap bg-slate-50 dark:bg-zinc-950 p-1 rounded-2xl border dark:border-zinc-800 gap-1">
                <button onClick={() => setActiveTab('roles')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'roles' ? 'bg-yellow-400 text-slate-900 shadow-md' : 'text-slate-400'}`}>Cargos & Salários</button>
                <button onClick={() => setActiveTab('rubrics')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'rubrics' ? 'bg-yellow-400 text-slate-900 shadow-md' : 'text-slate-400'}`}>Tabela de Rubricas</button>
                <button onClick={() => setActiveTab('backup')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'backup' ? 'bg-yellow-400 text-slate-900 shadow-md' : 'text-slate-400'}`}>
                    <Database size={13} /> Backups Automáticos
                </button>
                <button onClick={() => setActiveTab('vt_data')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'vt_data' ? 'bg-yellow-400 text-slate-900 shadow-md' : 'text-slate-400'}`}>
                    <CreditCard size={13} /> Dados Vale Transporte
                </button>
            </div>
        </div>
      </div>

      {activeTab === 'roles' ? (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gerenciamento de Cargos e Permissões</p>
                <button onClick={() => { setEditingRole({ name: '', base_salary: 0, standard_shift: '6x1', permissions: [], base_role: 'DRIVER' }); setIsRoleModalOpen(true); }} className="px-6 py-3 bg-yellow-400 text-slate-900 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg border-2 border-slate-900 active:scale-95 transition-all">
                    <Plus size={16} /> Novo Cargo
                </button>
            </div>

            <div className="flex overflow-x-auto pb-6 gap-6 snap-x snap-mandatory md:grid md:grid-cols-2 xl:grid-cols-3 md:overflow-x-visible md:pb-0 md:snap-none custom-scrollbar">
                {roles.map((role, idx) => (
                <div key={role.id || idx} className="min-w-[280px] sm:min-w-[320px] md:min-w-0 snap-center flex-1">
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm hover:shadow-lg transition-all group relative h-full flex flex-col">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-yellow-600 transition-transform group-hover:rotate-12 shadow-inner">
                            <Briefcase size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-xs mb-3">{role.name}</h3>
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-widest">Salário: R$ {(role.base_salary || 0).toFixed(2)}</span>
                                <span className="text-[11px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-widest">Escala: {role.standard_shift}</span>
                            </div>
                        </div>
                        <div className="flex gap-1 items-center">
                            <button onClick={() => { setEditingRole({ ...role, permissions: Array.isArray(role.permissions) ? role.permissions : [] }); setIsRoleModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg"><Edit3 size={16}/></button>
                            <button 
                              onClick={() => handleDeleteRole(role)} 
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg"
                              title="Excluir Cargo"
                            >
                              <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2 mt-auto">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Permissões de Acesso:</p>
                        <div className="flex flex-wrap gap-1">
                            {(Array.isArray(role.permissions) ? role.permissions : []).map(p => (
                                <span key={p} className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 rounded-md text-[7px] font-black text-slate-600 dark:text-zinc-400 uppercase">{VIEW_LABELS[p] || p}</span>
                            ))}
                            {(!role.permissions || role.permissions.length === 0) && <span className="text-[7px] font-black text-red-400 uppercase italic">Nenhum acesso liberado</span>}
                        </div>
                    </div>
                  </div>
                </div>
                ))}
            </div>
        </div>
      ) : activeTab === 'rubrics' ? (
        <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 transition-colors">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex-1 w-full relative max-w-md">
                        <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar código ou nome da rubrica..." 
                            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border-2 border-yellow-400/20 text-[10px] font-black uppercase outline-none dark:text-zinc-300 shadow-inner transition-all focus:border-yellow-400" 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                    <button onClick={() => { setEditingRubric({ type: 'EARNING' }); setIsModalOpen(true); }} className="w-full sm:w-auto px-8 py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-xl border-2 border-slate-900 active:scale-95 transition-all">
                        <Plus size={18} /> Nova Rubrica
                    </button>
                </div>
            </div>

            <div className="grid gap-4">
                {isLoading ? (
                    <div className="py-20 text-center flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-yellow-500" size={48}/>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando dicionário de eventos...</p>
                    </div>
                ) : filteredRubrics.length === 0 ? (
                    <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-zinc-800">
                        <List className="mx-auto text-slate-200 mb-4" size={48}/>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma rubrica localizada.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 dark:bg-zinc-950/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b dark:border-zinc-800">
                                <tr>
                                    <th className="px-8 py-5 w-24">Cód</th>
                                    <th className="px-8 py-5">Descrição do Evento</th>
                                    <th className="px-8 py-5">Tipo</th>
                                    <th className="px-8 py-5 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                                {filteredRubrics.map((rubric, idx) => (
                                    <tr key={rubric.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                                        <td className="px-8 py-5">
                                            <span className="bg-slate-900 text-yellow-400 font-mono font-black px-3 py-1 rounded-lg border-2 border-slate-800 text-xs">{rubric.code}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="font-black text-slate-800 dark:text-zinc-100 uppercase text-xs">{rubric.name}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border-2 ${
                                                rubric.type === 'EARNING' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                rubric.type === 'DEDUCTION' ? 'bg-red-50 text-red-600 border-red-200' :
                                                'bg-indigo-50 text-indigo-600 border-indigo-200'
                                            }`}>
                                                {rubric.type === 'EARNING' ? 'Provento' : rubric.type === 'DEDUCTION' ? 'Desconto' : 'Informativo'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2 items-center">
                                                <button onClick={() => { setEditingRubric(rubric); setIsModalOpen(true); }} className="p-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all"><Edit3 size={18}/></button>
                                                <button 
                                                  onClick={() => handleDeleteRubric(rubric)} 
                                                  className="p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                                                  title="Excluir Rubrica"
                                                >
                                                  <Trash2 size={18}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
      ) : activeTab === 'backup' ? (
        <BackupSchedulePanel 
          currentUser={currentUser} 
          addToast={addToast} 
        />
      ) : (
        /* ABA DADOS VALE TRANSPORTE */
        <div className="space-y-8 animate-in fade-in">
          {/* BARRA SUPERIOR DE CONTROLE MULTI-TENANT */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 p-8 bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-yellow-400 shadow-md">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-slate-950 flex items-center justify-center font-black shadow-lg">
                <CreditCard size={28} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-amber-600 dark:text-yellow-400 tracking-widest block">
                  Customização Institucional Multi-Tenant
                </span>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase italic">
                  Configurações do Cartão Vale Transporte
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold mt-0.5">
                  Dados impressos no cartão físico/digital, SAC e QR Code lidos diretamente da tabela <code className="text-yellow-600 dark:text-yellow-400 font-mono">system_settings</code>.
                </p>
              </div>
            </div>

            {/* SELETOR DE EMPRESA MULTI-TENANT & SALVAR */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <div className="flex-1 sm:w-64">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Empresa a Customizar:</label>
                <select
                  value={selectedVtCompanyId}
                  onChange={e => setSelectedVtCompanyId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border-2 border-yellow-400 rounded-2xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 ring-yellow-400"
                >
                  {companies.length > 0 ? (
                    companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''}
                      </option>
                    ))
                  ) : (
                    <option value="">Nenhuma empresa cadastrada</option>
                  )}
                </select>
              </div>

              <div className="sm:pt-5">
                <button
                  onClick={handleSaveVtSettings}
                  disabled={isSavingVt}
                  className="w-full sm:w-auto px-8 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-2xl font-black uppercase text-xs tracking-wider shadow-xl border-2 border-slate-950 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shrink-0 disabled:opacity-50"
                >
                  {isSavingVt ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>Gravar no Banco</span>
                </button>
              </div>
            </div>
          </div>

          {/* GRID FORMULÁRIO DE CUSTOMIZAÇÃO & PREVIEW AO VIVO */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            {/* COLUNA ESQUERDA: FORMULÁRIO */}
            <div className="xl:col-span-6 space-y-6">
              {/* BLOCO 1: IDENTIDADE DO CARTÃO */}
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <Sparkles size={20} className="text-yellow-500" />
                  <h4 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                    1. Identidade Institucional no Cartão
                  </h4>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 ml-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">
                        Nome do Sistema no Cartão (Frente) *
                      </label>
                      
                      {/* Opção de Tamanho do Texto em Pixels (px) */}
                      <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-zinc-700/60">
                        <span className="text-[9px] font-black uppercase text-slate-400">Tamanho:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={10}
                            max={48}
                            value={Number(vtForm.system_name_font_size) || 24}
                            onChange={e => {
                              const val = Math.max(10, Math.min(48, Number(e.target.value) || 20));
                              setVtForm({ ...vtForm, system_name_font_size: val, system_name_size: val >= 28 ? 'large' : val <= 16 ? 'small' : 'medium' });
                            }}
                            className="w-12 px-1 py-0.5 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-black text-center text-slate-900 dark:text-white"
                          />
                          <span className="text-[10px] font-black text-slate-400">px</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-1 pl-1.5 border-l border-slate-200 dark:border-zinc-700">
                          {[12, 16, 20, 24, 30].map(px => (
                            <button
                              key={px}
                              type="button"
                              onClick={() => setVtForm({ ...vtForm, system_name_font_size: px, system_name_size: px >= 28 ? 'large' : px <= 16 ? 'small' : 'medium' })}
                              className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all ${
                                Number(vtForm.system_name_font_size) === px
                                  ? 'bg-yellow-400 text-slate-950 font-bold shadow-xs'
                                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {px}px
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Ex: S.B.U. IntegraVias"
                      value={vtForm.system_name || ''}
                      onChange={e => setVtForm({ ...vtForm, system_name: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-950 border-2 border-yellow-400 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-yellow-400 text-slate-900 dark:text-white"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5 ml-2 text-[9px] text-slate-400">
                      <span>Exibido em destaque na frente do cartão com dimensionamento configurável em pixels.</span>
                      {(Number(vtForm.system_name_font_size) >= 24 || (vtForm.system_name && vtForm.system_name.length > 18)) && (
                        <span className="text-yellow-600 dark:text-yellow-400 font-bold flex items-center gap-1">
                          ✨ Quebra de texto automática ativada no cartão para tamanho grande.
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-1 ml-2 block">
                      Lema / Slogan do Cartão (Frente) *
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Movendo pessoas, conectando cidades!"
                      value={vtForm.slogan || ''}
                      onChange={e => setVtForm({ ...vtForm, slogan: e.target.value })}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-zinc-950 border-2 border-yellow-400 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-yellow-400 text-slate-900 dark:text-white resize-none"
                    />
                    <p className="text-[9px] text-slate-400 mt-1 ml-2">
                      Exibido alinhado à borda direita da frente do cartão com quebra automática de texto em múltiplas linhas.
                    </p>
                  </div>



                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-1 ml-2 block">
                      Site de Exibição no Cartão (Verso) *
                    </label>
                    <div className="relative">
                      <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500" />
                      <input
                        type="text"
                        placeholder="Ex: vialivregestao.netlify.app"
                        value={vtForm.display_website || ''}
                        onChange={e => setVtForm({ ...vtForm, display_website: e.target.value })}
                        className="w-full pl-11 pr-5 py-4 bg-slate-50 dark:bg-zinc-950 border-2 border-yellow-400 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-yellow-400 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCO 2: DADOS COMPLETOS DO SAC */}
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <Phone size={20} className="text-emerald-500" />
                  <h4 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                    2. Dados do SAC (Rodapé do Verso)
                  </h4>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-1 ml-2 block">
                      Nome do SAC *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: SAC Central do Usuário"
                      value={vtForm.sac_name || ''}
                      onChange={e => setVtForm({ ...vtForm, sac_name: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-950 border-2 border-yellow-400 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-yellow-400 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-1 ml-2 block">
                        Telefone do SAC *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: (11) 4004-0000 / 0800 700 8090"
                        value={vtForm.sac_phone || ''}
                        onChange={e => setVtForm({ ...vtForm, sac_phone: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-950 border-2 border-yellow-400 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-yellow-400 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-1 ml-2 block">
                        Horários de Atendimento *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Seg a Sex das 06:00 às 22:00"
                        value={vtForm.sac_hours || ''}
                        onChange={e => setVtForm({ ...vtForm, sac_hours: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-950 border-2 border-yellow-400 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-yellow-400 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCO 3: IMAGENS DE FUNDO & QR CODE */}
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <ImageIcon size={20} className="text-purple-500" />
                  <h4 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                    3. Imagens de Fundo (1011px x 638px) & QR Code
                  </h4>
                </div>

                <div className="space-y-4">
                  {/* FRENTE: Upload / Drag & Drop do Armazenamento */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-1.5 ml-2 block flex items-center justify-between">
                      <span>Imagem de Fundo da Frente (1011px x 638px)</span>
                      {vtForm.front_background_url && (
                        <button
                          type="button"
                          onClick={() => setVtForm({ ...vtForm, front_background_url: '' })}
                          className="text-[9px] text-red-500 hover:text-red-600 font-bold uppercase flex items-center gap-1"
                        >
                          <X size={12} /> Remover (Usar Amarelo Padrão)
                        </button>
                      )}
                    </label>

                    <input
                      type="file"
                      ref={frontFileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          processCardBackgroundImage(file, dataUrl => {
                            setVtForm(prev => ({ ...prev, front_background_url: dataUrl }));
                            addToast("Imagem de fundo da frente carregada com sucesso!", "success");
                          });
                        }
                      }}
                    />

                    <div
                      onDragOver={e => { e.preventDefault(); setIsDraggingFront(true); }}
                      onDragLeave={() => setIsDraggingFront(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setIsDraggingFront(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          processCardBackgroundImage(file, dataUrl => {
                            setVtForm(prev => ({ ...prev, front_background_url: dataUrl }));
                            addToast("Imagem de fundo da frente aplicada com sucesso!", "success");
                          });
                        }
                      }}
                      onClick={() => frontFileInputRef.current?.click()}
                      className={`relative w-full p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col sm:flex-row items-center gap-4 ${
                        isDraggingFront
                          ? 'border-yellow-400 bg-yellow-400/10 scale-[1.01]'
                          : vtForm.front_background_url
                          ? 'border-yellow-400/80 bg-slate-50 dark:bg-zinc-950'
                          : 'border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 hover:border-yellow-400'
                      }`}
                    >
                      {vtForm.front_background_url ? (
                        <>
                          <div className="w-24 h-16 rounded-xl overflow-hidden border border-yellow-400 shadow-md shrink-0 bg-slate-900">
                            <img src={vtForm.front_background_url} alt="Frente" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                              <Check size={14} className="text-emerald-500" />
                              Imagem personalizada carregada
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                              Clique ou arraste outro arquivo para substituir a imagem da frente.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-2xl bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center shrink-0">
                            <UploadCloud size={24} />
                          </div>
                          <div className="text-center sm:text-left">
                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase">
                              Selecionar Imagem do Armazenamento ou Arrastar
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                              PNG, JPG ou WebP • Enquadrado automaticamente para 1011px x 638px
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* VERSO: Upload / Drag & Drop do Armazenamento */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-1.5 ml-2 block flex items-center justify-between">
                      <span>Imagem de Fundo do Verso (1011px x 638px)</span>
                      {vtForm.back_background_url && (
                        <button
                          type="button"
                          onClick={() => setVtForm({ ...vtForm, back_background_url: '' })}
                          className="text-[9px] text-red-500 hover:text-red-600 font-bold uppercase flex items-center gap-1"
                        >
                          <X size={12} /> Remover (Usar Fundo Escuro Padrão)
                        </button>
                      )}
                    </label>

                    <input
                      type="file"
                      ref={backFileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          processCardBackgroundImage(file, dataUrl => {
                            setVtForm(prev => ({ ...prev, back_background_url: dataUrl }));
                            addToast("Imagem de fundo do verso carregada com sucesso!", "success");
                          });
                        }
                      }}
                    />

                    <div
                      onDragOver={e => { e.preventDefault(); setIsDraggingBack(true); }}
                      onDragLeave={() => setIsDraggingBack(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setIsDraggingBack(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          processCardBackgroundImage(file, dataUrl => {
                            setVtForm(prev => ({ ...prev, back_background_url: dataUrl }));
                            addToast("Imagem de fundo do verso aplicada com sucesso!", "success");
                          });
                        }
                      }}
                      onClick={() => backFileInputRef.current?.click()}
                      className={`relative w-full p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col sm:flex-row items-center gap-4 ${
                        isDraggingBack
                          ? 'border-yellow-400 bg-yellow-400/10 scale-[1.01]'
                          : vtForm.back_background_url
                          ? 'border-yellow-400/80 bg-slate-50 dark:bg-zinc-950'
                          : 'border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 hover:border-yellow-400'
                      }`}
                    >
                      {vtForm.back_background_url ? (
                        <>
                          <div className="w-24 h-16 rounded-xl overflow-hidden border border-yellow-400 shadow-md shrink-0 bg-slate-900">
                            <img src={vtForm.back_background_url} alt="Verso" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                              <Check size={14} className="text-emerald-500" />
                              Imagem personalizada carregada
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                              Clique ou arraste outro arquivo para substituir a imagem do verso.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-2xl bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center shrink-0">
                            <UploadCloud size={24} />
                          </div>
                          <div className="text-center sm:text-left">
                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase">
                              Selecionar Imagem do Armazenamento ou Arrastar
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                              PNG, JPG ou WebP • Enquadrado automaticamente para 1011px x 638px
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 mb-1 ml-2 block">
                      Link de Destino do QR Code *
                    </label>
                    <div className="relative">
                      <QrCodeIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500" />
                      <input
                        type="url"
                        placeholder="https://vialivregestao.netlify.app/canais-bilhetagem"
                        value={vtForm.qr_code_destination || ''}
                        onChange={e => setVtForm({ ...vtForm, qr_code_destination: e.target.value })}
                        className="w-full pl-11 pr-5 py-4 bg-slate-50 dark:bg-zinc-950 border-2 border-yellow-400 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-yellow-400 text-slate-900 dark:text-white"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1 ml-2">Ao escanear o QR Code no verso do cartão, o usuário é direcionado a este link.</p>
                  </div>
                </div>
              </div>

              {/* BLOCO 4: PERSONALIZAÇÃO DE CORES DOS TEXTOS DO CARTÃO */}
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <Palette size={20} className="text-pink-500" />
                    <div>
                      <h4 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                        4. Cores dos Textos do Cartão
                      </h4>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                        Defina a cor personalizada de cada campo de texto da frente e do verso
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVtForm(prev => ({
                        ...prev,
                        color_category: '',
                        color_system_name: '',
                        color_slogan: '',
                        color_city_state: '',
                        color_user_name: '',
                        color_user_label: '',
                        color_nfc: '',
                        color_operator_label: '',
                        color_internal_code: '',
                        color_card_number: '',
                        color_user_name_back: '',
                        color_legal_notice: '',
                        color_info_service: '',
                        color_display_website: '',
                        color_sac_name: '',
                        color_sac_phone: '',
                        color_sac_hours: ''
                      }));
                      addToast("Cores restauradas para o padrão institucional!", "info");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 font-black text-[10px] uppercase flex items-center gap-1.5 transition-all"
                    title="Restaurar todas as cores para o tema padrão"
                  >
                    <RotateCcw size={12} />
                    <span>Padrão</span>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Cores da Frente */}
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-black uppercase tracking-wider text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
                      <span>Frente do Cartão</span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: 'color_category', label: 'Categoria / Tipo de Cartão', defaultHex: '#0f172a' },
                        { key: 'color_system_name', label: 'Nome do Sistema (Frente)', defaultHex: '#0f172a' },
                        { key: 'color_slogan', label: 'Lema / Slogan do Cartão', defaultHex: '#1e293b' },
                        { key: 'color_city_state', label: 'Município e Estado', defaultHex: '#334155' },
                        { key: 'color_user_label', label: 'Rótulo "Titular do Benefício"', defaultHex: '#334155' },
                        { key: 'color_user_name', label: 'Nome do Usuário Titular', defaultHex: '#0f172a' },
                        { key: 'color_nfc', label: 'NFC / Contactless', defaultHex: '#0f172a' },
                      ].map(({ key, label, defaultHex }) => {
                        const currentColor = (vtForm as any)[key] || defaultHex;
                        const isCustom = Boolean((vtForm as any)[key]);
                        return (
                          <div key={key} className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black uppercase text-slate-700 dark:text-zinc-200 truncate">{label}</p>
                              <span className="text-[9px] font-mono text-slate-400">{currentColor}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="color"
                                value={currentColor}
                                onChange={e => setVtForm({ ...vtForm, [key]: e.target.value })}
                                className="w-8 h-8 rounded-xl border-2 border-slate-300 dark:border-zinc-700 cursor-pointer p-0 bg-transparent"
                              />
                              {isCustom && (
                                <button
                                  type="button"
                                  onClick={() => setVtForm({ ...vtForm, [key]: '' })}
                                  className="text-slate-400 hover:text-red-500 p-1"
                                  title="Restaurar padrão"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cores do Verso */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <h5 className="text-[11px] font-black uppercase tracking-wider text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
                      <span>Verso do Cartão</span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: 'color_operator_label', label: 'Legenda da Concessionária', defaultHex: '#94a3b8' },
                        { key: 'color_internal_code', label: 'Código Interno', defaultHex: '#fde047' },
                        { key: 'color_card_number', label: 'Número do Cartão (10 dígitos)', defaultHex: '#ffffff' },
                        { key: 'color_user_name_back', label: 'Nome do Usuário (Verso)', defaultHex: '#ffffff' },
                        { key: 'color_legal_notice', label: 'Aviso Legal ("Uso pessoal")', defaultHex: '#cbd5e1' },
                        { key: 'color_info_service', label: 'Título Informações e Serviços', defaultHex: '#facc15' },
                        { key: 'color_display_website', label: 'Site / Website no Verso', defaultHex: '#67e8f9' },
                        { key: 'color_sac_name', label: 'Nome do SAC', defaultHex: '#e2e8f0' },
                        { key: 'color_sac_phone', label: 'Telefone do SAC', defaultHex: '#fde047' },
                        { key: 'color_sac_hours', label: 'Horários de Atendimento', defaultHex: '#cbd5e1' },
                      ].map(({ key, label, defaultHex }) => {
                        const currentColor = (vtForm as any)[key] || defaultHex;
                        const isCustom = Boolean((vtForm as any)[key]);
                        return (
                          <div key={key} className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black uppercase text-slate-700 dark:text-zinc-200 truncate">{label}</p>
                              <span className="text-[9px] font-mono text-slate-400">{currentColor}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="color"
                                value={currentColor}
                                onChange={e => setVtForm({ ...vtForm, [key]: e.target.value })}
                                className="w-8 h-8 rounded-xl border-2 border-slate-300 dark:border-zinc-700 cursor-pointer p-0 bg-transparent"
                              />
                              {isCustom && (
                                <button
                                  type="button"
                                  onClick={() => setVtForm({ ...vtForm, [key]: '' })}
                                  className="text-slate-400 hover:text-red-500 p-1"
                                  title="Restaurar padrão"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: LIVE PREVIEW DO CARTÃO (FRENTE E VERSO) */}
            <div className="xl:col-span-6 space-y-6">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border-2 border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col items-center">
                <div className="w-full flex items-center justify-between pb-6 border-b border-slate-100 dark:border-zinc-800 mb-6">
                  <div>
                    <h4 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
                      <CreditCard size={18} className="text-yellow-500" />
                      Prévia do Cartão em Tempo Real
                    </h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      Frente & Verso Institucional (Proporção 1011px x 638px)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={() => setVtPreviewSide('front')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                          vtPreviewSide === 'front'
                            ? 'bg-yellow-400 text-slate-950 shadow-sm'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Frente
                      </button>
                      <button
                        type="button"
                        onClick={() => setVtPreviewSide('back')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                          vtPreviewSide === 'back'
                            ? 'bg-slate-900 text-yellow-400 dark:bg-yellow-400 dark:text-slate-950 shadow-sm'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Verso
                      </button>
                    </div>
                    <span className="px-3 py-1 bg-yellow-400 text-slate-950 rounded-xl font-black text-[9px] uppercase shadow">
                      Live Preview
                    </span>
                  </div>
                </div>

                {/* COMPONENTE TRANSPORT CARD LIVE */}
                <div className="w-full overflow-x-auto custom-scrollbar py-4 flex justify-center">
                  {(() => {
                    const activeComp = companies.find(c => c.id === selectedVtCompanyId) || (companies.length > 0 ? companies[0] : { id: 'default', name: 'Vialivre' });
                    const compId = activeComp?.id || 'default';
                    return (
                      <TransportCard
                        company={activeComp}
                        settings={{
                          ...settings,
                          vt_user_abbreviation: vtForm.user_abbreviation,
                          vt_system_name: vtForm.system_name,
                          vt_system_name_font_size: vtForm.system_name_font_size,
                          vt_slogan: vtForm.slogan,
                          vt_display_website: vtForm.display_website,
                          vt_sac_name: vtForm.sac_name,
                          vt_sac_phone: vtForm.sac_phone,
                          vt_sac_hours: vtForm.sac_hours,
                          vt_front_bg_url: vtForm.front_background_url,
                          vt_back_bg_url: vtForm.back_background_url,
                          vt_card_settings: {
                            ...(settings?.vt_card_settings || {}),
                            [compId]: vtForm,
                            default: vtForm
                          }
                        }}
                        name="MARIA EDUARDA SILVA"
                        abbreviation="M. E. SILVA"
                        cardNumber="1084920158"
                        internalCode="VT89K2A1"
                        category="VALE TRANSPORTE"
                        city="Campinas"
                        state="SP"
                        viewMode={vtPreviewSide}
                        interactiveFlip={true}
                        scale={0.92}
                      />
                    );
                  })()}
                </div>

                {/* INFORMAÇÕES DE INTEGRAÇÃO MULTI-TENANT */}
                <div className="w-full mt-6 p-6 rounded-3xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-black text-xs uppercase">
                    <ShieldCheck size={16} />
                    <span>Conformidade Multi-Tenant & Supabase</span>
                  </div>
                  <ul className="text-[10px] text-slate-600 dark:text-zinc-300 font-bold space-y-1.5 list-disc pl-4">
                    <li>Cada empresa cadastrada possui seus próprios dados impressos no cartão de forma autônoma.</li>
                    <li>O painel Web e o aplicativo móvel <strong>ViaLivre Mobile</strong> leem simultaneamente esses dados da tabela <code className="text-yellow-600 dark:text-yellow-400">system_settings</code>.</li>
                    <li>Resolução nativa configurada para impressão gráfica nos padrões <code className="text-yellow-600 dark:text-yellow-400">1011px x 638px</code>.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE CARGO */}
      {isRoleModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[150] flex items-center justify-center p-4 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 20 }}
                transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden flex flex-col max-h-[90vh]"
              >
                  <div className="p-8 border-b dark:border-zinc-800 bg-slate-900 flex justify-between items-center text-white">
                      <div>
                        <h3 className="text-xl font-black uppercase italic tracking-tighter">{editingRole?.id ? 'Editar Cargo' : 'Novo Cargo'}</h3>
                        <p className="text-[9px] font-black text-yellow-400 uppercase mt-1">Configuração de Remuneração e Acessos</p>
                      </div>
                      <button onClick={() => setIsRoleModalOpen(false)} className="p-3 bg-white/10 rounded-2xl hover:bg-red-500 transition-colors"><X size={24}/></button>
                  </div>
                  
                  <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="md:col-span-2">
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Nome do Cargo</label>
                              <input 
                                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-yellow-400/20 rounded-2xl font-black outline-none focus:border-yellow-400 dark:text-white uppercase" 
                                value={editingRole?.name || ''} 
                                onChange={e => setEditingRole({...editingRole, name: e.target.value.toUpperCase()})} 
                                placeholder="EX: MOTORISTA URBANO"
                              />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Salário Base (R$)</label>
                              <input 
                                type="text"
                                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-yellow-400/20 rounded-2xl font-black outline-none focus:border-yellow-400 dark:text-white text-right" 
                                value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(editingRole?.base_salary || 0)} 
                                onChange={e => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  const numericValue = Number(val) / 100;
                                  setEditingRole({...editingRole, base_salary: numericValue});
                                }} 
                              />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Escala Padrão</label>
                              <select 
                                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-yellow-400/20 rounded-2xl font-black outline-none focus:border-yellow-400 dark:text-white" 
                                value={editingRole?.standard_shift} 
                                onChange={e => setEditingRole({...editingRole, standard_shift: e.target.value})}
                              >
                                  {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                          </div>
                      </div>

                       <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 ml-2">Permissões de Acesso (Abas do Sistema)</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <button 
                                type="button"
                                onClick={() => {
                                    const allSelected = allowedViews.every(v => editingRole?.permissions?.includes(v));
                                    if (allSelected) {
                                        setEditingRole({...editingRole, permissions: []});
                                    } else {
                                        setEditingRole({...editingRole, permissions: [...allowedViews]});
                                    }
                                }}
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                                    allowedViews.every(v => editingRole?.permissions?.includes(v))
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-200'
                                        : 'border-dashed border-slate-300 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 font-bold'
                                }`}
                              >
                                  {allowedViews.every(v => editingRole?.permissions?.includes(v)) ? <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400"/> : <Square size={16}/>}
                                  <span className="text-[9px] font-black uppercase truncate">TODAS AS ABAS</span>
                              </button>

                              {allowedViews.map(view => {
                                  const isSelected = editingRole?.permissions?.includes(view);
                                  return (
                                      <button 
                                        key={view}
                                        onClick={() => {
                                            const permissions = [...(editingRole?.permissions || [])];
                                            if (isSelected) {
                                                setEditingRole({...editingRole, permissions: permissions.filter(p => p !== view)});
                                            } else {
                                                setEditingRole({...editingRole, permissions: [...permissions, view]});
                                            }
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                                            isSelected ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-slate-900 dark:text-white' : 'border-slate-100 dark:border-zinc-800 text-slate-400'
                                        }`}
                                      >
                                          {isSelected ? <CheckSquare size={16} className="text-yellow-600"/> : <Square size={16}/>}
                                          <span className="text-[9px] font-black uppercase truncate">{VIEW_LABELS[view]}</span>
                                      </button>
                                  );
                              })}
                          </div>
                      </div>

                      <div className="flex gap-4 pt-6">
                          <button onClick={() => setIsRoleModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                          <button onClick={handleSaveRole} className="flex-[2] py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 border-2 border-slate-900 transition-all">
                             {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Salvar Cargo
                          </button>
                      </div>
                  </div>
              </motion.div>
          </div>
      )}

      {/* MODAL DE EDIÇÃO DE RUBRICA */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[150] flex items-center justify-center p-4 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 20 }}
                transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden flex flex-col max-h-[90vh]"
              >
                  <div className="p-8 border-b dark:border-zinc-800 bg-slate-900 flex justify-between items-center text-white shrink-0">
                      <div>
                        <h3 className="text-xl font-black uppercase italic tracking-tighter">{editingRubric?.id ? 'Editar Rubrica' : 'Nova Rubrica'}</h3>
                        <p className="text-[9px] font-black text-yellow-400 uppercase mt-1">Configuração do Dicionário de Eventos</p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white/10 rounded-2xl hover:bg-red-500 transition-colors"><X size={24}/></button>
                  </div>
                  
                  <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Código (Ex: 001)</label>
                              <input 
                                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-yellow-400/20 rounded-2xl font-black outline-none focus:border-yellow-400 dark:text-white" 
                                value={editingRubric?.code || ''} 
                                onChange={e => setEditingRubric({...editingRubric, code: e.target.value})} 
                              />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Classificação</label>
                              <select 
                                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-yellow-400/20 rounded-2xl font-black outline-none focus:border-yellow-400 dark:text-white" 
                                value={editingRubric?.type} 
                                onChange={e => setEditingRubric({...editingRubric, type: e.target.value as any})}
                              >
                                  <option value="EARNING">PROVENTO</option>
                                  <option value="DEDUCTION">DESCONTO</option>
                                  <option value="INFO">INFORMATIVO / BASE</option>
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Nome do Evento</label>
                          <input 
                            className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-yellow-400/20 rounded-2xl font-black outline-none focus:border-yellow-400 dark:text-white uppercase" 
                            value={editingRubric?.name || ''} 
                            onChange={e => setEditingRubric({...editingRubric, name: e.target.value.toUpperCase()})} 
                            placeholder="EX: ADICIONAL DE INSALUBRIDADE"
                          />
                      </div>

                      <div className="space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editingRubric?.has_conditions ? 'bg-yellow-400 border-slate-900 text-slate-900' : 'border-slate-200 dark:border-zinc-800'}`}>
                            {editingRubric?.has_conditions && <CheckSquare size={16} />}
                          </div>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={editingRubric?.has_conditions || false} 
                            onChange={e => setEditingRubric({...editingRubric, has_conditions: e.target.checked})} 
                          />
                          <span className="text-[10px] font-black uppercase text-slate-600 dark:text-zinc-400">Possui Condições Especiais</span>
                        </label>

                        {editingRubric?.has_conditions && (
                          <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Valor da Condição</label>
                              <input 
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-yellow-400/20 rounded-xl font-black outline-none focus:border-yellow-400 dark:text-white" 
                                value={editingRubric?.condition_value || ''} 
                                onChange={e => setEditingRubric({...editingRubric, condition_value: e.target.value})}
                                placeholder="Ex: 7.5"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Símbolo / Unidade</label>
                              <input 
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-yellow-400/20 rounded-xl font-black outline-none focus:border-yellow-400 dark:text-white" 
                                value={editingRubric?.condition_symbol || ''} 
                                onChange={e => setEditingRubric({...editingRubric, condition_symbol: e.target.value})}
                                placeholder="Ex: %"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Calcular Condição sobre Qual Rubrica?</label>
                              <select 
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border-2 border-yellow-400/20 rounded-xl font-black outline-none focus:border-yellow-400 dark:text-white" 
                                value={editingRubric?.condition_base_rubric_id || ''} 
                                onChange={e => setEditingRubric({...editingRubric, condition_base_rubric_id: e.target.value || undefined})}
                              >
                                <option value="">[SALÁRIO BASE DO COLABORADOR]</option>
                                {rubrics
                                  .filter(r => r.id !== editingRubric?.id)
                                  .map(rub => (
                                    <option key={rub.id} value={rub.id}>
                                      [{rub.code}] {rub.name} ({rub.type === 'EARNING' ? 'Provento' : rub.type === 'DEDUCTION' ? 'Desconto' : 'Informativo'})
                                    </option>
                                  ))
                                }
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-3xl border-2 border-dashed border-slate-200 dark:border-zinc-800 flex items-start gap-4">
                          <Calculator className="text-yellow-600 shrink-0" size={24}/>
                          <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed">
                            Uma rubrica cadastrada aqui estará disponível instantaneamente no motor de cálculo de holerites para todos os colaboradores.
                          </p>
                      </div>

                      <div className="flex gap-4">
                          <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                          <button onClick={handleSaveRubric} className="flex-[2] py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 border-2 border-slate-900 transition-all">
                             {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Salvar Rubrica
                          </button>
                      </div>
                  </div>
              </motion.div>
          </div>
      )}

      <ConfirmDialogModal isOpen={isConfirmOpen} options={confirmOptions} onClose={handleConfirmClose} />

      <div className="bg-slate-900 text-white p-10 rounded-[3rem] border-4 border-yellow-400 shadow-2xl flex flex-col md:flex-row items-center gap-8">
        <ShieldCheck className="text-yellow-400 shrink-0" size={64} />
        <div>
            <h4 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Auditoria de Parâmetros RH</h4>
            <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed max-w-2xl">
              As alterações efetuadas neste painel impactam instantaneamente os cálculos de proventos e descontos da folha mensal. Certifique-se de validar as alíquotas e nomenclaturas conforme os acordos coletivos e legislação vigente.
            </p>
        </div>
      </div>
    </div>
  );
};

export default ManagementView;
