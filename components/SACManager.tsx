
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, CreditCard, User, MapPin, Phone, Mail, Calendar, Camera, FileText, ShieldCheck, ArrowRight, Loader2, Save, X, Trash2, History, DollarSign, UserPlus, Fingerprint, Eye, Sparkles, Download, Upload, SmartphoneNfc } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImpCard, ImpCardType, ImpCardRecharge, ImpCardPaymentMethod } from '../types';
import { db } from '../services/database';
import { cpfMask, phoneMask, cepMask, validateCPF } from '../utils/masks';
import { fetchAddress } from '../services/cep';
import TransportCard from './TransportCard';
import { GoogleGenAI } from "@google/genai";
import { formatDate } from '../utils/dateFormatter';
import { useConfirmDialog, ConfirmDialogModal } from './ConfirmDialog';

interface SACManagerProps {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}

const SACManager: React.FC<SACManagerProps> = ({ addToast }) => {
  const [activeTab, setActiveTab] = useState<'consult' | 'register' | 'recharge'>('consult');
  const [cards, setCards] = useState<ImpCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<ImpCard | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Recharge state
  const [rechargeQuery, setRechargeQuery] = useState('');
  const [rechargeCard, setRechargeCard] = useState<ImpCard | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState<string>('0,00');
  const [rechargePaymentMethod, setRechargePaymentMethod] = useState<ImpCardPaymentMethod>('PIX');
  const [rechargeHistory, setRechargeHistory] = useState<ImpCardRecharge[]>([]);

  // Form state
  const [formData, setFormData] = useState<Partial<ImpCard>>({
    type: 'Vale Transporte',
    balance: 0,
    medico_ficha_preenchida: false,
    pericia_realizada: false,
    beneficio_liberado: false
  });

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    setIsLoading(true);
    try {
      const data = await db.getImpCards();
      setCards(data || []);
    } catch (error) {
      addToast("Erro ao carregar cartões.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const generateCardNumber = (type: ImpCardType) => {
    const prefix = type === 'Vale Transporte' ? '10' : 
                   type === 'Idoso' ? '20' : 
                   type === 'Escolar' ? '30' : '40';
    const random = Math.floor(10000000 + Math.random() * 90000000);
    return `${prefix}.${random}`;
  };

  const handleTypeChange = (type: ImpCardType) => {
    setFormData(prev => ({
      ...prev,
      type,
      card_number: generateCardNumber(type)
    }));
  };

  const handleCepBlur = async () => {
    if (formData.cep?.replace(/\D/g, '').length === 8) {
      const address = await fetchAddress(formData.cep);
      if (address) {
        setFormData(prev => ({
          ...prev,
          address_street: address.addressStreet,
          address_neighborhood: address.addressNeighborhood,
          address_city: address.addressCity,
          address_state: address.addressState
        }));
      }
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.surname || !formData.cpf) {
      addToast("Preencha os campos obrigatórios.", "warning");
      return;
    }

    setIsSaving(true);
    try {
      let savedCard: ImpCard | null = null;
      if (formData.id) {
        savedCard = await db.update('imp_cards', formData as ImpCard);
        addToast("Cadastro atualizado com sucesso!");
      } else {
        const newCard = {
          ...formData,
          balance: formData.balance || 0,
          created_at: new Date().toISOString()
        };
        savedCard = await db.create('imp_cards', newCard);
        addToast("Cartão cadastrado com sucesso!");
      }

      if (savedCard) {
        setSelectedCard(savedCard);
        setIsPreviewOpen(true);
      }

      window.dispatchEvent(new CustomEvent('vialivre-vt-card-updated'));
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));

      loadCards();
      setFormData({ type: 'Vale Transporte', balance: 0 });
    } catch (error) {
      addToast("Erro ao salvar cadastro.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const { isOpen: isConfirmOpen, options: confirmOptions, confirm, handleClose: handleConfirmClose } = useConfirmDialog();

  const handleDeleteCard = async () => {
    if (!formData.id) return;
    const ok = await confirm({
      title: 'Excluir Cadastro Vale Transporte',
      message: `Tem certeza que deseja remover este cadastro (${formData.name || formData.card_number || 'Cartão'})? Esta operação é permanente.`,
      confirmText: 'Excluir Cadastro',
      type: 'danger'
    });
    if (!ok) return;

    setIsSaving(true);
    try {
      await db.delete('imp_cards', formData.id);
      addToast("Cadastro removido com sucesso!", "success");
      window.dispatchEvent(new CustomEvent('vialivre-vt-card-updated'));
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      setActiveTab('consult');
      loadCards();
      setFormData({ type: 'Vale Transporte', balance: 0 });
    } catch (error) {
      addToast("Erro ao remover cadastro.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRechargeSearch = async () => {
    if (!rechargeQuery) return;

    // Clean query (digits only if search contains digits)
    const cleanQuery = rechargeQuery.replace(/\D/g, '');
    const isNumeric = /^\d+$/.test(cleanQuery);
    
    if (isNumeric && cleanQuery.length > 0 && cleanQuery.length < 11 && cleanQuery.length !== 8) {
      addToast("CPF deve ter 11 dígitos ou Cartão 8 dígitos.", "warning");
      return;
    }

    const found = cards.find(c => {
      const cleanCpf = (c.cpf || '').replace(/\D/g, '');
      const cleanCard = (c.card_number || '').replace(/\D/g, '');
      if (cleanQuery && (cleanCpf === cleanQuery || cleanCard === cleanQuery)) {
        return true;
      }
      return c.cpf === rechargeQuery || 
        c.card_number === rechargeQuery || 
        `${c.name} ${c.surname}`.toLowerCase().includes(rechargeQuery.toLowerCase());
    });

    if (found) {
      setRechargeCard(found);
      try {
        const allRecharges = await db.getImpCardRecharges();
        const recharges = (allRecharges || []).filter((r: any) => r.card_id === found.id);
        setRechargeHistory(recharges);
      } catch (error) {
        console.error("Erro ao carregar histórico:", error);
      }
    } else {
      addToast("Cartão não encontrado.", "warning");
      setRechargeCard(null);
      setRechargeHistory([]);
    }
  };

  const handleCpfChange = async (value: string) => {
    const rawVal = value.replace(/\D/g, '');
    const masked = cpfMask(rawVal);
    setFormData(prev => ({ ...prev, cpf: masked }));

    if (rawVal.length === 11) {
      try {
        const [allCards, allSales, allUsers] = await Promise.all([
          db.getImpCards().catch(() => []),
          db.getSales().catch(() => []),
          db.getUsers().catch(() => [])
        ]);

        // 1. Check existing cards
        const existingCard = (allCards || []).find(c => (c.cpf || '').replace(/\D/g, '') === rawVal);
        if (existingCard) {
          setFormData(prev => ({
            ...prev,
            ...existingCard,
            cpf: masked
          }));
          addToast("Cadastro de cartão existente carregado pelo CPF!", "success");
          return;
        }

        // 2. Check previous ticket sales
        const sortedSales = [...(allSales || [])].sort((a, b) => 
          new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
        );
        const previousSale = sortedSales.find(s => (s.passenger_cpf || '').replace(/\D/g, '') === rawVal);
        if (previousSale) {
          const parts = (previousSale.passenger_name || '').trim().split(' ');
          const fName = parts[0] || '';
          const lName = parts.slice(1).join(' ') || '';
          setFormData(prev => ({
            ...prev,
            name: fName || prev.name || '',
            surname: lName || prev.surname || '',
            birth_date: previousSale.passenger_birth || prev.birth_date || '',
            phone: previousSale.passenger_phone ? phoneMask(previousSale.passenger_phone) : prev.phone || '',
            email: previousSale.passenger_email || prev.email || '',
            cep: previousSale.address_cep ? cepMask(previousSale.address_cep) : prev.cep || '',
            address_street: previousSale.address_street || prev.address_street || '',
            address_number: previousSale.address_number || prev.address_number || '',
            address_complement: previousSale.address_complement || prev.address_complement || '',
            address_neighborhood: previousSale.address_neighborhood || prev.address_neighborhood || '',
            address_city: previousSale.address_city || prev.address_city || '',
            address_state: previousSale.address_state || prev.address_state || '',
            responsible_name: previousSale.responsible_name || prev.responsible_name || '',
            responsible_birth_date: previousSale.responsible_birth || prev.responsible_birth_date || '',
            relationship: previousSale.relationship || prev.relationship || ''
          }));
          addToast("Dados de passagens anteriores recuperados pelo CPF!", "success");
          return;
        }

        // 3. Check system users
        const existingUser = (allUsers || []).find(u => (u.cpf || '').replace(/\D/g, '') === rawVal);
        if (existingUser) {
          const parts = (existingUser.full_name || '').trim().split(' ');
          setFormData(prev => ({
            ...prev,
            name: parts[0] || prev.name || '',
            surname: parts.slice(1).join(' ') || prev.surname || '',
            phone: existingUser.phone ? phoneMask(existingUser.phone) : prev.phone || '',
            email: existingUser.email || prev.email || ''
          }));
          addToast("Dados de usuário localizados pelo CPF!", "success");
        }
      } catch (err) {
        console.error("Erro na busca de CPF no SAC:", err);
      }
    }
  };

  const formatCurrencyRTL = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const numberValue = parseInt(cleanValue || '0') / 100;
    return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleRecharge = async () => {
    if (!rechargeCard) return;
    const amount = parseFloat(rechargeAmount.replace('.', '').replace(',', '.'));
    if (amount <= 0) return;

    setIsSaving(true);
    try {
      const newBalance = rechargeCard.balance + amount;
      await db.update('imp_cards', { ...rechargeCard, balance: newBalance });
      
      await db.create<ImpCardRecharge>('imp_card_recharges', {
        card_id: rechargeCard.id,
        amount: amount,
        payment_method: rechargePaymentMethod,
        created_at: new Date().toISOString()
      });

      window.dispatchEvent(new CustomEvent('vialivre-vt-card-updated'));
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));

      addToast(`Recarga de R$ ${amount.toFixed(2)} via ${rechargePaymentMethod} realizada com sucesso!`);
      setRechargeCard(null);
      setRechargeAmount('0,00');
      setRechargeQuery('');
      loadCards();
    } catch (error) {
      addToast("Erro ao realizar recarga.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCards = useMemo(() => {
    const cleanSearch = searchQuery.replace(/\D/g, '');
    const searchLower = searchQuery.toLowerCase().trim();
    return cards.filter(c => {
      if (!searchQuery) return true;
      const cleanCpf = (c.cpf || '').replace(/\D/g, '');
      const cleanCard = (c.card_number || '').replace(/\D/g, '');
      const fullName = `${c.name || ''} ${c.surname || ''}`.toLowerCase();
      
      if (cleanSearch && (cleanCpf.includes(cleanSearch) || cleanCard.includes(cleanSearch))) {
        return true;
      }
      return fullName.includes(searchLower) ||
        (c.cpf || '').includes(searchQuery) ||
        (c.card_number || '').includes(searchQuery) ||
        (c.email && c.email.toLowerCase().includes(searchLower));
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [cards, searchQuery]);

  const isMinor = useMemo(() => {
    if (!formData.birth_date) return false;
    const birth = new Date(formData.birth_date);
    const age = new Date().getFullYear() - birth.getFullYear();
    return age < 18;
  }, [formData.birth_date]);

  const rechargeWarning = useMemo(() => {
    if (!rechargeCard) return null;
    if (rechargeCard.type === 'Idoso') return "CARTÃO IDOSO: ISENTO DE RECARGA.";
    if (rechargeCard.type === 'Especial') return "CARTÃO ESPECIAL: ISENTO DE RECARGA.";
    if (rechargeCard.type === 'Escolar' && rechargeCard.school_type === 'Pública') return "CARTÃO ESCOLAR PÚBLICO: ISENTO DE RECARGA.";
    if (rechargeCard.type === 'Escolar' && rechargeCard.school_type === 'Privada') return "CARTÃO ESCOLAR PRIVADO: MEIA TARIFA.";
    return null;
  }, [rechargeCard]);

  const rgMask = (v: string) => {
    v = v.replace(/\D/g, '');
    if (v.length > 9) v = v.slice(0, 9);
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, "$1.$2.$3-$4");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">Vale Transporte</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Atendimento ao Cliente e Gestão de Benefícios</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-zinc-900 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <button 
            onClick={() => setActiveTab('consult')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'consult' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-yellow-400 shadow-md' : 'text-slate-400'}`}
          >
            Consulta
          </button>
          <button 
            onClick={() => {
              setActiveTab('register');
              setFormData({ type: 'Vale Transporte', card_number: generateCardNumber('Vale Transporte'), balance: 0 });
            }}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'register' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-yellow-400 shadow-md' : 'text-slate-400'}`}
          >
            Novo Cadastro
          </button>
          <button 
            onClick={() => setActiveTab('recharge')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'recharge' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-yellow-400 shadow-md' : 'text-slate-400'}`}
          >
            Recarga
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'consult' && (
          <motion.div 
            key="consult"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text"
                placeholder="BUSCAR POR NOME, CPF OU NÚMERO DO CARTÃO..."
                className="w-full pl-12 pr-4 py-5 bg-white dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-3xl text-xs font-black uppercase focus:border-yellow-400 transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-yellow-400" size={48} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCards.map(card => (
                  <motion.div 
                    key={card.id}
                    layoutId={card.id}
                    onClick={() => {
                      setFormData(card);
                      setActiveTab('register');
                    }}
                    className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border-2 border-slate-100 dark:border-zinc-800 hover:border-yellow-400 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-white dark:border-zinc-700 shadow-sm">
                        {card.photo_url ? (
                          <img src={card.photo_url} className="w-full h-full object-cover" alt="Foto" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="text-slate-300" size={32} />
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          card.type === 'Vale Transporte' ? 'bg-blue-100 text-blue-600' :
                          card.type === 'Idoso' ? 'bg-emerald-100 text-emerald-600' :
                          card.type === 'Escolar' ? 'bg-orange-100 text-orange-600' :
                          'bg-purple-100 text-purple-600'
                        }`}>
                          {card.type}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCard(card);
                            setIsPreviewOpen(true);
                          }}
                          className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-xl text-slate-400 hover:text-yellow-400 transition-all"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase italic text-slate-900 dark:text-white leading-tight mb-1">{card.name} {card.surname}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-4">{card.card_number}</p>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Saldo</p>
                          <p className="text-sm font-black text-slate-900 dark:text-white">R$ {card.balance.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">CPF</p>
                          <p className="text-sm font-black text-slate-900 dark:text-white">{card.cpf}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'register' && (
          <motion.div 
            key="register"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-zinc-900 rounded-[3rem] border-2 border-slate-100 dark:border-zinc-800 overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase italic text-slate-900 dark:text-white">{formData.id ? 'Editar Cadastro' : 'Novo Cadastro ImpCard'}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase">Preencha todos os dados obrigatórios</p>
              </div>
              <button onClick={() => setActiveTab('consult')} className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><X size={20}/></button>
            </div>

            <div className="p-8 space-y-8">
              {/* Card Type Selection */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(['Vale Transporte', 'Idoso', 'Escolar', 'Especial'] as ImpCardType[]).map(type => (
                  <button 
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`p-4 rounded-3xl border-2 flex flex-col items-center gap-2 transition-all ${formData.type === type ? 'bg-yellow-400 border-slate-900 text-slate-900' : 'bg-slate-50 dark:bg-zinc-800 border-transparent text-slate-400'}`}
                  >
                    <CreditCard size={24} />
                    <span className="text-[10px] font-black uppercase">{type}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Photo and Card Info */}
                <div className="space-y-6">
                  <div className="relative group">
                    <div 
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-yellow-400', 'bg-yellow-50'); }}
                      onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-yellow-400', 'bg-yellow-50'); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('border-yellow-400', 'bg-yellow-50');
                        const file = e.dataTransfer.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setFormData({...formData, photo_url: ev.target?.result as string});
                          reader.readAsDataURL(file);
                        }
                      }}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setFormData({...formData, photo_url: ev.target?.result as string});
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
                      }}
                      className="w-full aspect-square bg-slate-100 dark:bg-zinc-800 rounded-[3rem] border-4 border-dashed border-slate-200 dark:border-zinc-700 flex flex-col items-center justify-center gap-4 overflow-hidden relative cursor-pointer hover:border-yellow-400 transition-all"
                    >
                      {formData.photo_url ? (
                        <img src={formData.photo_url} className="w-full h-full object-cover" alt="Foto" referrerPolicy="no-referrer" />
                      ) : (
                        <>
                          <Upload size={48} className="text-slate-300" />
                          <p className="text-[9px] font-black text-slate-400 uppercase text-center px-6">Arraste ou clique para anexar foto</p>
                        </>
                      )}
                    </div>
                    <button className="absolute bottom-4 right-4 p-4 bg-yellow-400 text-slate-900 rounded-2xl shadow-xl border-2 border-slate-900 opacity-0 group-hover:opacity-100 transition-all"><Upload size={20}/></button>
                  </div>

                  <div className="scale-[0.65] origin-top-left">
                    <TransportCard 
                      name={`${formData.name || '---'} ${formData.surname || ''}`}
                      cardNumber={formData.card_number || '00.00000000'}
                      photoUrl={formData.photo_url}
                      category={formData.type?.toUpperCase()}
                    />
                  </div>
                </div>

                {/* Personal Data */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nome</label>
                      <input 
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Sobrenome</label>
                      <input 
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.surname || ''}
                        onChange={(e) => setFormData({...formData, surname: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">CPF</label>
                      <input 
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.cpf || ''}
                        onChange={(e) => handleCpfChange(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">RG</label>
                      <input 
                        type="text"
                        placeholder="00.000.000-0"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.rg || ''}
                        onChange={(e) => setFormData({...formData, rg: rgMask(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Data de Nascimento</label>
                      <input 
                        type="date"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.birth_date || ''}
                        onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">CEP</label>
                      <input 
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.cep || ''}
                        onChange={(e) => setFormData({...formData, cep: cepMask(e.target.value)})}
                        onBlur={handleCepBlur}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Logradouro</label>
                      <input 
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.address_street || ''}
                        onChange={(e) => setFormData({...formData, address_street: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Número</label>
                      <input 
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.address_number || ''}
                        onChange={(e) => setFormData({...formData, address_number: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Complemento</label>
                      <input 
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.address_complement || ''}
                        onChange={(e) => setFormData({...formData, address_complement: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Bairro</label>
                      <input 
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.address_neighborhood || ''}
                        onChange={(e) => setFormData({...formData, address_neighborhood: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cidade</label>
                      <input 
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.address_city || ''}
                        onChange={(e) => setFormData({...formData, address_city: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">UF</label>
                      <input 
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.address_state || ''}
                        onChange={(e) => setFormData({...formData, address_state: e.target.value})}
                        maxLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Telefone</label>
                      <input 
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({...formData, phone: phoneMask(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Senha de Acesso</label>
                      <input 
                        type="password"
                        placeholder="DEFINA UMA SENHA"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-yellow-400 transition-all"
                        value={formData.password || ''}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Specific Logic Sections */}
                  {formData.type === 'Escolar' && (
                    <div className="p-8 bg-orange-50 dark:bg-orange-900/10 rounded-[2.5rem] border-2 border-orange-100 dark:border-orange-800/30 space-y-6">
                      <h4 className="text-sm font-black uppercase italic text-orange-600 flex items-center gap-2"><FileText size={18}/> Requisitos Escolar</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-orange-400 ml-2">Tipo de Escola</label>
                          <select 
                            className="w-full px-6 py-4 bg-white dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-orange-400 transition-all"
                            value={formData.school_type || ''}
                            onChange={(e) => setFormData({...formData, school_type: e.target.value as any})}
                          >
                            <option value="">Selecione...</option>
                            <option value="Pública">Escola Pública (Gratuito)</option>
                            <option value="Privada">Escola Privada (Meia Tarifa)</option>
                          </select>
                        </div>
                        <div className="flex gap-4">
                          <button className="flex-1 p-4 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-orange-100 dark:border-orange-800/30 flex flex-col items-center gap-2 text-orange-600">
                            <Camera size={20}/>
                            <span className="text-[8px] font-black uppercase">Foto 3x4</span>
                          </button>
                          <button className="flex-1 p-4 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-orange-100 dark:border-orange-800/30 flex flex-col items-center gap-2 text-orange-600">
                            <FileText size={20}/>
                            <span className="text-[8px] font-black uppercase">Declaração</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.type === 'Especial' && (
                    <div className="p-8 bg-purple-50 dark:bg-purple-900/10 rounded-[2.5rem] border-2 border-purple-100 dark:border-purple-800/30 space-y-6">
                      <h4 className="text-sm font-black uppercase italic text-purple-600 flex items-center gap-2"><ShieldCheck size={18}/> Requisitos Especial</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-purple-100 dark:border-purple-800/30 flex flex-col items-center gap-2 text-purple-600">
                          <FileText size={20}/>
                          <span className="text-[8px] font-black uppercase text-center">Resumo CadÚnico</span>
                        </button>
                        <button className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-purple-100 dark:border-purple-800/30 flex flex-col items-center gap-2 text-purple-600">
                          <FileText size={20}/>
                          <span className="text-[8px] font-black uppercase text-center">Laudo Médico</span>
                        </button>
                        <button className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border-2 border-purple-100 dark:border-purple-800/30 flex flex-col items-center gap-2 text-purple-600">
                          <FileText size={20}/>
                          <span className="text-[8px] font-black uppercase text-center">Exames</span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.medico_ficha_preenchida ? 'bg-purple-500 border-purple-500 text-white' : 'border-purple-200'}`}>
                            {formData.medico_ficha_preenchida && <ShieldCheck size={16}/>}
                          </div>
                          <input type="checkbox" className="hidden" checked={formData.medico_ficha_preenchida} onChange={(e) => setFormData({...formData, medico_ficha_preenchida: e.target.checked})} />
                          <span className="text-[10px] font-black uppercase text-purple-700">Ficha Médica</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.pericia_realizada ? 'bg-purple-500 border-purple-500 text-white' : 'border-purple-200'}`}>
                            {formData.pericia_realizada && <ShieldCheck size={16}/>}
                          </div>
                          <input type="checkbox" className="hidden" checked={formData.pericia_realizada} onChange={(e) => setFormData({...formData, pericia_realizada: e.target.checked})} />
                          <span className="text-[10px] font-black uppercase text-purple-700">Perícia Realizada</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {isMinor && (
                    <div className="p-8 bg-blue-50 dark:bg-blue-900/10 rounded-[2.5rem] border-2 border-blue-100 dark:border-blue-800/30 space-y-6">
                      <h4 className="text-sm font-black uppercase italic text-blue-600 flex items-center gap-2"><UserPlus size={18}/> Dados do Responsável</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-blue-400 ml-2">Nome</label>
                          <input 
                            type="text"
                            className="w-full px-6 py-4 bg-white dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-blue-400 transition-all"
                            value={formData.guardian_name || ''}
                            onChange={(e) => setFormData({...formData, guardian_name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-blue-400 ml-2">Sobrenome</label>
                          <input 
                            type="text"
                            className="w-full px-6 py-4 bg-white dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-blue-400 transition-all"
                            value={formData.guardian_surname || ''}
                            onChange={(e) => setFormData({...formData, guardian_surname: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-blue-400 ml-2">CPF</label>
                          <input 
                            type="text"
                            className="w-full px-6 py-4 bg-white dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-blue-400 transition-all"
                            value={formData.guardian_cpf || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              if (val.length <= 11) {
                                setFormData({...formData, guardian_cpf: cpfMask(val)});
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-blue-400 ml-2">Grau de Parentesco</label>
                          <input 
                            type="text"
                            className="w-full px-6 py-4 bg-white dark:bg-zinc-800 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-blue-400 transition-all"
                            value={formData.guardian_relationship || ''}
                            onChange={(e) => setFormData({...formData, guardian_relationship: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                {formData.id && (
                  <button 
                    onClick={handleDeleteCard}
                    disabled={isSaving}
                    className="px-6 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl border-2 border-red-700 flex items-center gap-2 hover:bg-red-600 transition-all disabled:opacity-50"
                  >
                    <Trash2 size={18}/>
                    Remover Cadastro
                  </button>
                )}
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setActiveTab('consult')}
                  className="px-8 py-4 bg-white dark:bg-zinc-800 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 border-slate-100 dark:border-zinc-700"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-12 py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl border-2 border-slate-900 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                  {formData.id ? 'Salvar Alterações' : 'Finalizar Cadastro'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'recharge' && (
          <motion.div 
            key="recharge"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-2xl mx-auto space-y-8"
          >
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xl font-black uppercase italic text-slate-900 dark:text-white mb-6">Recarga de Cartão</h3>
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text"
                    placeholder="CPF, NOME OU NÚMERO DO CARTÃO..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-2xl text-xs font-black uppercase focus:border-yellow-400 transition-all outline-none"
                    value={rechargeQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      const clean = val.replace(/\D/g, '');
                      if (/^\d+$/.test(clean) && clean.length > 0) {
                        if (clean.length <= 11) {
                          setRechargeQuery(cpfMask(clean));
                        }
                      } else {
                        setRechargeQuery(val);
                      }
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleRechargeSearch()}
                  />
                </div>
                <button 
                  onClick={handleRechargeSearch}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all"
                >
                  Buscar
                </button>
              </div>
            </div>

            {rechargeCard && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-yellow-400 p-8 rounded-[3rem] border-4 border-slate-900 shadow-2xl space-y-8"
              >
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-white rounded-3xl border-2 border-slate-900 flex items-center justify-center overflow-hidden">
                    {rechargeCard.photo_url ? (
                      <img src={rechargeCard.photo_url} className="w-full h-full object-cover" alt="Foto" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="text-slate-300" size={40} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-2xl font-black uppercase italic text-slate-900 leading-tight">{rechargeCard.name} {rechargeCard.surname}</h4>
                    <p className="text-[10px] font-black uppercase text-slate-900/60">{rechargeCard.card_number} • {rechargeCard.type}</p>
                    {rechargeWarning && (
                      <p className="mt-2 text-[10px] font-black uppercase text-red-600 bg-red-50 px-3 py-1 rounded-full inline-block border border-red-200">
                        {rechargeWarning}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white/40 p-6 rounded-[2rem] border-2 border-slate-900/10">
                    <p className="text-[10px] font-black uppercase text-slate-900/40 mb-1">Saldo Atual</p>
                    <p className="text-3xl font-black text-slate-900">R$ {rechargeCard.balance.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                    <p className="text-[10px] font-black uppercase text-white/40 mb-2">Valor da Recarga</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-yellow-400">R$</span>
                      <input 
                        type="text"
                        className="bg-transparent text-3xl font-black outline-none w-full text-yellow-400"
                        value={rechargeAmount}
                        onChange={(e) => setRechargeAmount(formatCurrencyRTL(e.target.value))}
                        autoFocus
                      />
                    </div>
                  </div>
                </div>

                {rechargeHistory.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-slate-900/60 ml-2">Histórico de Recargas</p>
                    <div className="bg-white/30 rounded-[2rem] overflow-hidden border border-slate-900/10">
                      {rechargeHistory.slice(0, 3).map((h, i) => (
                        <div key={i} className="p-4 flex justify-between items-center border-b border-slate-900/5 last:border-none">
                          <div>
                            <p className="text-[9px] font-black text-slate-900 uppercase">{h.payment_method}</p>
                            <p className="text-[7px] font-bold text-slate-900/40 uppercase">{formatDate(h.created_at)}</p>
                          </div>
                          <p className="text-xs font-black text-slate-900">R$ {h.amount.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-slate-900/60 ml-2">Forma de Pagamento</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(['PIX', 'BOLETO', 'DEBITO', 'CREDITO', 'DINHEIRO'] as ImpCardPaymentMethod[]).map(method => (
                      <button
                        key={method}
                        onClick={() => setRechargePaymentMethod(method)}
                        className={`py-3 rounded-2xl font-black text-[9px] uppercase border-2 transition-all ${rechargePaymentMethod === method ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white/50 text-slate-600 border-transparent hover:border-slate-900/20'}`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleRecharge}
                  disabled={isSaving || parseFloat(rechargeAmount.replace(',', '.')) <= 0}
                  className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={24}/> : <DollarSign size={24}/>}
                  Confirmar Recarga de R$ {rechargeAmount}
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && selectedCard && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden border-2 border-slate-100 dark:border-zinc-800 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black uppercase italic text-slate-900 dark:text-white">Visualização do Cartão</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Layout Digital do ImpCard</p>
                </div>
                <button onClick={() => setIsPreviewOpen(false)} className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><X size={20}/></button>
              </div>

              <div className="p-12 flex flex-col items-center justify-center min-h-[400px] gap-8 overflow-y-auto custom-scrollbar">
                {/* Live Preview using TransportCard */}
                <div className="scale-75 sm:scale-100 origin-center">
                  <TransportCard 
                    name={`${selectedCard.name} ${selectedCard.surname}`}
                    cardNumber={selectedCard.card_number}
                    photoUrl={selectedCard.photo_url}
                    category={selectedCard.type}
                  />
                </div>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                <button 
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-12 py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl border-2 border-slate-900 hover:scale-105 transition-all"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialogModal isOpen={isConfirmOpen} options={confirmOptions} onClose={handleConfirmClose} />
    </div>
  );
};

export default SACManager;
