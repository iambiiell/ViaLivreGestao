
import React, { useState, useEffect } from 'react';
import { TicketingConfig, VehicleClass } from '../types';
import { Settings2, Save, Tag, Box, Plus, X, ShieldAlert, DollarSign, Wallet, RefreshCcw, AlertTriangle, Loader2, Percent, Ticket, Pencil, Sparkles, Hash, Info } from 'lucide-react';
import { db } from '../services/database';

interface TicketingConfigManagerProps {
    initialConfig: TicketingConfig | null;
    onUpdateConfig: (config: TicketingConfig) => void;
    addToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}

const CONFIG_ID = 'da4d93ab-b6e9-4556-918d-21861dd26726';

const CLASSES: { id: VehicleClass, label: string }[] = [
    { id: 'CONVENCIONAL', label: 'Convencional' }, { id: 'CONVENCIONAL_DD', label: 'Convencional DD' },
    { id: 'EXECUTIVO', label: 'Executivo' }, { id: 'EXECUTIVO_DD', label: 'Executivo DD' },
    { id: 'LEITO', label: 'Leito' }, { id: 'LEITO_DD', label: 'Leito DD' },
    { id: 'SEMI_LEITO', label: 'Semi-Leito' }, { id: 'SEMI_LEITO_DD', label: 'Semi-Leito DD' },
    { id: 'URBANO', label: 'Urbano' }, { id: 'CAMA', label: 'Cama' }
];

