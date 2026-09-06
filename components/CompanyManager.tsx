import React, { useState, useMemo } from 'react';
import { Company, User, TicketBooth } from '../types';
import { Plus, Pencil, Trash2, X, Building2, Phone, Mail, Loader2, MapPin, Save, Search, Ticket, UserCheck, ShieldCheck } from 'lucide-react';
import { fetchAddress } from '../services/cep';
import { cnpjMask, phoneMask, cepMask, ieMask } from '../utils/masks';
import { motion, AnimatePresence } from 'framer-motion';

interface CompanyManagerProps {
  companies: Company[];
  ticketBooths: TicketBooth[];
  currentUser: User | null;
  users?: User[];
  onAddCompany: (company: Company) => void;
  onUpdateCompany: (company: Company) => void;
  onDeleteCompany: (id: string) => void;
  onAddBooth: (booth: TicketBooth) => void;
  onUpdateBooth: (booth: TicketBooth) => void;
  onDeleteBooth: (id: string) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

const CompanyManager: React.FC<CompanyManagerProps> = ({ 
    companies = [], 
    ticketBooths = [],
    users = [],
    onAddCompany, 
    onUpdateCompany, 
    onDeleteCompany, 
    onAddBooth,
    onUpdateBooth,
    onDeleteBooth,
    addToast 
}) => {
  const [activeTab, setActiveTab] = useState<'COMPANIES' | 'BOOTHS'>('COMPANIES');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [errors, setErrors] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState<Partial<Company>>({ 
    active: true, name: '', razao_social: '', nome_fantasia: '', cnpj: '', ie: '', cep: '', contact_email: '', contact_phone: ''
  });

  const [boothData, setBoothData] = useState<Partial<TicketBooth>>({
    active: true, name: '', cnpj: '', cep: '', address_street: '', address_number: '', address_neighborhood: '',
    address_city: '', address_state: '', address_complement: '', phone: '', email: '', booth_manager: ''
  });

  const filteredCompanies = useMemo(() => {
    return (companies || [])
      .filter(c => 
          (c.nome_fantasia || c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
          (c.razao_social || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
          (c.cnpj || '').includes(searchTerm)
      )
      .sort((a, b) => (a.nome_fantasia || a.name || '').localeCompare(b.nome_fantasia || b.name || ''));
  }, [companies, searchTerm]);

  const managerCollaborators = useMemo(() => {
    return (users || []).filter(u => 
      u.job_title && u.job_title.toLowerCase().includes('gerente')
    );
  }, [users]);

  const filteredBooths = useMemo(() => {
    return (ticketBooths || [])
        .filter(b => (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (b.cnpj || '').includes(searchTerm))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [ticketBooths, searchTerm]);

  const handleOpenModal = (item?: Company | TicketBooth) => {
    setErrors(new Set());
    if (activeTab === 'COMPANIES') {
        if (item) {
            setEditingId(item.id);
            setFormData({ ...item as Company });
        } else {
            setEditingId(null);
            setFormData({ 
                active: true, name: '', razao_social: '', nome_fantasia: '', cnpj: '', ie: '', cep: '', 
                address_street: '', address_number: '', address_neighborhood: '', 
                address_city: '', address_state: '', address_complement: '',
                contact_email: '', contact_phone: ''
            });
        }
    } else {
        if (item) {
            setEditingId(item.id);
            setBoothData({ ...item as TicketBooth });
        } else {
            setEditingId(null);
            setBoothData({
                active: true, name: '', cnpj: '', phone: '', email: '', cep: '',
                address_street: '', address_number: '', address_neighborhood: '',
                address_city: '', address_state: '', address_complement: '',
                booth_manager: '', company_id: companies.length > 0 ? companies[0].id : undefined
            });
        }
    }
    setIsModalOpen(true);
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = cepMask(e.target.value);
    if (activeTab === 'COMPANIES') setFormData(prev => ({ ...prev, cep: val }));
    else setBoothData(prev => ({ ...prev, cep: val })); 
    
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
        setIsLoadingCep(true);
        try {
            const data = await fetchAddress(clean);
            if (data) {
                const updates = { 
                    address_street: data.addressStreet, 
                    address_neighborhood: data.addressNeighborhood, 
                    address_city: data.addressCity, 
                    address_state: data.addressState 
                };
                if (activeTab === 'COMPANIES') setFormData(prev => ({ ...prev, ...updates }));
                else setBoothData(prev => ({ ...prev, ...updates }));
            }
        } finally {
            setIsLoadingCep(false);
        }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = new Set<string>();

    if (activeTab === 'COMPANIES') {
        if (!formData.razao_social) newErrors.add('razao_social');
        if (!formData.nome_fantasia) newErrors.add('nome_fantasia');
        if (!formData.cnpj) newErrors.add('cnpj');
        if (!formData.contact_phone) newErrors.add('contact_phone');
        if (!formData.contact_email) newErrors.add('contact_email');

        if (newErrors.size === 0) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (formData.contact_email && !emailRegex.test(formData.contact_email)) {
                newErrors.add('contact_email');
                addToast("Email inválido.", "error");
            }
        }

        if (newErrors.size > 0) { setErrors(newErrors); return; }
        
        const companyData = { ...formData, name: formData.nome_fantasia || '' } as Company;
        if (editingId) onUpdateCompany({ ...companyData, id: editingId });
        else onAddCompany(companyData);
    } else {
        if (!boothData.name) newErrors.add('name');
        if (!boothData.cnpj) newErrors.add('cnpj');
        if (!boothData.phone) newErrors.add('phone');
        if (!boothData.email) newErrors.add('email');

        if (newErrors.size > 0) { setErrors(newErrors); return; }

        if (editingId) onUpdateBooth({ ...boothData, id: editingId } as TicketBooth);
        else onAddBooth(boothData as TicketBooth);
    }
    
    setIsModalOpen(false);
  };

  const inputClass = (field: string) => `w-full px-5 py-4 border-2 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none transition-all ${errors.has(field) ? 'border-red-500 animate-shake' : 'border-slate-100 dark:border-zinc-800 focus:border-blue-500'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 transition-colors gap-6">
        <div className="flex-1 w-full">
            <div className="flex items-center gap-8 mb-6">
                <button 
                    onClick={() => setActiveTab('COMPANIES')}
                    className={`text-2xl font-black uppercase italic transition-all ${activeTab === 'COMPANIES' ? 'text-slate-900 dark:text-white scale-105 underline underline-offset-8 decoration-yellow-400' : 'text-slate-300 dark:text-zinc-700 hover:text-slate-500'}`}
                >
                    Empresas
                </button>
                <button 
                    onClick={() => setActiveTab('BOOTHS')}
                    className={`text-2xl font-black uppercase italic transition-all ${activeTab === 'BOOTHS' ? 'text-slate-900 dark:text-white scale-105 underline underline-offset-8 decoration-yellow-400' : 'text-slate-300 dark:text-zinc-700 hover:text-slate-500'}`}
                >
                    Guichês de Venda
                </button>
            </div>
            <div className="relative max-w-md">
                <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder={activeTab === 'COMPANIES' ? "Pesquisar por nome ou CNPJ..." : "Pesquisar guichês..."}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black outline-none dark:text-zinc-300 shadow-inner transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-all">
            <Plus size={20} /> {activeTab === 'COMPANIES' ? 'Nova Empresa' : 'Novo Guichê'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTab === 'COMPANIES' ? filteredCompanies.map(company => (
            <CompanyCard key={company.id} company={company} onEdit={() => handleOpenModal(company)} onDelete={() => onDeleteCompany(company.id)} isDeleting={deletingId === company.id} setDeletingId={setDeletingId} />
        )) : filteredBooths.map(booth => (
            <BoothCard key={booth.id} booth={booth} onEdit={() => handleOpenModal(booth)} onDelete={() => onDeleteBooth(booth.id)} isDeleting={deletingId === booth.id} setDeletingId={setDeletingId} />
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] border dark:border-zinc-800 overflow-hidden relative z-10 transition-colors">
              <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                  <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic leading-none">
                    {editingId ? (activeTab === 'COMPANIES' ? 'Editar Empresa' : 'Editar Guichê') : (activeTab === 'COMPANIES' ? 'Nova Empresa' : 'Novo Guichê')}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 dark:text-zinc-500 hover:rotate-90 transition-transform"><X size={32} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-zinc-950 transition-colors">
                {activeTab === 'COMPANIES' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Razão Social *</label>
                        <input className={inputClass('razao_social')} value={formData.razao_social || ''} onChange={e => setFormData({...formData, razao_social: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Nome Fantasia *</label>
                        <input className={inputClass('nome_fantasia')} value={formData.nome_fantasia || ''} onChange={e => setFormData({...formData, nome_fantasia: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">CNPJ *</label>
                        <input className={inputClass('cnpj')} value={formData.cnpj || ''} onChange={e => setFormData({...formData, cnpj: cnpjMask(e.target.value)})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Inscrição Estadual</label>
                        <input className={inputClass('ie')} value={formData.ie || ''} onChange={e => setFormData({...formData, ie: ieMask(e.target.value)})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Telefone *</label>
                        <input className={inputClass('contact_phone')} value={formData.contact_phone || ''} onChange={e => setFormData({...formData, contact_phone: phoneMask(e.target.value)})} />
                    </div>
                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Email Operacional *</label>
                        <input className={inputClass('contact_email')} value={formData.contact_email || ''} onChange={e => setFormData({...formData, contact_email: e.target.value})} />
                    </div>
                    <div className="col-span-full border-t border-slate-100 dark:border-zinc-800 pt-4">
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-4 ml-2">Endereço da Empresa</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">CEP *</label>
                                <input className={inputClass('cep')} value={formData.cep || ''} onChange={handleCepChange} placeholder="00.000-000" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Logradouro</label>
                                <input className={inputClass('address_street')} value={formData.address_street || ''} onChange={e => setFormData({...formData, address_street: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Número *</label>
                                <input className={inputClass('address_number')} value={formData.address_number || ''} onChange={e => setFormData({...formData, address_number: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Bairro</label>
                                <input className={inputClass('address_neighborhood')} value={formData.address_neighborhood || ''} onChange={e => setFormData({...formData, address_neighborhood: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Cidade</label>
                                <input className={inputClass('address_city')} value={formData.address_city || ''} onChange={e => setFormData({...formData, address_city: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Estado</label>
                                <input className={inputClass('address_state')} value={formData.address_state || ''} onChange={e => setFormData({...formData, address_state: e.target.value})} />
                            </div>
                            <div className="col-span-full hidden">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Complemento</label>
                                <input className={inputClass('address_complement')} value={formData.address_complement || ''} onChange={e => setFormData({...formData, address_complement: e.target.value})} />
                            </div>
                        </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Nome do Guichê *</label>
                        <input className={inputClass('name')} value={boothData.name || ''} onChange={e => setBoothData({...boothData, name: e.target.value})} />
                    </div>
                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Empresa Vinculada</label>
                        <select className={inputClass('company_id')} value={boothData.company_id || ''} onChange={e => setBoothData({...boothData, company_id: e.target.value})}>
                            <option value="">Selecione uma Empresa</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.nome_fantasia || c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">CNPJ do Guichê *</label>
                        <input className={inputClass('cnpj')} value={boothData.cnpj || ''} onChange={e => setBoothData({...boothData, cnpj: cnpjMask(e.target.value)})} placeholder="00.000.000/0000-00"/>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Gerente Responsável</label>
                        <select 
                            className={inputClass('booth_manager')} 
                            value={boothData.booth_manager || ''} 
                            onChange={e => setBoothData({...boothData, booth_manager: e.target.value})}
                        >
                            <option value="">Selecione um Gerente...</option>
                            {managerCollaborators.map(m => (
                                <option key={m.id} value={m.full_name || m.name || ''}>
                                    {m.full_name || m.name} ({m.job_title})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Telefone *</label>
                        <input className={inputClass('phone')} value={boothData.phone || ''} onChange={e => setBoothData({...boothData, phone: phoneMask(e.target.value)})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Email de Venda *</label>
                        <input className={inputClass('email')} value={boothData.email || ''} onChange={e => setBoothData({...boothData, email: e.target.value})} />
                    </div>
                    <div className="col-span-full border-t border-slate-100 dark:border-zinc-800 pt-4">
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-4 ml-2">Endereço da Agência</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">CEP *</label>
                                <input className={inputClass('cep')} value={boothData.cep || ''} onChange={handleCepChange} placeholder="00.000-000" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Logradouro</label>
                                <input className={inputClass('address_street')} value={boothData.address_street || ''} onChange={e => setBoothData({...boothData, address_street: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Número *</label>
                                <input className={inputClass('address_number')} value={boothData.address_number || ''} onChange={e => setBoothData({...boothData, address_number: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Bairro</label>
                                <input className={inputClass('address_neighborhood')} value={boothData.address_neighborhood || ''} onChange={e => setBoothData({...boothData, address_neighborhood: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Cidade</label>
                                <input className={inputClass('address_city')} value={boothData.address_city || ''} onChange={e => setBoothData({...boothData, address_city: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Estado</label>
                                <input className={inputClass('address_state')} value={boothData.address_state || ''} onChange={e => setBoothData({...boothData, address_state: e.target.value})} />
                            </div>
                            <div className="col-span-full hidden">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Complemento</label>
                                <input className={inputClass('address_complement')} value={boothData.address_complement || ''} onChange={e => setBoothData({...boothData, address_complement: e.target.value})} />
                            </div>
                        </div>
                    </div>
                  </div>
                )}

                <div className="p-8 border-t dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex gap-4 transition-colors">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest transition-all">Cancelar</button>
                    <button type="submit" className="flex-[2] py-4 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all transition-colors"><Save size={20}/> Salvar {activeTab === 'COMPANIES' ? 'Empresa' : 'Guichê'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CompanyCard = ({ company, onEdit, onDelete, isDeleting, setDeletingId }: any) => (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col h-full group hover:shadow-xl transition-all">
        <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl flex items-center justify-center text-indigo-600 transition-colors"><Building2 size={28} /></div>
            <div>
                <h3 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-xs truncate max-w-[150px] transition-colors">{company.nome_fantasia || company.name}</h3>
                <p className="text-[8px] font-mono text-slate-400 truncate max-w-[150px]">CNPJ: {company.cnpj}</p>
            </div>
        </div>
        <div className="space-y-1 text-[9px] text-slate-500 dark:text-zinc-400 font-bold uppercase flex-1 transition-colors">
            <p className="flex items-center gap-1"><MapPin size={12}/> {company.address_city} - {company.address_state}</p>
            <p className="flex items-center gap-1"><Phone size={12}/> {company.contact_phone}</p>
        </div>
        <div className="flex gap-2 pt-4 border-t border-slate-50 dark:border-zinc-800 justify-end mt-4 transition-colors">
            <button onClick={onEdit} className="p-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all"><Pencil size={18} /></button>
            {isDeleting ? (
                <button onClick={onDelete} className="px-4 py-2 bg-red-600 text-white text-[9px] font-black uppercase rounded-xl shadow-lg transition-all">SIm</button>
            ) : (
                <button onClick={() => setDeletingId(company.id)} className="p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"><Trash2 size={18} /></button>
            )}
        </div>
    </div>
);

const BoothCard = ({ booth, onEdit, onDelete, isDeleting, setDeletingId }: any) => (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col h-full group hover:shadow-xl transition-all">
        <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl flex items-center justify-center text-yellow-600 transition-colors"><Ticket size={28} /></div>
            <div>
                <h3 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-xs truncate max-w-[150px] transition-colors">{booth.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <ShieldCheck size={10} className="text-emerald-500" />
                    <p className="text-[7px] font-black text-slate-400 uppercase ring-1 ring-slate-100 px-1 rounded-sm">Guichê Homologado</p>
                </div>
            </div>
        </div>
        <div className="space-y-1 text-[9px] text-slate-500 dark:text-zinc-400 font-bold uppercase flex-1 transition-colors">
            <p className="flex items-center gap-1"><UserCheck size={12}/> {booth.booth_manager || 'SEM GERENTE'}</p>
            <p className="flex items-center gap-1"><MapPin size={12}/> {booth.address_city} - {booth.address_state}</p>
            <p className="flex items-center gap-1"><Phone size={12}/> {booth.phone}</p>
        </div>
        <div className="flex gap-2 pt-4 border-t border-slate-50 dark:border-zinc-800 justify-end mt-4 transition-colors">
            <button onClick={onEdit} className="p-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all"><Pencil size={18} /></button>
            {isDeleting ? (
                <button onClick={onDelete} className="px-4 py-2 bg-red-600 text-white text-[9px] font-black uppercase rounded-xl shadow-lg transition-all">Remover</button>
            ) : (
                <button onClick={() => setDeletingId(booth.id)} className="p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"><Trash2 size={18} /></button>
            )}
        </div>
    </div>
);

export default CompanyManager;
