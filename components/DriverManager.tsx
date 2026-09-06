
import React, { useState, useMemo, useRef } from 'react';
import { User, City, UserRole, RoleConfig, Company, UserFine, Trip, Vehicle } from '../types';
import { UserCircle, Pencil, Plus, X, Save, Trash2, Search, Timer, Eye, EyeOff, MapPin, Calendar, Heart, Camera, CreditCard, Loader2, Upload, Clock, Briefcase, Hash, QrCode, Phone, Droplet, UserCheck, RefreshCw, Mail, AlertTriangle, User as UserIcon, BusFront } from 'lucide-react';
import { phoneMask, cpfMask, cepMask } from '../utils/masks';
import { fetchAddress } from '../services/cep';
import { VIEW_LABELS } from '../constants';
import { generateUUID } from '../services/database';

interface DriverManagerProps {
  drivers: User[];
  cities: City[];
  companies: Company[];
  currentUser: User | null;
  roleConfigs: RoleConfig[];
  registrationPattern?: string;
  registrationTemplate?: string;
  onAddDriver: (driver: User) => void;
  onUpdateDriver: (driver: User) => void;
  onDeleteDriver: (id: string) => void;
  initialUserData?: Partial<User> | null;
  onClearInitialData?: () => void;
  userFines?: UserFine[];
  trips?: Trip[];
  vehicles?: Vehicle[];
  onAddFine?: (fine: UserFine) => void;
}