const TicketingConfigManager: React.FC<TicketingConfigManagerProps> = ({ initialConfig, onUpdateConfig, addToast }) => {
  const [config, setConfig] = useState<TicketingConfig | null>(null);
  const [newPayment, setNewPayment] = useState('');
  const [isRoadOnly, setIsRoadOnly] = useState(false);
  const [editingPaymentIdx, setEditingPaymentIdx] = useState<number | null>(null);
  
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponNumeric, setNewCouponNumeric] = useState('');
  const [newCouponValue, setNewCouponValue] = useState<number>(0);
  const [newCouponType, setNewCouponType] = useState<'FIXED' | 'PERCENT'>('PERCENT');
  const [newCouponConditions, setNewCouponConditions] = useState('');
  const [editingCouponCode, setEditingCouponCode] = useState<string | null>(null);

  const [newCustomClassName, setNewCustomClassName] = useState('');
  const [newCustomClassSeats, setNewCustomClassSeats] = useState<number>(0);
  const [editingCustomClassId, setEditingCustomClassId] = useState<string | null>(null);

  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      setConfig({
        ...initialConfig,
        id: CONFIG_ID,
        payment_methods: initialConfig.payment_methods || [],
        payment_methods_config: initialConfig.payment_methods_config || [],
        active_coupons: initialConfig.active_coupons || [],
        class_seats: initialConfig.class_seats || {} as any,
        custom_vehicle_classes: initialConfig.custom_vehicle_classes || []
      });
    }
  }, [initialConfig]);

  const sortedPayments = React.useMemo(() => 
    [...(config?.payment_methods_config || [])].sort((a, b) => a.label.localeCompare(b.label)),
    [config?.payment_methods_config]
  );

  const sortedCoupons = React.useMemo(() => 
    [...(config?.active_coupons || [])].sort((a, b) => a.code.localeCompare(b.code)),
    [config?.active_coupons]
  );

  if (!config) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-dashed border-yellow-400">
        <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sincronizando parâmetros...</p>
      </div>
    );
  }

  const handleAddOrUpdatePayment = () => {
      if (!newPayment.trim()) return;
      const paymentLabel = newPayment.trim().toUpperCase();
      const paymentId = paymentLabel.replace(/\s+/g, '_');
      
      let updatedConfigs = [...(config.payment_methods_config || [])];
      
      if (editingPaymentIdx !== null) {
          const oldPayment = sortedPayments[editingPaymentIdx];
          const originalIdx = updatedConfigs.findIndex(c => c.id === oldPayment.id);
          if (originalIdx !== -1) {
              updatedConfigs[originalIdx] = { ...oldPayment, label: paymentLabel, is_road_only: isRoadOnly };
          }
          setEditingPaymentIdx(null);
          addToast("Forma de pagamento atualizada.", "success");
      } else {
          if (updatedConfigs.some(c => c.label === paymentLabel)) {
              return addToast("Esta forma de pagamento já existe.", "warning");
          }
          updatedConfigs.push({ id: paymentId, label: paymentLabel, is_road_only: isRoadOnly });
          addToast("Nova forma de pagamento inserida.", "success");
      }

      setConfig({ 
        ...config, 
        payment_methods_config: updatedConfigs,
        payment_methods: updatedConfigs.map(c => c.label)
      });
      setNewPayment('');
      setIsRoadOnly(false);
  };

  const handleEditPayment = (idx: number) => {
      const p = sortedPayments[idx];
      setNewPayment(p.label);
      setIsRoadOnly(p.is_road_only);
      setEditingPaymentIdx(idx);
  };

  const handleDeletePayment = (paymentId: string) => {
      const updatedConfigs = (config.payment_methods_config || []).filter(p => p.id !== paymentId);
      setConfig({
          ...config,
          payment_methods_config: updatedConfigs,
          payment_methods: updatedConfigs.map(c => c.label)
      });
      if (editingPaymentIdx !== null && sortedPayments[editingPaymentIdx].id === paymentId) {
          setEditingPaymentIdx(null);
          setNewPayment('');
          setIsRoadOnly(false);
      }
  };

  const handleAddOrUpdateCoupon = () => {
    if (!newCouponCode.trim() || newCouponValue <= 0) return;
    const code = newCouponCode.trim().toUpperCase();
    
    let updatedCoupons = [...(config.active_coupons || [])];
    const existsIdx = updatedCoupons.findIndex(c => c.code === code);

    if (editingCouponCode === null && existsIdx !== -1) {
        return addToast("Este código de cupom já existe.", "warning");
    }

    const couponData = { 
        code, 
        numeric_code: newCouponNumeric.trim(), 
        discount: newCouponValue, 
        type: newCouponType,
        conditions: newCouponConditions.trim()
    };

    if (editingCouponCode !== null) {
        const idx = updatedCoupons.findIndex(c => c.code === editingCouponCode);
        if (idx !== -1) updatedCoupons[idx] = couponData;
        setEditingCouponCode(null);
        addToast("Cupom atualizado com sucesso.", "success");
    } else {
        updatedCoupons.push(couponData);
        addToast("Cupom cadastrado com sucesso.", "success");
    }

    // Sort alphabetically by code
    updatedCoupons.sort((a, b) => a.code.localeCompare(b.code));

    setConfig({ ...config, active_coupons: updatedCoupons });
    setNewCouponCode('');
    setNewCouponNumeric('');
    setNewCouponValue(0);
    setNewCouponConditions('');
  };

  const handleAddOrUpdateCustomClass = () => {
    if (!newCustomClassName.trim() || newCustomClassSeats <= 0) return;
    const label = newCustomClassName.trim();
    const id = editingCustomClassId || label.toUpperCase().replace(/\s+/g, '_');
    
    let updatedCustomClasses = [...(config.custom_vehicle_classes || [])];
    
    if (editingCustomClassId) {
        const idx = updatedCustomClasses.findIndex(c => c.id === editingCustomClassId);
        if (idx !== -1) updatedCustomClasses[idx] = { id, label };
        setEditingCustomClassId(null);
        addToast("Configuração atualizada.", "success");
    } else {
        if (updatedCustomClasses.some(c => c.id === id) || CLASSES.some(c => c.id === id as any)) {
            return addToast("Esta configuração já existe.", "warning");
        }
        updatedCustomClasses.push({ id, label });
        addToast("Nova configuração de poltronas adicionada.", "success");
    }

    setConfig({
        ...config,
        custom_vehicle_classes: updatedCustomClasses,
        class_seats: {
            ...config.class_seats,
            [id]: newCustomClassSeats
        }
    });
    setNewCustomClassName('');
    setNewCustomClassSeats(0);
  };

  const handleEditCustomClass = (cls: { id: string, label: string }) => {
    setNewCustomClassName(cls.label);
    setNewCustomClassSeats(config.class_seats[cls.id] || 0);
    setEditingCustomClassId(cls.id);
  };

  const handleDeleteCustomClass = (id: string) => {
    const updatedCustomClasses = (config.custom_vehicle_classes || []).filter(c => c.id !== id);
    const updatedSeats = { ...config.class_seats };
    delete updatedSeats[id];
    
    setConfig({
        ...config,
        custom_vehicle_classes: updatedCustomClasses,
        class_seats: updatedSeats
    });
  };

  const handleEditCoupon = (code: string) => {
      const coupon = (config.active_coupons || []).find(c => c.code === code);
      if (coupon) {
          setNewCouponCode(coupon.code);
          setNewCouponNumeric(coupon.numeric_code || '');
          setNewCouponValue(coupon.discount);
          setNewCouponType(coupon.type);
          setNewCouponConditions(coupon.conditions || '');
          setEditingCouponCode(code);
      }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
        const finalPayload = {
            id: CONFIG_ID,
            payment_methods: (config.payment_methods || []).filter(Boolean),
            payment_methods_config: config.payment_methods_config || [],
            credit_installments: Number(config.credit_installments) || 0,
            credit_surcharge: Number(config.credit_surcharge) || 0,
            min_installment_value: Number(config.min_installment_value) || 0,
            boarding_box: config.boarding_box || 'Plataforma 01',
            active_coupons: (config.active_coupons || []).map(c => ({
                code: c.code.toUpperCase(),
                numeric_code: c.numeric_code,
                discount: Number(c.discount),
                type: c.type,
                conditions: c.conditions
            })),
            class_seats: config.class_seats,
            custom_vehicle_classes: config.custom_vehicle_classes || []
        };

        const currentConfigs = await db.getTicketingConfig();
        const existing = (currentConfigs || []).find(c => c.id === CONFIG_ID);

        let result;
        if (existing) {
            result = await db.update('ticketing_config', finalPayload);
        } else {
            result = await db.create('ticketing_config', finalPayload);
        }

        if (result) {
            onUpdateConfig(result);
            addToast("Configurações sincronizadas com o servidor.", "success");
        } else {
            throw new Error("DB response was empty");
        }
    } catch (err) {
        console.error("[DB FETCH ERROR]", err);
        addToast("Erro de sincronia com o banco de dados.", "error");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-24 md:pb-8">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border-2 border-yellow-400 flex flex-col md:flex-row justify-between items-center gap-4 transition-colors">
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic flex items-center gap-3"><Settings2 size={32} className="text-yellow-500"/> Gestão Operacional Guichê</h2>
            <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mt-2 border-l-2 border-yellow-400 pl-4">Regras de faturamento, cupons e frota</p>
          </div>
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className={`px-10 py-5 bg-emerald-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 flex items-center gap-3 border-2 border-emerald-400 transition-all ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} 
            {isSaving ? 'Gravando Alterações...' : 'Publicar e Sincronizar'}
          </button>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <div className="space-y-6">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border-2 border-yellow-400">
                  <h3 className="text-xs font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest mb-6 flex items-center gap-2"><DollarSign size={18}/> Regras Financeiras</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Parcelamento Máx. (x)</label>
                          <input type="number" className="w-full px-5 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-xl font-bold dark:text-white outline-none" value={config.credit_installments} onChange={e => setConfig({...config, credit_installments: parseInt(e.target.value)})} />
                      </div>
                      <div>
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Parcela Mínima (R$)</label>
                          <input type="number" className="w-full px-5 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-xl font-bold dark:text-white outline-none" value={config.min_installment_value} onChange={e => setConfig({...config, min_installment_value: parseFloat(e.target.value)})} />
                      </div>
                      <div className="sm:col-span-2">
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Taxa de Acréscimo Crédito (%)</label>
                          <input type="number" step="0.1" className="w-full px-5 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-xl font-bold dark:text-white outline-none" value={config.credit_surcharge} onChange={e => setConfig({...config, credit_surcharge: parseFloat(e.target.value)})} />
                      </div>
                      <div className="sm:col-span-2">
                          <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Local/Plataforma de Embarque</label>
                          <input className="w-full px-5 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-xl font-bold dark:text-white outline-none" value={config.boarding_box} onChange={e => setConfig({...config, boarding_box: e.target.value})} />
                      </div>
                  </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border-2 border-yellow-400">
                  <h3 className="text-xs font-black uppercase text-black dark:text-zinc-500 tracking-widest mb-6 flex items-center gap-2"><Box size={18}/> Configuração de Poltronas</h3>
                  
                  <div className="mb-8 p-6 bg-slate-50 dark:bg-zinc-800 rounded-3xl border-2 border-dashed border-yellow-400/30">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Plus size={12}/> Adicionar Nova Configuração</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="sm:col-span-2">
                              <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Nome da Classe (Ex: LUXO)</label>
                              <input 
                                className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border-2 border-yellow-400/20 rounded-xl font-bold uppercase text-[10px] dark:text-white outline-none focus:border-yellow-400 transition-all" 
                                value={newCustomClassName} 
                                onChange={e => setNewCustomClassName(e.target.value)} 
                                placeholder="NOME DA CONFIGURAÇÃO"
                              />
                          </div>
                          <div>
                              <label className="block text-[9px] font-black text-black uppercase mb-1 ml-2">Qtd. de Poltronas</label>
                              <input 
                                type="number"
                                className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border-2 border-yellow-400/20 rounded-xl font-bold text-[10px] dark:text-white outline-none focus:border-yellow-400 transition-all" 
                                value={newCustomClassSeats === 0 ? '' : newCustomClassSeats} 
                                placeholder="44"
                                onChange={e => {
                                  const val = e.target.value;
                                  setNewCustomClassSeats(Number(val) || 0);
                                }} 
                              />
                          </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3 items-center">
                          <button 
                            onClick={handleAddOrUpdateCustomClass}
                            className={`px-10 py-3 rounded-xl font-black uppercase text-xs active:scale-95 transition-all shadow-md hover:scale-102 ${editingCustomClassId ? 'bg-indigo-600 text-white' : 'bg-yellow-400 text-slate-900 border-2 border-yellow-500/20'}`}
                          >
                              {editingCustomClassId ? 'Atualizar' : 'Adicionar'}
                          </button>
                          {editingCustomClassId && (
                            <button onClick={() => {
                              setEditingCustomClassId(null);
                              setNewCustomClassName('');
                              setNewCustomClassSeats(0);
                            }} className="text-[8px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors">Cancelar Edição</button>
                          )}
                      </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {CLASSES.map(cls => (
                          <div key={cls.id}>
                              <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2 truncate" title={cls.label}>{cls.label}</label>
                              <div className="relative">
                                  <input 
                                    type="number" 
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400/30 rounded-xl font-bold text-xs dark:text-white outline-none focus:border-yellow-400 transition-all" 
                                    value={config.class_seats[cls.id] || 0} 
                                    onChange={e => setConfig({
                                        ...config, 
                                        class_seats: {
                                            ...config.class_seats,
                                            [cls.id]: parseInt(e.target.value) || 0
                                        }
                                    })} 
                                  />
                                  <Hash className="absolute right-3 top-2.5 text-slate-300" size={12} />
                              </div>
                          </div>
                      ))}
                      {(config.custom_vehicle_classes || []).map(cls => (
                          <div key={cls.id} className="group relative">
                              <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2 truncate" title={cls.label}>{cls.label}</label>
                              <div className="relative">
                                  <input 
                                    type="number" 
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-2 border-indigo-400/30 rounded-xl font-bold text-xs dark:text-white outline-none focus:border-indigo-400 transition-all" 
                                    value={config.class_seats[cls.id] || 0} 
                                    onChange={e => setConfig({
                                        ...config, 
                                        class_seats: {
                                            ...config.class_seats,
                                            [cls.id]: parseInt(e.target.value) || 0
                                        }
                                    })} 
                                  />
                                  <div className="flex gap-1 absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-all">
                                      <button 
                                        onClick={() => handleEditCustomClass(cls)}
                                        className="bg-blue-500 text-white rounded-full p-1 shadow-lg"
                                      >
                                          <Pencil size={10} />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteCustomClass(cls.id)}
                                        className="bg-red-500 text-white rounded-full p-1 shadow-lg"
                                      >
                                          <X size={10} />
                                      </button>
                                  </div>
                                  <Sparkles className="absolute right-3 top-2.5 text-indigo-300" size={12} />
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>

          <div className="space-y-6">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border-2 border-yellow-400">
                  <h3 className="text-xs font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest mb-6 flex items-center gap-2"><Wallet size={18}/> Formas de Pagamento</h3>
                  <div className="space-y-4 mb-6">
                    <div className="flex gap-2">
                        <input 
                          placeholder={editingPaymentIdx !== null ? "EDITANDO FORMA..." : "EX: CARTÃO AUXÍLIO"} 
                          className={`flex-1 px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 rounded-xl font-bold uppercase text-[10px] dark:text-white outline-none transition-all ${editingPaymentIdx !== null ? 'border-dashed border-indigo-500' : ''}`} 
                          value={newPayment} 
                          onChange={e => setNewPayment(e.target.value)} 
                        />
                        <button onClick={handleAddOrUpdatePayment} className={`px-5 rounded-xl font-black text-[9px] uppercase active:scale-95 transition-all ${editingPaymentIdx !== null ? 'bg-indigo-600 text-white' : 'bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900'}`}>
                            {editingPaymentIdx !== null ? 'Atualizar' : 'Adicionar'}
                        </button>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                        <input 
                            type="checkbox" 
                            id="roadOnly" 
                            checked={isRoadOnly} 
                            onChange={e => setIsRoadOnly(e.target.checked)}
                            className="w-4 h-4 accent-yellow-500"
                        />
                        <label htmlFor="roadOnly" className="text-[10px] font-black text-slate-500 uppercase cursor-pointer">Apenas Rodoviário</label>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                      {sortedPayments.map((p, idx) => (
                          <div key={p.id} className="px-4 py-2 bg-slate-50 dark:bg-zinc-800 rounded-lg border-2 border-yellow-400/30 flex flex-col gap-1 group transition-all hover:border-yellow-400">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase dark:text-zinc-300">{p.label}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button onClick={() => handleEditPayment(idx)} className="text-blue-500 hover:scale-110"><Pencil size={12}/></button>
                                    <button onClick={() => handleDeletePayment(p.id)} className="text-red-400 hover:scale-110"><X size={12}/></button>
                                </div>
                              </div>
                              {p.is_road_only && (
                                <span className="text-[7px] font-black text-indigo-500 uppercase tracking-tighter bg-indigo-50 dark:bg-indigo-900/20 px-1 rounded">Apenas Rodoviário</span>
                              )}
                          </div>
                      ))}
                  </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border-2 border-yellow-400">
                  <h3 className="text-xs font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest mb-6 flex items-center gap-2"><Ticket size={18}/> Gestão de Cupons</h3>
                  
                  <div className="space-y-4 mb-8 p-6 bg-slate-50 dark:bg-zinc-800 rounded-3xl border-2 border-dashed border-indigo-400/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Nome do Cupom (Ex: NATAL20)</label>
                              <input 
                                className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border-2 border-indigo-400/20 rounded-xl font-bold uppercase text-[10px] dark:text-white outline-none focus:border-indigo-500 transition-all" 
                                value={newCouponCode} 
                                onChange={e => setNewCouponCode(e.target.value)} 
                                placeholder="NOME DO CUPOM"
                              />
                          </div>
                          <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Código Numérico (Opcional)</label>
                              <input 
                                className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border-2 border-indigo-400/20 rounded-xl font-bold uppercase text-[10px] dark:text-white outline-none focus:border-indigo-500 transition-all" 
                                value={newCouponNumeric} 
                                onChange={e => setNewCouponNumeric(e.target.value)} 
                                placeholder="CÓDIGO PARA O GUICHÊ"
                              />
                          </div>
                          <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Valor do Desconto</label>
                              <div className="flex gap-2">
                                  <input 
                                    type="number"
                                    className="flex-1 px-5 py-3 bg-white dark:bg-zinc-900 border-2 border-indigo-400/20 rounded-xl font-bold text-[10px] dark:text-white outline-none focus:border-indigo-500 transition-all" 
                                    value={newCouponValue === 0 ? '' : newCouponValue} 
                                    placeholder={Math.floor(Math.random() * 50).toString()}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setNewCouponValue(Number(val) || 0);
                                    }} 
                                  />
                                  <select 
                                    className="px-4 py-3 bg-white dark:bg-zinc-900 border-2 border-indigo-400/20 rounded-xl font-black text-[10px] dark:text-white outline-none"
                                    value={newCouponType}
                                    onChange={e => setNewCouponType(e.target.value as any)}
                                  >
                                      <option value="PERCENT">%</option>
                                      <option value="FIXED">R$</option>
                                  </select>
                              </div>
                          </div>
                          <div className="sm:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-2">Condições / Regras</label>
                                  <input 
                                    className="w-full px-5 py-3 bg-white dark:bg-zinc-900 border-2 border-indigo-400/20 rounded-xl font-bold text-[10px] dark:text-white outline-none focus:border-indigo-500 transition-all" 
                                    value={newCouponConditions} 
                                    onChange={e => setNewCouponConditions(e.target.value)} 
                                    placeholder="EX: VÁLIDO ACIMA DE R$ 100"
                                  />
                              </div>
                              <div>
                                  <span className="text-[8px] font-black text-slate-400 uppercase w-full ml-2 mb-1 block">Restringir Pagamento:</span>
                                  <div className="flex flex-wrap gap-2">
                                      {(config?.payment_methods || []).map(pm => (
                                          <button 
                                            key={pm}
                                            onClick={() => {
                                                const restriction = `[PGTO: ${pm}]`;
                                                if (newCouponConditions.includes(restriction)) {
                                                    setNewCouponConditions(newCouponConditions.replace(restriction, '').trim());
                                                } else {
                                                    setNewCouponConditions(`${newCouponConditions} ${restriction}`.trim());
                                                }
                                            }}
                                            className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border transition-all ${
                                                newCouponConditions.includes(`[PGTO: ${pm}]`) 
                                                ? 'bg-indigo-100 text-indigo-700 border-indigo-300' 
                                                : 'bg-slate-50 text-slate-400 border-slate-200'
                                            }`}
                                          >
                                              {pm}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      </div>
                      <button 
                        onClick={handleAddOrUpdateCoupon} 
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                          {editingCouponCode ? <RefreshCcw size={16}/> : <Plus size={16}/>}
                          {editingCouponCode ? 'Atualizar Cupom' : 'Cadastrar Novo Cupom'}
                      </button>
                      {editingCouponCode && (
                          <button onClick={() => {
                              setEditingCouponCode(null);
                              setNewCouponCode('');
                              setNewCouponNumeric('');
                              setNewCouponValue(0);
                              setNewCouponConditions('');
                          }} className="w-full py-2 text-slate-400 font-black uppercase text-[8px] tracking-widest">Cancelar Edição</button>
                      )}
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                      {sortedCoupons.map(c => (
                          <div key={c.code} className="px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border-2 border-dashed border-indigo-400/50 flex flex-col group transition-all hover:border-indigo-400">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                      <Tag size={14} className="text-indigo-500"/>
                                      <div>
                                          <p className="text-[10px] font-black uppercase dark:text-white leading-none">{c.code} {c.numeric_code && <span className="text-slate-400 ml-1 text-[8px]">(#{c.numeric_code})</span>}</p>
                                          <p className="text-[8px] font-bold text-indigo-500 uppercase mt-1">{c.type === 'PERCENT' ? `${c.discount}%` : `R$ ${c.discount}`} OFF</p>
                                      </div>
                                  </div>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                      <button onClick={() => handleEditCoupon(c.code)} className="text-blue-500"><Pencil size={14}/></button>
                                      <button onClick={() => setConfig({...config, active_coupons: (config.active_coupons || []).filter(x => x.code !== c.code)})} className="text-red-400"><X size={14}/></button>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default TicketingConfigManager;
