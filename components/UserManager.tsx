
import React, { useState, useMemo } from 'react';
import { User, UserRole, RoleConfig, Company } from '../types';
import { VIEW_LABELS } from '../constants';
import { UserCircle, Pencil, X, Trash2, ArrowUpDown, UserPlus, Mail, Phone, Shield, KeyRound, UserCheck, Briefcase, Building2, Search, Save, AlertCircle, Eye, EyeOff, MapPin } from 'lucide-react';
import { phoneMask, cpfMask, cepMask } from '../utils/masks';

interface UserManagerProps {
  users: User[];
  currentUser: User | null;
  roleConfigs: RoleConfig[];
  companies: Company[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
  initialUserData?: Partial<User> | null;
  onClearInitialData?: () => void;
}

const UserManager: React.FC<UserManagerProps> = ({ users = [], currentUser, roleConfigs = [], companies = [], onAddUser, onUpdateUser, onDeleteUser, initialUserData, onClearInitialData }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [showPassword, setShowPassword] = useState(false);
  
  const initialFormState: Partial<User> = { 
    full_name: '', 
    role: 'ADMIN', 
    email: '', 
    unidade: currentUser?.unidade || '',
    login_acesso: '',
    senha_acesso: '',
    job_title: 'Administrador'
  };
  const [formData, setFormData] = useState<Partial<User>>(initialFormState);

  React.useEffect(() => {
    if (initialUserData) {
      const roleConf = roleConfigs.find(rc => rc.name === initialUserData.job_title);
      setFormData({ 
        ...initialFormState, 
        ...initialUserData,
        permissions: roleConf ? roleConf.permissions : (initialUserData.permissions || [])
      });
      setEditingId(null);
      setErrors(new Set());
      setIsModalOpen(true);
    }
  }, [initialUserData, roleConfigs]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (onClearInitialData) onClearInitialData();
  };

  const filteredUsers = useMemo(() => {
    return (users || [])
        .filter(u => 
            (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.login_acesso || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [users, searchTerm]);

  const handleOpenModal = (user?: User) => {
    if (user) { 
        setEditingId(user.id); 
        const roleConf = roleConfigs.find(rc => rc.name === user.job_title);
        setFormData({ 
            ...user,
            permissions: roleConf ? roleConf.permissions : (user.permissions || [])
        }); 
    } else { 
        setEditingId(null); 
        setFormData(initialFormState); 
    }
    setErrors(new Set());
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = new Set<string>();
    if (!formData.full_name?.trim()) newErrors.add('full_name');
    if (!formData.email?.trim()) newErrors.add('email');
    if (!formData.login_acesso?.trim()) newErrors.add('login_acesso');
    if (!formData.senha_acesso?.trim()) newErrors.add('senha_acesso');

    if (newErrors.size > 0) {
        setErrors(newErrors);
        return;
    }

    if (editingId) {
        onUpdateUser({ ...formData, id: editingId } as User);
    } else {
        onAddUser(formData as User);
    }
    handleCloseModal();
  };

  const mapRoleToUserRole = (jobTitle: string): UserRole => {
    const title = jobTitle.toUpperCase();
    if (title.includes('ADMIN')) return 'ADMIN';
    if (title.includes('MOTORISTA')) return 'DRIVER';
    if (title.includes('FISCAL')) return 'FISCAL';
    if (title.includes('MECANICO') || title.includes('MECÂNICO')) return 'MECHANIC';
    if (title.includes('RH') || title.includes('RECURSOS HUMANOS')) return 'RH';
    if (title.includes('GUICHE') || title.includes('GUICHÊ') || title.includes('VENDAS')) return 'TICKET_AGENT';
    if (title.includes('COBRADOR')) return 'CONDUCTOR';
    return 'ADMIN';
  };

  const inputClass = (field: string) => `w-full px-5 py-4 border-2 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none transition-all ${errors.has(field) ? 'border-red-500 animate-shake' : 'border-slate-100 dark:border-zinc-800 focus:border-blue-500'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 transition-colors gap-4">
        <div className="flex-1 w-full">
            <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 tracking-tighter uppercase italic leading-none transition-colors">Controle de Acessos</h2>
            <div className="mt-6 relative max-w-md">
                <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Pesquisar por nome ou e-mail..." 
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black uppercase outline-none dark:text-zinc-300 shadow-inner"
                    value={searchTerm || ''}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"><UserPlus size={18} /> Novo Acesso</button>
      </div>

      {/* Mobile-first card list layout */}
      <div className="block lg:hidden space-y-4">
        {filteredUsers.map(user => (
          <div key={user.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-slate-300 dark:text-zinc-600 overflow-hidden shadow-sm transition-colors">
                {user.photo_url ? <img src={user.photo_url} className="w-full h-full object-cover" alt="Foto"/> : <UserCircle size={22} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 dark:text-zinc-100 text-xs uppercase truncate">{user.full_name || user.name}</p>
                <p className="text-[10px] text-blue-600 font-bold truncate">{user.email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50 dark:border-zinc-800">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Login / Usuário</p>
                <p className="text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase mt-1">{user.login_acesso || '---'}</p>
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Unidade</p>
                <p className="text-[9px] font-bold text-yellow-600 uppercase mt-1">{user.unidade || 'SEM UNIDADE'}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-50 dark:border-zinc-800">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cargo</p>
                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-colors ${
                    user.role === 'ADMIN' ? 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600' : 
                    user.role === 'DRIVER' ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-600' :
                    user.role === 'TICKET_AGENT' ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-600' :
                    user.role === 'RH' ? 'bg-purple-50 dark:bg-purple-900/10 text-purple-600' :
                    user.role === 'MECHANIC' ? 'bg-red-50 dark:bg-red-900/10 text-red-600' :
                    user.role === 'FISCAL' ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600' :
                    'bg-slate-50 dark:bg-zinc-800 text-slate-500'
                }`}>{
                    user.job_title || user.role
                }</span>
                {user.is_full_admin && (
                  <span className="ml-1.5 px-2 py-0.5 bg-yellow-400 text-slate-900 rounded text-[7px] font-black uppercase">FULL</span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenModal(user)} className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-blue-600 dark:text-blue-400 rounded-xl transition-all shadow-sm">
                  <Pencil size={18} />
                </button>
                {user.id !== currentUser?.id && (
                  <button onClick={() => onDeleteUser(user.id)} className="p-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl transition-all shadow-sm">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop view style table layout */}
      <div className="hidden lg:block bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden transition-colors">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 uppercase text-[9px] font-black tracking-[0.2em] transition-colors">
            <tr>
                <th className="px-8 py-6">Colaborador</th>
                <th className="px-8 py-4 md:py-6">Login / Unidade</th>
                <th className="px-8 py-6">Tipo</th>
                <th className="px-8 py-6 text-right">Gestão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-zinc-800 transition-colors">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-800/30 transition-colors">
                <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-slate-300 dark:text-zinc-600 overflow-hidden shadow-sm transition-colors">
                            {user.photo_url ? <img src={user.photo_url} className="w-full h-full object-cover" alt="Foto"/> : <UserCircle size={20} />}
                        </div>
                        <div>
                            <p className="font-black text-slate-800 dark:text-zinc-100 text-xs uppercase transition-colors">{user.full_name || user.name}</p>
                            <p className="text-[10px] text-blue-600 font-bold">{user.email}</p>
                        </div>
                    </div>
                </td>
                <td className="px-8 py-5">
                    <p className="text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase transition-colors">{user.login_acesso || '---'}</p>
                    <p className="text-[8px] font-bold text-yellow-600 uppercase tracking-widest">{user.unidade || 'SEM UNIDADE'}</p>
                </td>
                <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-colors ${
                        user.role === 'ADMIN' ? 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600' : 
                        user.role === 'DRIVER' ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-600' :
                        user.role === 'TICKET_AGENT' ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-600' :
                        user.role === 'RH' ? 'bg-purple-50 dark:bg-purple-900/10 text-purple-600' :
                        user.role === 'MECHANIC' ? 'bg-red-50 dark:bg-red-900/10 text-red-600' :
                        user.role === 'FISCAL' ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600' :
                        'bg-slate-50 dark:bg-zinc-800 text-slate-500'
                    }`}>{
                        user.job_title || (
                          user.role === 'ADMIN' ? 'ADMINISTRADOR' :
                          user.role === 'DRIVER' ? 'MOTORISTA' :
                          user.role === 'TICKET_AGENT' ? 'AGENTE DE GUICHÊ' :
                          user.role === 'RH' ? 'RECURSOS HUMANOS' :
                          user.role === 'MECHANIC' ? 'MECÂNICO' :
                          user.role === 'FISCAL' ? 'FISCAL' :
                          user.role
                        )
                    }
                    {user.is_full_admin && (
                      <span className="ml-2 px-2 py-0.5 bg-yellow-400 text-slate-900 rounded text-[7px] font-black uppercase">FULL</span>
                    )}
                    </span>
                </td>
                <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                        <button onClick={() => handleOpenModal(user)} className="p-2 text-slate-400 dark:text-zinc-500 hover:text-blue-600 transition-colors"><Pencil size={18} /></button>
                        {user.id !== currentUser?.id && <button onClick={() => onDeleteUser(user.id)} className="p-2 text-slate-400 dark:text-zinc-500 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>}
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-3xl md:rounded-[3rem] shadow-2xl border dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh] transition-colors animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic leading-none">{editingId ? 'Editar Acesso' : 'Criar Novo Acesso'}</h3>
                <button onClick={handleCloseModal} className="text-slate-400 dark:text-zinc-500 hover:rotate-90 transition-transform"><X size={32} /></button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 md:p-8 space-y-4 md:space-y-6 bg-white dark:bg-zinc-950 transition-colors overflow-y-auto flex-1 custom-scrollbar">
                <div>
                   <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Nome Completo *</label>
                   <input className={inputClass('full_name')} value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} placeholder="Ex: Ana Souza" />
                </div>
                <div>
                   <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">E-mail Corporativo *</label>
                   <input type="email" className={inputClass('email')} value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="ana@empresa.com.br" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Usuário *</label>
                        <input className={inputClass('login_acesso')} value={formData.login_acesso || ''} onChange={e => setFormData({...formData, login_acesso: e.target.value})} placeholder="login" />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Senha *</label>
                        <div className="relative">
                          <input 
                            type={showPassword ? "text" : "password"} 
                            className={inputClass('senha_acesso')} 
                            value={formData.senha_acesso || ''} 
                            onChange={e => setFormData({...formData, senha_acesso: e.target.value})} 
                            placeholder="****" 
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Unidade operacional *</label>
                        <select 
                          className={inputClass('company_id')} 
                          value={formData.company_id || ''} 
                          onChange={e => {
                            const company = companies.find(c => c.id === e.target.value);
                            setFormData({
                                ...formData, 
                                company_id: e.target.value,
                                unidade: company?.nome_fantasia || company?.name || ''
                            });
                          }}
                        >
                            <option value="">SELECIONE A UNIDADE</option>
                            {companies.map(c => (
                              <option key={c.id} value={c.id}>{c.nome_fantasia || c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-black dark:text-white uppercase mb-1 ml-2">Foto de Perfil (URL)</label>
                        <input className={inputClass('photo_url')} value={formData.photo_url || ''} onChange={e => setFormData({...formData, photo_url: e.target.value})} placeholder="https://..." />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[9px] font-black text-black dark:text-white uppercase mb-1 ml-2">Telefone / WhatsApp</label>
                        <input className={inputClass('phone')} value={formData.phone || ''} onChange={e => setFormData({...formData, phone: phoneMask(e.target.value)})} placeholder="(00) 0 0000-0000" />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-black dark:text-white uppercase mb-1 ml-2">CPF</label>
                        <input className={inputClass('cpf')} value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: cpfMask(e.target.value)})} placeholder="000.000.000-00" />
                    </div>
                </div>

                <div className="space-y-4 p-6 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800">
                    <h4 className="text-[10px] font-black uppercase text-blue-600 mb-2 flex items-center gap-2"><MapPin size={12} /> Endereço Residencial</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="col-span-1">
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">CEP</label>
                            <input className={inputClass('cep')} value={formData.cep || ''} onChange={e => setFormData({...formData, cep: cepMask(e.target.value)})} placeholder="00000-000" />
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Logradouro</label>
                            <input className={inputClass('address_street')} value={formData.address_street || ''} onChange={e => setFormData({...formData, address_street: e.target.value})} placeholder="Rua, Av..." />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="col-span-1">
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Nº</label>
                            <input className={inputClass('address_number')} value={formData.address_number || ''} onChange={e => setFormData({...formData, address_number: e.target.value})} placeholder="123" />
                        </div>
                        <div className="col-span-1 sm:col-span-3">
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Bairro</label>
                            <input className={inputClass('address_neighborhood')} value={formData.address_neighborhood || ''} onChange={e => setFormData({...formData, address_neighborhood: e.target.value})} placeholder="Centro" />
                        </div>
                    </div>
                </div>

                <div className="col-span-full">
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Nível de Acesso (Cargo)</label>
                    <select 
                      className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none" 
                      value={formData.job_title || ''} 
                      onChange={e => {
                        const selectedRole = roleConfigs.find(r => r.name === e.target.value);
                        if (selectedRole) {
                          setFormData({
                            ...formData, 
                            job_title: selectedRole.name,
                            permissions: selectedRole.permissions,
                            role: selectedRole.base_role || 'ADMIN'
                          });
                        } else {
                          setFormData({...formData, job_title: e.target.value});
                        }
                      }}
                    >
                        <option value="">SELECIONE UM CARGO</option>
                        {[...roleConfigs].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')).map(rc => (
                          <option key={rc.id} value={rc.name}>{rc.name}</option>
                        ))}
                    </select>
                </div>
                {formData.permissions && formData.permissions.length > 0 && (
                  <div className="mt-4 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <label className="block text-[8px] font-black text-blue-400 uppercase mb-3">Abas e Permissões Liberadas (Gestão Global):</label>
                    <div className="flex flex-wrap gap-2">
                      {formData.permissions.map((p, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 rounded-lg text-[7px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800 shadow-sm flex items-center gap-1.5">
                          <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                          {VIEW_LABELS[p as any] || p.toString().replace(/-/g, ' ')}
                        </span>
                      ))}
                    </div>
                    <p className="text-[7px] font-black text-blue-300 uppercase mt-3 italic tracking-widest leading-relaxed">
                      Estas permissões são controladas centralmente na aba Gestão Global e sincronizadas automaticamente.
                    </p>
                  </div>
                )}

                {currentUser?.email === 'via.nicolau.sa@gmail.com' && (
                  <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 dark:border-yellow-900/30">
                    <input 
                      type="checkbox" 
                      id="is_full_admin"
                      className="w-5 h-5 rounded-lg border-2 border-yellow-400 text-yellow-500 focus:ring-yellow-400"
                      checked={formData.is_full_admin || false}
                      onChange={e => setFormData({...formData, is_full_admin: e.target.checked})}
                    />
                    <label htmlFor="is_full_admin" className="text-[10px] font-black text-yellow-700 dark:text-yellow-500 uppercase tracking-widest cursor-pointer">
                      Administrador (Full) - Acesso à Gestão de Assinaturas
                    </label>
                  </div>
                )}

                </div>

                <div className="p-6 md:p-8 border-t dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex gap-4 transition-colors">
                    <button type="button" onClick={handleCloseModal} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                    <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"><Save size={20}/> Gravar Acesso</button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;