const SHIFTS = ['6x1', '5x1', '5x2', '12x36'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const LICENSE_TYPES = ['B', 'C', 'D', 'E'];

const IDCard: React.FC<{ user: User; companies: Company[]; onClose: () => void }> = ({ user, companies, onClose }) => {
    const [side, setSide] = useState<'front' | 'back'>('front');
    
    const nameParts = (user.full_name || user.name || 'COLABORADOR').split(' ');
    const displayName = nameParts.length > 1 
        ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
        : nameParts[0];

    const company = companies.find(c => c.id === user.company_id);
    const companyName = company?.nome_fantasia || company?.name || 'VIALIVRE GESTÃO';

    return (
        <div className="fixed inset-0 bg-slate-900/95 z-[300] flex flex-col items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
            <button onClick={onClose} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"><X size={40}/></button>
            
            <div 
                className="relative w-full max-w-[320px] aspect-[1/1.58] transition-all duration-700 preserve-3d cursor-pointer group" 
                onClick={() => setSide(side === 'front' ? 'back' : 'front')}
                style={{ perspective: '1000px' }}
            >
                <div 
                    className={`relative w-full h-full transition-transform duration-700 preserve-3d shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[2.5rem] ${side === 'back' ? 'rotate-y-180' : ''}`}
                    style={{ transformStyle: 'preserve-3d' }}
                >
                    {/* FRENTE */}
                    <div className="absolute inset-0 w-full h-full bg-white rounded-[2.5rem] border-4 border-yellow-400 overflow-hidden flex flex-col backface-hidden">
                        <div className="h-20 bg-slate-900 flex items-center justify-center border-b-4 border-yellow-400 px-4">
                            <h2 className="text-white font-black italic tracking-tighter text-lg uppercase text-center line-clamp-2">{companyName}</h2>
                        </div>
                        <div className="flex-1 p-6 flex flex-col items-center text-center">
                            <div className="w-32 h-32 rounded-3xl bg-slate-100 border-4 border-yellow-400 overflow-hidden mb-4 shadow-inner">
                                {user.photo_url ? <img src={user.photo_url} className="w-full h-full object-cover" alt="P"/> : <UserCircle size={128} className="text-slate-300 w-full h-full"/>}
                            </div>
                            <h3 className="text-2xl font-black uppercase text-slate-900 leading-tight mb-1">{displayName}</h3>
                            
                            <div className="flex items-center gap-2 mb-2">
                                <Hash size={12} className="text-slate-400" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CPF:</span>
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{user.cpf || '---'}</span>
                            </div>

                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4">{user.job_title || user.role}</p>
                            
                            <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center gap-2">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Matrícula Operacional</p>
                                <p className="text-lg font-black text-slate-900 font-mono tracking-tighter leading-none">{user.registration_id || '---'}</p>
                            </div>
                        </div>
                        <div className="h-6 bg-yellow-400 w-full mt-auto"></div>
                    </div>

                    {/* VERSO */}
                    <div 
                        className="absolute inset-0 w-full h-full bg-white rounded-[2.5rem] border-4 border-yellow-400 overflow-hidden flex flex-col backface-hidden rotate-y-180"
                        style={{ transform: 'rotateY(180deg)' }}
                    >
                        <div className="p-8 space-y-6 flex-1">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-red-50 text-red-500 rounded-2xl"><Droplet size={24}/></div>
                                    <div className="text-left">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">Tipo Sanguíneo</p>
                                        <p className="text-lg font-black text-slate-900 leading-none">{user.blood_type || '---'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl"><Phone size={24}/></div>
                                    <div className="text-left">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">Contato de Emergência</p>
                                        <p className="text-lg font-black text-slate-900 leading-none">{user.phone || '---'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl"><UserCheck size={24}/></div>
                                    <div className="text-left">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">Data de Admissão</p>
                                        <p className="text-lg font-black text-slate-900 leading-none">{user.admission_date ? new Date(user.admission_date).toLocaleDateString('pt-BR') : '---'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-4 flex flex-col items-center">
                                <div className="p-2 bg-white border-2 border-yellow-400 rounded-2xl shadow-sm">
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${user.id}`} className="w-24 h-24" alt="QR"/>
                                </div>
                                <p className="text-[10px] font-mono font-black text-slate-900 tracking-widest mt-2">{user.registration_id?.replace(/\D/g, '') || '00000000'}</p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-900 text-center">
                            <p className="text-[8px] text-white/40 font-black uppercase tracking-widest leading-relaxed">Infraestrutura ViaLivre Gestão Transportes • Validade Permanente</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="mt-12 flex flex-col items-center gap-4">
                <button 
                  onClick={() => setSide(side === 'front' ? 'back' : 'front')}
                  className="px-8 py-3 bg-white/10 text-white rounded-full font-black uppercase text-[9px] tracking-widest flex items-center gap-2 hover:bg-yellow-400 hover:text-slate-900 transition-all border border-white/20"
                >
                    <RefreshCw size={14}/> Girar Crachá
                </button>
                <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.3em] animate-pulse">Clique no cartão para interagir</p>
            </div>
        </div>
    );
};

const DriverManager: React.FC<DriverManagerProps> = ({ drivers = [], cities = [], companies = [], currentUser, roleConfigs = [], registrationPattern, registrationTemplate, onAddDriver, onUpdateDriver, onDeleteDriver, initialUserData, onClearInitialData, userFines = [], trips = [], vehicles = [], onAddFine }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [selectedForID, setSelectedForID] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isFineModalOpen, setIsFineModalOpen] = useState(false);
  const [fineFormData, setFineFormData] = useState<Partial<UserFine>>({
    status: 'PENDENTE',
    points: 0,
    amount: 0,
    date_time: new Date().toISOString().slice(0, 16)
  });

  const handleFineDateTimeChange = (val: string) => {
    setFineFormData(prev => {
        const next = { ...prev, date_time: val };
        
        // Find matching trip
        const selectedDate = val.split('T')[0];
        const selectedTime = val.split('T')[1];
        
        const matchingTrip = trips.find(t => 
            t.driver_id === editingId && 
            t.trip_date === selectedDate
            // Potentially check time window too, but date is a good start
        );

        if (matchingTrip) {
            next.trip_id = matchingTrip.id;
            next.vehicle_id = vehicles.find(v => v.prefix === matchingTrip.bus_number)?.id || next.vehicle_id;
        }

        return next;
    });
  };

  const handleSaveFine = () => {
    if (!fineFormData.infraction_notice || !fineFormData.date_time) {
        alert("Preencha os campos obrigatórios da multa.");
        return;
    }
    if (onAddFine && editingId) {
        onAddFine({
            due_date: new Date().toISOString().split('T')[0], // Default due date
            ...fineFormData,
            id: generateUUID(),
            user_id: editingId,
            created_at: new Date().toISOString()
        } as UserFine);
        setIsFineModalOpen(false);
        setFineFormData({
            status: 'PENDENTE',
            points: 0,
            amount: 0,
            date_time: new Date().toISOString().slice(0, 16)
        });
    }
  };

  const initialForm: Partial<User> = {
    full_name: '', cpf: '', pis: '', email: '', phone: '',
    job_title: '', role: 'DRIVER',
    work_municipality_id: '',
    login_acesso: '', senha_acesso: '',
    work_shift_type: '6x1', daily_hours_target: '08:00',
    standard_clock_in: '00:00', standard_clock_out: '00:00',
    standard_interval: '00:00',
    saturday_clock_in: '00:00', saturday_clock_out: '00:00',
    saturday_interval: '00:00',
    sunday_clock_in: '00:00', sunday_clock_out: '00:00',
    sunday_interval: '00:00',
    blood_type: '', photo_url: '', birth_date: '', admission_date: '',
    cep: '', address_street: '', address_number: '', address_neighborhood: '', address_city: '', address_state: '',
    license_type: '', license_validity: '',
    permissions: []
  };

  const [formData, setFormData] = useState<Partial<User>>(initialForm);

  const [editingOccurrenceId, setEditingOccurrenceId] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialUserData) {
      const roleConf = roleConfigs.find(rc => rc.name === initialUserData.job_title);
      setFormData({ 
        ...initialForm, 
        ...initialUserData,
        permissions: roleConf ? roleConf.permissions : (initialUserData.permissions || [])
      });
      setOccurrences(initialUserData.occurrences || []);
      setEditingOccurrenceId(null);
      setEditingId(null);
      setValidationAttempted(false);
      setIsModalOpen(true);
    }
  }, [initialUserData, roleConfigs]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (onClearInitialData) onClearInitialData();
  };
  const [activeTab, setActiveTab] = useState<'BASIC' | 'ADDRESS' | 'SHIFT' | 'OCCURRENCES' | 'VIOLATIONS'>('BASIC');
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [newOccurrence, setNewOccurrence] = useState({ type: 'FALTA', date: new Date().toISOString().split('T')[0], description: '', hours_lost: '00:00', is_justified: false });

  const cleanCPF = (val: string) => val.replace(/\D/g, '');

  const filteredDrivers = useMemo(() => {
    return (drivers || [])
      .filter(d => 
        (d.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (d.registration_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        cleanCPF(d.cpf || '').includes(cleanCPF(searchTerm)) ||
        (d.license_type || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [drivers, searchTerm]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
        alert("Por favor, selecione apenas arquivos de imagem.");
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        setFormData(prev => ({ ...prev, photo_url: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData(initialForm);
    setOccurrences([]);
    setEditingOccurrenceId(null);
    setNewOccurrence({ type: 'FALTA', date: new Date().toISOString().split('T')[0], description: '', hours_lost: '00:00', is_justified: false });
    setValidationAttempted(false);
    setIsModalOpen(true);
  };

  const handleEdit = (driver: User) => {
    setEditingId(driver.id);
    const roleConf = roleConfigs.find(rc => rc.name === driver.job_title);
    setFormData({ 
        ...driver,
        permissions: roleConf ? roleConf.permissions : (driver.permissions || [])
    });
    setOccurrences(driver.occurrences || []);
    setEditingOccurrenceId(null);
    setNewOccurrence({ type: 'FALTA', date: new Date().toISOString().split('T')[0], description: '', hours_lost: '00:00', is_justified: false });
    setValidationAttempted(false);
    setIsModalOpen(true);
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = cepMask(e.target.value);
    setFormData(prev => ({ ...prev, cep: val }));
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsLoadingCep(true);
      try {
        const data = await fetchAddress(clean);
        if (data) {
          setFormData(prev => ({ 
            ...prev, 
            address_street: data.addressStreet, 
            address_neighborhood: data.addressNeighborhood, 
            address_city: data.addressCity, 
            address_state: data.addressState 
          }));
        }
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const handleSave = () => {
    setValidationAttempted(true);

    const isDriverRole = formData.job_title === 'Motorista Urbano' || formData.job_title === 'Motorista Rodoviário';
    
    if (isDriverRole) {
      if (!formData.license_type || !formData.license_validity) {
        alert("Para motoristas, os campos Tipo CNH e Validade CNH são obrigatórios.");
        return;
      }
    }

    const selectedRole = roleConfigs.find(r => r.name === formData.job_title);
    let role: UserRole = selectedRole?.base_role || 'DRIVER';
    
    // Fallback for legacy or if not found in configs
    if (!selectedRole) {
      const title = formData.job_title || '';
      if (title.includes("Fiscal")) role = 'FISCAL';
      else if (title.includes("Mecânico")) role = 'MECHANIC';
      else if (title.includes("Recursos Humanos")) role = 'RH';
      else if (title.includes("Guichê")) role = 'TICKET_AGENT';
      else if (title.includes("Administrador")) role = 'ADMIN';
      else if (title.includes("Cobrador")) role = 'CONDUCTOR';
      else if (title.includes("Motorista")) role = 'DRIVER';
    }

    const payload = { ...formData, role, occurrences } as User;
    
    // daily_hours_target validation
    if (payload.daily_hours_target) {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(payload.daily_hours_target)) {
            alert("Formato de Carga Horária Diária Meta inválido. Use HH:MM.");
            return;
        }
    }
    
    if (editingId) onUpdateDriver({ ...payload, id: editingId });
    else onAddDriver({ ...payload, id: generateUUID() });
    
    setIsModalOpen(false);
  };

  const inputClass = (field: string) => {
    const isDriverRole = formData.job_title === 'Motorista Urbano' || formData.job_title === 'Motorista Rodoviário';
    const isRequiredDriverField = isDriverRole && (field === 'license_type' || field === 'license_validity');
    const value = formData[field as keyof User];
    const isMissing = !value || (typeof value === 'string' && value.trim() === '');

    return `w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl font-bold dark:text-zinc-100 outline-none transition-all border-2 ${
      validationAttempted && isMissing && isRequiredDriverField ? 'border-red-500 animate-shake' : 'border-slate-50 dark:border-zinc-800 focus:border-yellow-400'
    }`;
  };

  return (
    <div className="space-y-6 animate-in fade-in transition-all">
      {selectedForID && <IDCard user={selectedForID} companies={companies} onClose={() => setSelectedForID(null)} />}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 gap-4 transition-colors">
        <div className="flex-1 w-full">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none">Colaboradores</h2>
            <div className="mt-6 relative max-w-md">
                <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Pesquisar por nome, CPF ou habilitação..." 
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black outline-none shadow-inner dark:text-zinc-300 transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        <button onClick={handleOpenNew} className="bg-yellow-400 text-slate-900 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-yellow-500 active:scale-95 transition-all border-2 border-slate-900"><Plus size={18} /> Novo Cadastro</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDrivers.map(driver => (
          <div key={driver.id} className="w-full">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm group hover:shadow-xl transition-all relative overflow-hidden h-full">
              <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden border-2 border-slate-50 dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-sm">
                      {driver.photo_url ? <img src={driver.photo_url} className="w-full h-full object-cover" alt="Perfil" /> : <UserCircle size={32} className="text-slate-300 dark:text-zinc-600"/>}
                  </div>
                  <div className="flex-1 overflow-hidden">
                      <h3 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-xs truncate leading-tight transition-colors">{driver.full_name}</h3>
                      <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-1">{driver.job_title}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                          <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 px-3 py-1 rounded-lg">
                              <Timer size={12} className="text-yellow-600" />
                              <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight">Escala: {driver.work_shift_type || '6x1'}</span>
                          </div>
                          {driver.license_validity && new Date(driver.license_validity) < new Date() && (
                              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-red-600 text-white animate-pulse shadow-sm">
                                  <AlertTriangle size={12} />
                                  <span className="text-[9px] font-black uppercase tracking-tight">CNH Vencida</span>
                              </div>
                          )}
                          {(() => {
                              const points = userFines
                                .filter(f => f.user_id === driver.id && f.status !== 'RECURSO')
                                .reduce((acc, f) => acc + (f.points || 0), 0);
                              const isBlocked = driver.cnh_limit && points >= driver.cnh_limit;
                              
                              return (
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${isBlocked ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                    <AlertTriangle size={12} />
                                    <span className="text-[9px] font-black uppercase tracking-tight">Pontos: {points}</span>
                                </div>
                              );
                          })()}
                      </div>
                  </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800 transition-colors items-center">
                  <button onClick={() => setSelectedForID(driver)} className="py-3 bg-slate-900 text-white hover:bg-black rounded-xl font-black text-[9px] uppercase transition-all flex items-center justify-center gap-2"><CreditCard size={14}/> Crachá</button>
                  <button onClick={() => handleEdit(driver)} className="py-3 bg-blue-50 dark:bg-blue-900/10 text-blue-600 hover:bg-blue-100 rounded-xl font-black text-[9px] uppercase transition-all">Editar</button>
                  
                  {deletingId === driver.id ? (
                    <div className="flex gap-1 animate-in fade-in slide-in-from-right-2">
                      <button 
                        onClick={() => { onDeleteDriver(driver.id); setDeletingId(null); }} 
                        className="px-2 py-2 bg-red-600 text-white text-[8px] font-black uppercase rounded-lg shadow-lg active:scale-95 transition-all"
                      >
                        Sim
                      </button>
                      <button 
                        onClick={() => setDeletingId(null)} 
                        className="px-2 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[8px] font-black uppercase rounded-lg hover:bg-slate-200 transition-all"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setDeletingId(driver.id)} 
                      className="py-3 bg-red-50 dark:bg-red-900/10 text-red-600 hover:bg-red-100 rounded-xl font-black text-[9px] uppercase transition-all"
                      title="Excluir Colaborador"
                    >
                      Excluir
                    </button>
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] border dark:border-zinc-800 overflow-hidden transition-colors animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                <div className="flex items-center gap-6">
                    <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic leading-none">{editingId ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
                    <div className="flex bg-slate-200 dark:bg-zinc-800 p-1 rounded-2xl">
                        <button onClick={() => setActiveTab('BASIC')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'BASIC' ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}>
                          <UserIcon size={14} /> Básico
                        </button>
                        <button onClick={() => setActiveTab('ADDRESS')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'ADDRESS' ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}>
                          <MapPin size={14} /> Endereço
                        </button>
                        <button onClick={() => setActiveTab('SHIFT')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'SHIFT' ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}>
                          <Timer size={14} /> Turno
                        </button>
                        <button onClick={() => setActiveTab('OCCURRENCES')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'OCCURRENCES' ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}>
                          <Clock size={14} /> Ocorrências
                        </button>
                        <button onClick={() => setActiveTab('VIOLATIONS')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'VIOLATIONS' ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}>
                          <AlertTriangle size={14} /> Multas
                        </button>
                    </div>
                </div>
                <button onClick={handleCloseModal} className="text-slate-400 hover:rotate-90 transition-transform"><X size={32} /></button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-zinc-950 transition-colors">
                {activeTab === 'BASIC' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <h4 className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-4 flex items-center gap-2"><UserCircle size={16}/> Dados Básicos & Documentação</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2">
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Nome Completo</label>
                          <input className={inputClass('full_name')} value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} placeholder="Ex: Ana Souza" />
                      </div>
                      <div className="row-span-3">
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Foto de Perfil</label>
                          <div 
                            onDragOver={handleDragOver}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full aspect-[4/5] rounded-[2rem] border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden relative ${
                                isDragging ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' : formData.photo_url ? 'border-emerald-400' : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900'
                            }`}
                          >
                            {formData.photo_url ? (
                                <>
                                    <img src={formData.photo_url} className="w-full h-full object-cover" alt="Preview" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Camera className="text-white" size={32} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Upload className="text-slate-400 mb-2" size={32} />
                                    <p className="text-[10px] font-black text-slate-400 uppercase text-center px-4">Arraste ou clique aqui para enviar</p>
                                </>
                            )}
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">CPF</label>
                          <input 
                            className={inputClass('cpf')} 
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
                      <div>
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Cargo</label>
                          <div className="relative group">
                            <Briefcase className="absolute left-4 top-4 text-slate-400 group-focus-within:text-yellow-500 transition-colors" size={18} />
                            <select 
                              className={`${inputClass('job_title')} pl-12 appearance-none cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-all`} 
                              value={formData.job_title || ''} 
                              onChange={e => {
                                const selectedRole = roleConfigs.find(r => r.name === e.target.value);
                                setFormData({
                                  ...formData, 
                                  job_title: e.target.value,
                                  permissions: selectedRole?.permissions || []
                                });
                              }}
                            >
                              <option value="">SELECIONE UM CARGO</option>
                              {roleConfigs.map(role => (
                                <option key={role.id} value={role.name}>{role.name}</option>
                              ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-yellow-500 transition-colors">
                              <Plus size={14} className="rotate-45" />
                            </div>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Matrícula Interna</label>
                          <div className="relative flex gap-2">
                            <div className="relative flex-1">
                                <Hash className="absolute left-4 top-4 text-slate-400" size={18} />
                                <input 
                                  className={`${inputClass('registration_id')} pl-12`} 
                                  value={formData.registration_id || ''} 
                                  onChange={e => setFormData({...formData, registration_id: e.target.value.toUpperCase()})} 
                                  placeholder={registrationPattern || "Ex: FLX-001"} 
                                />
                            </div>
                            <button 
                                type="button"
                                onClick={() => {
                                    let generated = registrationTemplate || 'FLX-{M}{Y}{R}';
                                    
                                    // {M} = Município (ID ou código se disponível)
                                    const municipality = cities.find(c => c.id === formData.work_municipality_id);
                                    const mCode = municipality?.code ? String(municipality.code).slice(-1) : '0';
                                    
                                    // {Y} = Ano Admissão (últimos 2 dígitos)
                                    const year = formData.admission_date ? formData.admission_date.split('-')[0].slice(-2) : new Date().getFullYear().toString().slice(-2);
                                    
                                    // {R} = Aleatório (4 dígitos)
                                    const random = Math.floor(1000 + Math.random() * 9000);
                                    
                                    generated = generated.replace('{M}', mCode);
                                    generated = generated.replace('{Y}', year);
                                    generated = generated.replace('{R}', String(random));
                                    
                                    setFormData({...formData, registration_id: generated});
                                }}
                                className="px-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase hover:bg-black transition-all"
                                title="Gerar Matrícula Dinâmica"
                            >
                                Gerar
                            </button>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Data de Nascimento</label>
                          <input type="date" className={inputClass('birth_date')} value={formData.birth_date || ''} onChange={e => setFormData({...formData, birth_date: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Tipo Sanguíneo</label>
                          <select className={inputClass('blood_type')} value={formData.blood_type || ''} onChange={e => setFormData({...formData, blood_type: e.target.value})}>
                              <option value="">Selecione...</option>
                              {BLOOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Data de Admissão</label>
                          <input type="date" className={inputClass('admission_date')} value={formData.admission_date || ''} onChange={e => setFormData({...formData, admission_date: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Data de Demissão</label>
                          <input type="date" className={inputClass('resignation_date')} value={formData.resignation_date || ''} onChange={e => setFormData({...formData, resignation_date: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Empresa Atuante</label>
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
                              <option value="">SELECIONE A EMPRESA</option>
                              {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.nome_fantasia || c.name}</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Cidade de Atuação</label>
                          <select 
                            className={inputClass('work_municipality_id')} 
                            value={formData.work_municipality_id || ''} 
                            onChange={e => setFormData({...formData, work_municipality_id: e.target.value})}
                          >
                              <option value="">SELECIONE A CIDADE</option>
                              {cities.map(city => (
                                <option key={city.id} value={city.id}>{city.name}</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">E-mail Corporativo</label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-4 text-slate-400" size={18} />
                            <input className={`${inputClass('email')} pl-12`} value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@empresa.com" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Telefone Pessoal</label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-4 text-slate-400" size={18} />
                            <input className={`${inputClass('phone')} pl-12`} value={formData.phone || ''} onChange={e => setFormData({...formData, phone: phoneMask(e.target.value)})} placeholder="(00) 0 0000-0000" />
                          </div>
                      </div>

                      {formData.permissions && formData.permissions.length > 0 && (
                        <div className="md:col-span-3 mt-4 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                          <label className="block text-[8px] font-black text-blue-400 uppercase mb-3">Abas e Permissões Liberadas (Gestão Global):</label>
                          <div className="flex flex-wrap gap-2">
                            {formData.permissions.map((p, idx) => (
                              <span key={idx} className="px-3 py-1.5 bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 rounded-lg text-[7px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800 shadow-sm flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                {p.toString().replace(/-/g, ' ')}
                              </span>
                            ))}
                          </div>
                          <p className="text-[7px] font-black text-blue-300 uppercase mt-3 italic tracking-widest leading-relaxed">
                            Estas permissões são controladas centralmente na aba Gestão Global e sincronizadas automaticamente com este colaborador.
                          </p>
                        </div>
                      )}

                      {(formData.job_title === 'Motorista Urbano' || formData.job_title === 'Motorista Rodoviário') && (
                        <>
                          <div className="animate-in slide-in-from-left-4 duration-300">
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Categoria CNH *</label>
                              <select className={inputClass('license_type')} value={formData.license_type || ''} onChange={e => setFormData({...formData, license_type: e.target.value})}>
                                  <option value="">SELECIONE...</option>
                                  {LICENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                          </div>
                          <div className="animate-in slide-in-from-left-4 duration-300">
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Validade CNH *</label>
                              <input type="date" className={inputClass('license_validity')} value={formData.license_validity || ''} onChange={e => setFormData({...formData, license_validity: e.target.value})} />
                          </div>
                        </>
                      )}
                  </div>
                </div>
                )}

                {activeTab === 'ADDRESS' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <h4 className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-4 flex items-center gap-2"><MapPin size={16}/> Endereço & Contato</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">CEP</label>
                          <div className="relative">
                            <input className={inputClass('cep')} value={formData.cep || ''} onChange={handleCepChange} placeholder="00.000-000" />
                            {isLoadingCep && <Loader2 className="absolute right-4 top-4 animate-spin text-yellow-500" size={18}/>}
                          </div>
                      </div>
                      <div className="md:col-span-2">
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Logradouro</label>
                          <input className={inputClass('address_street')} value={formData.address_street || ''} onChange={e => setFormData({...formData, address_street: e.target.value})} placeholder="Rua, Av..." />
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Número</label>
                          <input className={inputClass('address_number')} value={formData.address_number || ''} onChange={e => setFormData({...formData, address_number: e.target.value})} placeholder="123" />
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Complemento</label>
                          <input className={inputClass('address_complement')} value={formData.address_complement || ''} onChange={e => setFormData({...formData, address_complement: e.target.value})} placeholder="Apto, Bloco..." />
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Bairro</label>
                          <input className={inputClass('address_neighborhood')} value={formData.address_neighborhood || ''} onChange={e => setFormData({...formData, address_neighborhood: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Cidade</label>
                          <input className={inputClass('address_city')} value={formData.address_city || ''} onChange={e => setFormData({...formData, address_city: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">UF</label>
                          <input className={inputClass('address_state')} value={formData.address_state || ''} onChange={e => setFormData({...formData, address_state: e.target.value})} maxLength={2} />
                      </div>
                      <div className="md:col-span-3 pt-6 border-t border-slate-100 dark:border-zinc-800">
                          <h4 className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-4 flex items-center gap-2"><CreditCard size={16}/> Segurança Operacional</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Limite Máximo de Pontos CNH</label>
                                  <input 
                                    type="number" 
                                    className={inputClass('cnh_limit')} 
                                    value={formData.cnh_limit || ''} 
                                    onChange={e => setFormData({...formData, cnh_limit: Number(e.target.value)})} 
                                    placeholder="Ex: 20 ou 40"
                                  />
                                  <p className="text-[8px] text-slate-400 mt-1 ml-2 uppercase font-bold italic">O motorista será bloqueado na escala se atingir este valor.</p>
                              </div>
                              <div className="bg-slate-50 dark:bg-zinc-900 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 flex flex-col justify-center">
                                  <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Pontos Atuais na CNH</p>
                                  <p className={`text-2xl font-black ${
                                      (formData.cnh_limit && (userFines.filter(f => f.user_id === formData.id && f.status !== 'RECURSO').reduce((acc, f) => acc + (f.points || 0), 0) >= formData.cnh_limit)) ? 'text-red-500' : 'text-slate-900 dark:text-white'
                                  }`}>
                                      {userFines
                                        .filter(f => f.user_id === formData.id && f.status !== 'RECURSO')
                                        .reduce((acc, f) => acc + (f.points || 0), 0)}
                                  </p>
                              </div>
                          </div>
                      </div>
                  </div>
                </div>
                )}

                {activeTab === 'SHIFT' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-8">
                  <h4 className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-4 flex items-center gap-2"><Timer size={16}/> Configuração de Jornada de Trabalho</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 space-y-4">
                          <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-200 dark:border-zinc-800 pb-3">Tipo de Escala</p>
                          <div className="grid grid-cols-2 gap-3">
                              {SHIFTS.map(shift => (
                                  <button 
                                      key={shift}
                                      onClick={() => setFormData({...formData, work_shift_type: shift as any})}
                                      className={`py-4 rounded-2xl font-black text-xs transition-all border-2 ${
                                          formData.work_shift_type === shift 
                                              ? 'bg-yellow-400 border-slate-900 text-slate-900 shadow-lg' 
                                              : 'bg-white dark:bg-zinc-800 border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-yellow-200'
                                      }`}
                                  >
                                      {shift}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 space-y-6 md:col-span-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-200 dark:border-zinc-800 pb-3">Dias Úteis</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Entrada</label>
                                            <input type="time" className={inputClass('standard_clock_in')} value={formData.standard_clock_in || ''} onChange={e => setFormData({...formData, standard_clock_in: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Saída</label>
                                            <input type="time" className={inputClass('standard_clock_out')} value={formData.standard_clock_out || ''} onChange={e => setFormData({...formData, standard_clock_out: e.target.value})} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Intervalo (Horas)</label>
                                            <input type="time" className={inputClass('standard_interval')} value={formData.standard_interval || ''} onChange={e => setFormData({...formData, standard_interval: e.target.value})} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-200 dark:border-zinc-800 pb-3">Sábado</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Entrada</label>
                                            <input type="time" className={inputClass('saturday_clock_in')} value={formData.saturday_clock_in || ''} onChange={e => setFormData({...formData, saturday_clock_in: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Saída</label>
                                            <input type="time" className={inputClass('saturday_clock_out')} value={formData.saturday_clock_out || ''} onChange={e => setFormData({...formData, saturday_clock_out: e.target.value})} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Intervalo (Horas)</label>
                                            <input type="time" className={inputClass('saturday_interval')} value={formData.saturday_interval || ''} onChange={e => setFormData({...formData, saturday_interval: e.target.value})} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-200 dark:border-zinc-800 pb-3">Dom/Feriados</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Entrada</label>
                                            <input type="time" className={inputClass('sunday_clock_in')} value={formData.sunday_clock_in || ''} onChange={e => setFormData({...formData, sunday_clock_in: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Saída</label>
                                            <input type="time" className={inputClass('sunday_clock_out')} value={formData.sunday_clock_out || ''} onChange={e => setFormData({...formData, sunday_clock_out: e.target.value})} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Intervalo (Horas)</label>
                                            <input type="time" className={inputClass('sunday_interval')} value={formData.sunday_interval || ''} onChange={e => setFormData({...formData, sunday_interval: e.target.value})} />
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-1 md:col-span-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Carga Horária Diária Meta</label>
                                    <input type="time" className={inputClass('daily_hours_target')} value={formData.daily_hours_target || ''} onChange={e => setFormData({...formData, daily_hours_target: e.target.value})} />
                                </div>
                            </div>
                      </div>
                  </div>
                </div>
                )}

                {activeTab === 'OCCURRENCES' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-8">
                  <div className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800">
                    <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6">
                      {editingOccurrenceId ? "Editar Ocorrência" : "Nova Ocorrência"}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Tipo</label>
                        <select 
                          className="w-full px-4 py-3 bg-white dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border-2 border-slate-100 dark:border-zinc-700 focus:border-yellow-400"
                          value={newOccurrence.type}
                          onChange={e => setNewOccurrence({...newOccurrence, type: e.target.value})}
                        >
                          <option value="ADVERTENCIA">ADVERTÊNCIA</option>
                          <option value="ATESTADO">ATESTADO MÉDICO</option>
                          <option value="FALTA">FALTA</option>
                          <option value="ATRASO">ATRASO</option>
                          <option value="SUSPENSAO">SUSPENSÃO</option>
                          <option value="OUTROS">OUTROS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Data</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-3 bg-white dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border-2 border-slate-100 dark:border-zinc-700 focus:border-yellow-400"
                          value={newOccurrence.date}
                          onChange={e => setNewOccurrence({...newOccurrence, date: e.target.value})}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Descrição / Motivo</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 bg-white dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border-2 border-slate-100 dark:border-zinc-700 focus:border-yellow-400"
                          placeholder="Detalhes da ocorrência..."
                          value={newOccurrence.description}
                          onChange={e => setNewOccurrence({...newOccurrence, description: e.target.value})}
                        />
                      </div>
                      {newOccurrence.type === 'ATRASO' && (
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Horas Perdidas</label>
                          <input 
                            type="time" 
                            className="w-full px-4 py-3 bg-white dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border-2 border-slate-100 dark:border-zinc-700 focus:border-yellow-400"
                            value={newOccurrence.hours_lost}
                            onChange={e => setNewOccurrence({...newOccurrence, hours_lost: e.target.value})}
                          />
                        </div>
                      )}
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer mb-3 ml-2">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-yellow-400 focus:ring-yellow-400"
                            checked={newOccurrence.is_justified}
                            onChange={e => setNewOccurrence({...newOccurrence, is_justified: e.target.checked})}
                          />
                          <span className="text-[9px] font-black text-slate-500 uppercase">Justificado</span>
                        </label>
                      </div>
                      <div className="md:col-span-4 flex justify-end gap-2">
                        {editingOccurrenceId && (
                          <button 
                            type="button"
                            onClick={() => {
                              setNewOccurrence({ type: 'FALTA', date: new Date().toISOString().split('T')[0], description: '', hours_lost: '00:00', is_justified: false });
                              setEditingOccurrenceId(null);
                            }}
                            className="bg-slate-200 text-slate-705 dark:bg-zinc-800 dark:text-zinc-300 px-6 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-slate-300 dark:hover:bg-zinc-700 transition-all border border-transparent"
                          >
                            Cancelar
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            if (!newOccurrence.description) return alert("Preencha a descrição.");
                            if (editingOccurrenceId) {
                              setOccurrences(occurrences.map(o => o.id === editingOccurrenceId ? { ...o, ...newOccurrence } : o));
                            } else {
                              setOccurrences([...occurrences, { ...newOccurrence, id: Date.now().toString() }]);
                            }
                            setNewOccurrence({ type: 'FALTA', date: new Date().toISOString().split('T')[0], description: '', hours_lost: '00:00', is_justified: false });
                            setEditingOccurrenceId(null);
                          }}
                          className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-black transition-all"
                        >
                          {editingOccurrenceId ? "Salvar Alterações" : "Adicionar Ocorrência"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Histórico de Ocorrências</h4>
                    {occurrences.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 dark:bg-zinc-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-zinc-800">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Nenhuma ocorrência registrada</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {occurrences.map(occ => (
                          <div key={occ.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${
                                occ.type === 'ADVERTENCIA' ? 'bg-orange-100 text-orange-600' :
                                occ.type === 'ATESTADO' ? 'bg-blue-100 text-blue-600' :
                                occ.type === 'FALTA' ? 'bg-red-100 text-red-600' :
                                occ.type === 'ATRASO' ? 'bg-yellow-100 text-yellow-600' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {occ.type.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">{occ.type}</span>
                                  {occ.is_justified && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded text-[7px] font-black uppercase">Justificado</span>}
                                </div>
                                <p className="text-[9px] text-slate-500 uppercase font-bold">{new Date(occ.date).toLocaleDateString('pt-BR')} • {occ.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => {
                                  setEditingOccurrenceId(occ.id);
                                  setNewOccurrence({
                                    type: occ.type,
                                    date: occ.date,
                                    description: occ.description,
                                    hours_lost: occ.hours_lost || '00:00',
                                    is_justified: occ.is_justified || false
                                  });
                                }} 
                                className="p-2 text-slate-300 hover:text-yellow-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="Editar"
                              >
                                <Pencil size={16} />
                              </button>
                              <button 
                                onClick={() => {
                                  if (editingOccurrenceId === occ.id) {
                                    setNewOccurrence({ type: 'FALTA', date: new Date().toISOString().split('T')[0], description: '', hours_lost: '00:00', is_justified: false });
                                    setEditingOccurrenceId(null);
                                  }
                                  setOccurrences(occurrences.filter(o => o.id !== occ.id));
                                }} 
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="Excluir"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                )}

                {activeTab === 'VIOLATIONS' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-yellow-600 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={16}/> Histórico de Infrações de Trânsito</h4>
                    <button 
                        onClick={() => setIsFineModalOpen(true)}
                        className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center gap-2 hover:bg-black transition-all"
                    >
                        <Plus size={14}/> Lançar Multa
                    </button>
                  </div>
                  
                  {isFineModalOpen && (
                    <div className="bg-slate-50 dark:bg-zinc-900 p-8 rounded-[2.5rem] border-2 border-slate-200 dark:border-zinc-800 space-y-6 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex justify-between items-center mb-4">
                            <h5 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Formulário de Lançamento</h5>
                            <button onClick={() => setIsFineModalOpen(false)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Data e Hora da Infração *</label>
                                <input 
                                    type="datetime-local" 
                                    className="w-full px-5 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-bold dark:text-zinc-100 outline-none border-2 border-white dark:border-zinc-700 focus:border-yellow-400"
                                    value={fineFormData.date_time}
                                    onChange={e => handleFineDateTimeChange(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Auto de Infração *</label>
                                <input 
                                    type="text" 
                                    className="w-full px-5 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-bold dark:text-zinc-100 outline-none border-2 border-white dark:border-zinc-700 focus:border-yellow-400"
                                    placeholder="Ex: A0001234"
                                    value={fineFormData.infraction_notice || ''}
                                    onChange={e => setFineFormData({...fineFormData, infraction_notice: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Veículo (Automático se houver viagem)</label>
                                <select 
                                    className="w-full px-5 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-bold dark:text-zinc-100 outline-none border-2 border-white dark:border-zinc-700 focus:border-yellow-400"
                                    value={fineFormData.vehicle_id || ''}
                                    onChange={e => setFineFormData({...fineFormData, vehicle_id: e.target.value})}
                                >
                                    <option value="">Selecione...</option>
                                    {vehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.prefix} - {v.plate}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2 lg:col-span-1">
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Viagem Associada</label>
                                <select 
                                    className="w-full px-5 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-bold dark:text-zinc-100 outline-none border-2 border-white dark:border-zinc-700 focus:border-yellow-400"
                                    value={fineFormData.trip_id || ''}
                                    onChange={e => setFineFormData({...fineFormData, trip_id: e.target.value})}
                                >
                                    <option value="">Selecione...</option>
                                    {trips.filter(t => t.driver_id === editingId).map(t => (
                                        <option key={t.id} value={t.id}>{t.trip_date} - {t.departure_time} ({t.bus_number})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Valor da Multa (R$)</label>
                                <input 
                                    type="number" 
                                    className="w-full px-5 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-bold dark:text-zinc-100 outline-none border-2 border-white dark:border-zinc-700 focus:border-yellow-400"
                                    value={fineFormData.amount || ''}
                                    onChange={e => setFineFormData({...fineFormData, amount: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Pontos na CNH</label>
                                <input 
                                    type="number" 
                                    className="w-full px-5 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-bold dark:text-zinc-100 outline-none border-2 border-white dark:border-zinc-700 focus:border-yellow-400"
                                    value={fineFormData.points || ''}
                                    onChange={e => setFineFormData({...fineFormData, points: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Vencimento</label>
                                <input 
                                    type="date" 
                                    className="w-full px-5 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-bold dark:text-zinc-100 outline-none border-2 border-white dark:border-zinc-700 focus:border-yellow-400"
                                    value={fineFormData.due_date || ''}
                                    onChange={e => setFineFormData({...fineFormData, due_date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Status</label>
                                <select 
                                    className="w-full px-5 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-bold dark:text-zinc-100 outline-none border-2 border-white dark:border-zinc-700 focus:border-yellow-400"
                                    value={fineFormData.status || 'PENDENTE'}
                                    onChange={e => setFineFormData({...fineFormData, status: e.target.value as any})}
                                >
                                    <option value="PENDENTE">PENDENTE</option>
                                    <option value="PAGO">PAGO</option>
                                    <option value="RECURSO">EM RECURSO</option>
                                </select>
                            </div>
                            <div className="md:col-span-2 lg:col-span-3">
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Descrição / Enquadramento</label>
                                <textarea 
                                    className="w-full px-5 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-bold dark:text-zinc-100 outline-none border-2 border-white dark:border-zinc-700 focus:border-yellow-400 min-h-[80px]"
                                    placeholder="Detalhes da infração..."
                                    value={fineFormData.description || ''}
                                    onChange={e => setFineFormData({...fineFormData, description: e.target.value})}
                                />
                            </div>
                            <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3">
                                <button 
                                    onClick={() => setIsFineModalOpen(false)}
                                    className="px-6 py-3 bg-slate-200 text-slate-500 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-slate-300 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSaveFine}
                                    className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-emerald-600 shadow-lg transition-all"
                                >
                                    Gravar Multa
                                </button>
                            </div>
                        </div>
                    </div>
                  )}

                  {userFines.filter(v => v.user_id === editingId).length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 dark:bg-zinc-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-zinc-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Nenhuma multa registrada para este colaborador</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {userFines.filter(v => v.user_id === editingId).map(v => (
                        <div key={v.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Auto de Infração</p>
                              <p className="text-xs font-black text-slate-900 dark:text-white uppercase">{v.infraction_notice}</p>
                            </div>
                            <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                              v.status === 'PAGO' ? 'bg-emerald-100 text-emerald-600' : 
                              v.status === 'PENDENTE' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                            }`}>
                              {v.status === 'RECURSO' ? 'EM RECURSO' : v.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-slate-50 dark:border-zinc-800">
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Data / Hora</p>
                              <p className="text-[10px] font-black text-slate-700 dark:text-zinc-300">{new Date(v.date_time).toLocaleString('pt-BR')}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Veículo</p>
                              <p className="text-[10px] font-black text-slate-700 dark:text-zinc-300 uppercase">
                                {vehicles.find(veh => veh.id === v.vehicle_id)?.prefix || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Pontos</p>
                              <p className={`text-[10px] font-black ${v.status === 'RECURSO' ? 'text-slate-400 italic' : 'text-slate-700 dark:text-zinc-300'}`}>
                                {v.points || 0} {v.status === 'RECURSO' ? '(Suspenso)' : ''}
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Valor</p>
                              <p className="text-[10px] font-black text-emerald-500">R$ {v.amount?.toFixed(2) || '0.00'}</p>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Enquadramento / Descrição</p>
                                <p className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 italic">"{v.description}"</p>
                            </div>
                            {v.due_date && (
                                <div className="text-right">
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Vencimento</p>
                                    <p className="text-[10px] font-black text-red-500">{new Date(v.due_date).toLocaleDateString('pt-BR')}</p>
                                </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                <div className="flex gap-4 pt-6 border-t dark:border-zinc-800 transition-colors">
                    <button onClick={handleCloseModal} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest transition-all">Cancelar</button>
                    <button onClick={handleSave} className="flex-[2] py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 border-2 border-slate-900 transition-all"><Save size={20}/> Gravar Colaborador</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverManager;
