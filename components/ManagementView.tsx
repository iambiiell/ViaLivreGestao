import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DollarSign, Timer, Briefcase, Save, ShieldCheck, List, Plus, Search, Trash2, Edit3, X, Loader2, Info, ChevronRight, Calculator, CheckSquare, Square } from 'lucide-react';
import { PayrollRubric, RoleConfig, ViewState, SystemSettings, User } from '../types';
import { db, supabase } from '../services/database';
import { VIEW_LABELS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfirmDialog, ConfirmDialogModal } from './ConfirmDialog';

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
  const [activeTab, setActiveTab] = useState<'roles' | 'rubrics'>('roles');
  const [rubrics, setRubrics] = useState<PayrollRubric[]>([]);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Partial<PayrollRubric> | null>(null);
  const [editingRole, setEditingRole] = useState<Partial<RoleConfig> | null>(null);

  const { isOpen: isConfirmOpen, options: confirmOptions, confirm, handleClose: handleConfirmClose } = useConfirmDialog();

  const allowedViews = useMemo(() => {
    return ACCESSIBLE_VIEWS
      .filter(v => v !== 'subscriptions' || currentUser?.email === 'via.nicolau.sa@gmail.com')
      .sort((a, b) => (VIEW_LABELS[a] || a).localeCompare(VIEW_LABELS[b] || b, 'pt-BR'));
  }, [currentUser]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
        const [rubricsData, rolesData, settingsData] = await Promise.all([
            db.getRubrics(),
            db.getRoleConfigs(),
            db.getSystemSettings()
        ]);
        setRubrics((rubricsData || []).sort((a, b) => a.name.localeCompare(b.name)));
        setRoles((rolesData || []).sort((a, b) => a.name.localeCompare(b.name)));
        if (settingsData && settingsData.length > 0) {
          setSettings(settingsData[0]);
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
            
            <div className="flex bg-slate-50 dark:bg-zinc-950 p-1 rounded-2xl border dark:border-zinc-800">
                <button onClick={() => setActiveTab('roles')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'roles' ? 'bg-yellow-400 text-slate-900 shadow-md' : 'text-slate-400'}`}>Cargos & Salários</button>
                <button onClick={() => setActiveTab('rubrics')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'rubrics' ? 'bg-yellow-400 text-slate-900 shadow-md' : 'text-slate-400'}`}>Tabela de Rubricas</button>
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
      ) : (
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
