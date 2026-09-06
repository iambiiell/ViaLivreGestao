
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Save, Loader2, CheckCircle2, AlertTriangle, Settings2, Users, Key, Calendar, CreditCard, RefreshCw, Palette, Pipette, Check } from 'lucide-react';
import { RoleConfig, Subscription, SystemSettings } from '../types';
import { db } from '../services/database';
import { PRESET_THEME_COLORS, resolveThemeColors, isValidHexColor, applyThemeVariables } from '../utils/themeHelper';

interface SystemConfigManagerProps {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}

const SystemConfigManager: React.FC<SystemConfigManagerProps> = ({ addToast }) => {
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [activationKey, setActivationKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    loadRoles();
    loadSubscription();
    loadSystemSettings();
  }, []);

  const loadSystemSettings = async () => {
    try {
      const data = await db.getSystemSettings();
      if (data && data.length > 0) {
        setSystemSettings(data[0]);
      } else {
        const defaultSettings: Partial<SystemSettings> = {
          system_name: 'CONSIMP Controle de Frotas',
          registration_pattern: 'FLX-000',
          system_url: window.location.origin
        };
        const created = await db.create('system_settings', defaultSettings);
        setSystemSettings(created as SystemSettings);
      }
    } catch (error) {
      console.error('Error loading system settings:', error);
    }
  };

  const handleUpdateSystemSetting = (field: keyof SystemSettings, value: any) => {
    if (!systemSettings) return;
    const updated = { ...systemSettings, [field]: value };
    setSystemSettings(updated);

    const root = document.documentElement;
    if (field === 'theme_color') {
      applyThemeVariables(value);
    } else if (field === 'glass_effect') {
      if (value === false) {
        root.classList.add('glass-disabled');
        root.classList.remove('glass-enabled');
      } else {
        root.classList.remove('glass-disabled');
        root.classList.add('glass-enabled');
      }
    } else if (field === 'high_contrast') {
      if (value) {
        root.classList.add('high-contrast');
      } else {
        root.classList.remove('high-contrast');
      }
    }

    try {
      localStorage.setItem('vialivre_system_settings', JSON.stringify(updated));
    } catch (e) {}
  };

  const loadSubscription = async () => {
    try {
      const subs = await db.getSubscriptions();
      if (subs && subs.length > 0) {
        setSubscription(subs[0]);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const handleActivateKey = async () => {
    if (!activationKey) return;
    setIsActivating(true);
    try {
      const keys = await db.getActivationKeys();
      const key = keys.find(k => k.key_code === activationKey && !k.is_used);
      
      if (!key) {
        addToast('Chave inválida ou já utilizada.', 'error');
        return;
      }

      await db.update('activation_keys', {
        ...key,
        is_used: true,
        activated_at: new Date().toISOString(),
        activated_by_system_id: db.getSystemId()
      });

      let expiresAt = new Date();
      if (key.duration_type === 'DAYS') {
        const durationDays = key.duration_days || 30;
        expiresAt.setDate(expiresAt.getDate() + durationDays);
      } else {
        const durationMonths = key.duration_months || (key.plan_type === 'LIFETIME' ? 120 : key.plan_type === 'ANNUAL' ? 12 : key.plan_type === 'SEMI_ANNUAL' ? 6 : key.plan_type === 'QUARTERLY' ? 3 : 1);
        if (durationMonths === 999) {
          expiresAt = new Date(2099, 11, 31, 23, 59, 59);
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
        }
      }

      const newSub: Partial<Subscription> = {
        system_id: db.getSystemId()!,
        plan_type: key.plan_type,
        activated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      };

      if (subscription) {
        await db.update('subscriptions', { ...subscription, ...newSub });
      } else {
        await db.create('subscriptions', newSub);
      }

      addToast('Sistema ativado com sucesso!', 'success');
      setActivationKey('');
      loadSubscription();
    } catch (error) {
      console.error('Error activating key:', error);
      addToast('Erro ao ativar sistema.', 'error');
    } finally {
      setIsActivating(false);
    }
  };

  const loadRoles = async () => {
    setIsLoading(true);
    try {
      const data = await db.getRoleConfigs();
      setRoles((data || []).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      addToast("Erro ao carregar configurações de cargos.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePermission = (roleId: string, field: keyof RoleConfig) => {
    setRoles(prev => prev.map(role => {
      if (role.id === roleId) {
        return { ...role, [field]: !role[field] };
      }
      return role;
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      if (systemSettings) {
        await db.update('system_settings', systemSettings);
        try {
          localStorage.setItem('vialivre_system_settings', JSON.stringify(systemSettings));
        } catch (e) {}
        applyThemeVariables(systemSettings.theme_color);
      }
      await Promise.all(roles.map(role => db.update('role_configs', role)));
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      addToast("Configurações atualizadas com sucesso!", "success");
    } catch (error) {
      addToast("Erro ao salvar configurações.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Carregando permissões...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-slate-900 rounded-[2rem] shadow-xl border-2 border-yellow-400">
              <ShieldCheck size={32} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter dark:text-white leading-none">Gestão de Acessos</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Configure as abas visíveis para cada cargo do sistema</p>
            </div>
          </div>
          <button 
            onClick={handleSaveAll}
            disabled={isSaving}
            className="w-full md:w-auto px-10 py-5 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 rounded-3xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 border-2 border-yellow-400 hover:scale-105 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Salvar Alterações
          </button>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border-2 border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors mb-8">
          <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <Settings2 className="text-indigo-500" size={24} />
              <h3 className="text-lg font-black uppercase italic tracking-tighter">Configurações Gerais</h3>
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest leading-none">URL do Sistema para Integrações</label>
                  <div className="relative">
                    <RefreshCw className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="https://sua-url.com" 
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 rounded-2xl text-xs font-black outline-none focus:ring-2 ring-indigo-400 transition-all dark:text-white"
                      value={systemSettings?.system_url || ''}
                      onChange={e => handleUpdateSystemSetting('system_url', e.target.value)}
                    />
                  </div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase italic mt-2">Esta URL é utilizada para geração de links em tickets e notificações.</p>
               </div>
            </div>
            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest leading-none">Nome do Sistema na Interface</label>
                  <input 
                    type="text" 
                    placeholder="Nome do Sistema" 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-700 rounded-2xl text-xs font-black outline-none focus:ring-2 ring-indigo-400 transition-all dark:text-white"
                    value={systemSettings?.system_name || ''}
                    onChange={e => handleUpdateSystemSetting('system_name', e.target.value)}
                  />
               </div>
            </div>

            {/* Seção de Cores Primárias e Paleta Visual */}
            <div className="col-span-full border-t border-slate-50 dark:border-zinc-800/50 pt-6">
              <div className="p-6 bg-slate-50 dark:bg-zinc-800/40 rounded-3xl border-2 border-slate-100 dark:border-zinc-800 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-yellow-400 text-slate-950">
                      <Palette size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                        Cor Primária e Identidade do Sistema
                      </h4>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase italic mt-0.5">
                        Defina a cor principal de botões, tags, menus e destaques em toda a aplicação.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Cor Ativa:</span>
                    <span className="text-xs font-mono font-black uppercase px-3 py-1 rounded-xl bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 flex items-center gap-1.5 shadow-sm">
                      <span 
                        className="w-3.5 h-3.5 rounded-full border border-black/10 inline-block" 
                        style={{ backgroundColor: resolveThemeColors(systemSettings?.theme_color).primary }} 
                      />
                      {resolveThemeColors(systemSettings?.theme_color).hex}
                    </span>
                  </div>
                </div>

                {/* Seletor Customizado Interativo */}
                <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <input
                        type="color"
                        value={resolveThemeColors(systemSettings?.theme_color).hex}
                        onChange={(e) => handleUpdateSystemSetting('theme_color', e.target.value.toLowerCase())}
                        className="w-12 h-12 rounded-2xl border-2 border-slate-200 dark:border-zinc-700 cursor-pointer shadow-md bg-transparent p-0 overflow-hidden"
                        title="Seletor de cor livre"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-slate-800 dark:text-zinc-200">Escolher Cor Livre (Color Picker)</p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase">
                        Clique no círculo para escolher qualquer tom ou digite o código HEX
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">HEX:</span>
                    <input
                      type="text"
                      maxLength={7}
                      placeholder="#FACC15"
                      value={resolveThemeColors(systemSettings?.theme_color).hex}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith('#') && val.length <= 7) {
                          if (isValidHexColor(val) || val.length === 4 || val.length === 7) {
                            handleUpdateSystemSetting('theme_color', val.toLowerCase());
                          }
                        }
                      }}
                      className="w-28 px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold uppercase text-center dark:text-white outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                </div>

                {/* Paletas Pré-configuradas em Grade */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2.5 tracking-widest leading-none">
                    Ou selecione uma das paletas oficiais recomendadas:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {PRESET_THEME_COLORS.map(palette => {
                      const currentTheme = systemSettings?.theme_color || 'yellow';
                      const isSelected = currentTheme === palette.id || currentTheme.toLowerCase() === palette.primary.toLowerCase();
                      return (
                        <button
                          type="button"
                          key={palette.id}
                          onClick={() => handleUpdateSystemSetting('theme_color', palette.id)}
                          className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2 ${
                            isSelected 
                              ? 'border-yellow-400 bg-white dark:bg-zinc-900 shadow-md scale-[1.02]' 
                              : 'border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 bg-white/70 dark:bg-zinc-900/40'
                          }`}
                        >
                          <div 
                            className="w-6 h-6 rounded-full shadow-md border border-black/10" 
                            style={{ backgroundColor: palette.primary }} 
                          />
                          <span className="text-[10px] font-black uppercase tracking-tight text-slate-800 dark:text-zinc-200 leading-tight">
                            {palette.name.split(' (')[0]}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 font-bold">{palette.primary}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-full border-t border-slate-50 dark:border-zinc-800/50 pt-6 space-y-4">
                {/* Efeito Translúcido / Glassmorphism */}
                <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-zinc-800/40 rounded-3xl border-2 border-slate-200 dark:border-zinc-700">
                  <div className="mr-4">
                    <h4 className="text-sm font-black uppercase text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                       Efeito Translúcido (Glassmorphism)
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase italic mt-1 leading-normal max-w-xl">
                      Aplica acabamento translúcido de alta definição com desfoque de fundo (backdrop-filter) e bordas suaves sobre os cards e painéis do sistema.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={systemSettings?.glass_effect !== false}
                      onChange={e => handleUpdateSystemSetting('glass_effect', e.target.checked)}
                    />
                    <div className="w-14 h-8 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-yellow-400 border-2 border-slate-900"></div>
                  </label>
                </div>

                {/* Alto Contraste */}
                <div className="flex items-center justify-between p-6 bg-yellow-50 dark:bg-zinc-800/40 rounded-3xl border-2 border-yellow-400">
                  <div className="mr-4">
                    <h4 className="text-sm font-black uppercase text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                       Acessibilidade: Modo de Alto Contraste
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase italic mt-1 leading-normal max-w-xl">
                      Altera as cores de botões, tags e menus para cores sólidas de alto contraste, otimizando a leitura para motoristas em ambientes externos com alta luminosidade.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={!!systemSettings?.high_contrast}
                      onChange={e => handleUpdateSystemSetting('high_contrast', e.target.checked)}
                    />
                    <div className="w-14 h-8 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-yellow-400 border-2 border-slate-900"></div>
                  </label>
                </div>
            </div>
          </div>
        </div>

        {/* GitHub System Updates Simulator */}
        <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border-2 border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <RefreshCw className="text-yellow-500 animate-spin" style={{ animationDuration: '6s' }} size={24} />
              <h3 className="text-lg font-black uppercase italic tracking-tighter">Atualizações do Sistema (GitHub)</h3>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-6 bg-slate-50 dark:bg-zinc-800/45 rounded-3xl border border-slate-100 dark:border-zinc-800">
              <div className="space-y-1">
                <h4 className="text-sm font-black uppercase text-slate-900 dark:text-zinc-100">
                  Verificação de Nova Versão
                </h4>
                <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase italic leading-normal max-w-xl">
                  O sistema monitora automaticamente o canal de releases no GitHub para notificar os operadores sobre novos updates importantes em tempo real.
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Versão Atual do Cliente</span>
                <span className="px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black text-slate-700 dark:text-zinc-300 rounded-full border border-slate-200 dark:border-zinc-700">
                  v2.0
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100 dark:border-zinc-800/60">
              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Simular Publicação de Nova Versão</label>
                <p className="text-[9px] font-bold text-slate-400 uppercase italic">Para testar o aviso do sistema de imediato, selecione uma versão fictícia para simular uma nova atualização no GitHub.</p>
                
                <div className="flex flex-wrap gap-2 pt-2">
                  {[
                    { id: 'v2.1', label: 'Simular v2.1' },
                    { id: 'v2.5', label: 'Simular v2.5' },
                    { id: 'v3.0', label: 'Simular v3.0 (Major)' },
                    { id: 'NONE', label: 'Desativar Simulação' },
                  ].map((opt) => {
                    const currentSim = localStorage.getItem('vialivre_simulated_github_update') || 'NONE';
                    const isSelected = currentSim === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          if (opt.id === 'NONE') {
                            localStorage.removeItem('vialivre_simulated_github_update');
                            addToast('Simulação desativada. Verificação real do GitHub reestabelecida.', 'success');
                          } else {
                            localStorage.setItem('vialivre_simulated_github_update', opt.id);
                            addToast(`Simulação ativada! Chave de versão fictícia configurada para ${opt.id}.`, 'success');
                          }
                          // trigger update check custom event
                          window.dispatchEvent(new CustomEvent('vialivre-check-github-update'));
                        }}
                        className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase transition-all border-2 ${
                          isSelected
                            ? 'bg-yellow-400 border-slate-900 text-slate-900 shadow-md scale-102 font-black'
                            : 'bg-transparent border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Canal de Configuração Técnica</label>
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-900 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest">Repositório Alvo</p>
                    <p className="text-[10px] font-mono text-zinc-400 break-all leading-none">vianicolausa/ViaLivre-Gestao</p>
                  </div>
                  <a 
                    href="https://github.com/vianicolausa/ViaLivre-Gestao" 
                    target="_blank" 
                    rel="no-referrer"
                    className="p-3 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-all text-[9px] font-black uppercase tracking-wider shrink-0"
                  >
                    Ver GitHub
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>


        <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border-2 border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors mb-8">
          <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <CreditCard className="text-blue-500" size={24} />
              <h3 className="text-lg font-black uppercase italic tracking-tighter">Assinatura do Sistema</h3>
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                <div>
                  <p className="text-[10px] font-black uppercase text-black">Plano Atual</p>
                  <p className="text-lg font-black uppercase italic text-blue-600">
                    {subscription ? (
                      subscription.plan_type === 'MONTHLY' ? 'Mensal' :
                      subscription.plan_type === 'QUARTERLY' ? 'Trimestral' :
                      subscription.plan_type === 'SEMI_ANNUAL' ? 'Semestral' : 'Anual'
                    ) : 'Nenhum Plano Ativo'}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${subscription?.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  {subscription?.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </div>
              </div>
              {subscription && (
                <div className="flex items-center gap-4 text-slate-500">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span className="text-[10px] font-bold uppercase">Expira em: {new Date(subscription.expires_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase text-black">Ativar Nova Chave</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="VL-XXXX-XXXX" 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-blue-400 transition-all dark:text-white"
                    value={activationKey}
                    onChange={e => setActivationKey(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleActivateKey}
                  disabled={isActivating || !activationKey}
                  className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isActivating ? <RefreshCw className="animate-spin" size={16} /> : 'Ativar'}
                </button>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase italic">Insira a chave fornecida pelo administrador para renovar ou alterar seu plano.</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border-2 border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/50 transition-colors">
                  <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-zinc-800">Cargo / Função</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-zinc-800">Vendas</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-zinc-800">Guia Motorista</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-zinc-800">Gestão Global</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-zinc-800">Monitoramento</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-zinc-800">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 group-hover:bg-yellow-400 group-hover:text-slate-900 transition-all">
                          <Users size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase italic dark:text-white">{role.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {role.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={!!role.access_sales}
                          onChange={() => handleTogglePermission(role.id, 'access_sales')}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-400"></div>
                      </label>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={!!role.access_driver_guide}
                          onChange={() => handleTogglePermission(role.id, 'access_driver_guide')}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-400"></div>
                      </label>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={!!role.access_global_management}
                          onChange={() => handleTogglePermission(role.id, 'access_global_management')}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-400"></div>
                      </label>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={!!role.access_monitoring}
                          onChange={() => handleTogglePermission(role.id, 'access_monitoring')}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-400"></div>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>


        <div className="mt-10 p-8 bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-[2.5rem] flex items-start gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl text-blue-600 dark:text-blue-400">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase italic text-blue-800 dark:text-blue-300">Atenção Admin</h4>
            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-2 leading-relaxed">
              As alterações feitas aqui impactam diretamente o que cada colaborador verá em seu menu lateral. 
              Certifique-se de salvar as alterações para que entrem em vigor no próximo carregamento do sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemConfigManager;
