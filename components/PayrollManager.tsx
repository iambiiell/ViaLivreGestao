
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, PayrollRecord, Company, PayrollRubric, Occurrence, RoleConfig } from '../types';
import { Banknote, Search, Loader2, Save, X, Calculator, Plus, Info, Trash2, Printer, CheckCircle2, UserCircle, Briefcase, FileCheck, Layers, ArrowRight, Percent, History, Download, Eye, RefreshCw } from 'lucide-react';
import { db } from '../services/database';
import { formatDate } from '../utils/dateFormatter';

declare const html2pdf: any;

interface PayrollItem {
    id: string;
    rubric_id: string;
    code: string;
    description: string;
    reference: string;
    value: number;
    rawInput?: string; // Para suportar %
    type: 'EARNING' | 'DEDUCTION' | 'INFO';
}

const PayrollManager: React.FC<{ users: User[], companies: Company[], addToast: (m: string, t?: any) => void }> = ({ users = [], companies = [], addToast }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [availableRubrics, setAvailableRubrics] = useState<PayrollRubric[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  const [rubricSearch, setRubricSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [refMonth, setRefMonth] = useState('03/2025');
  const [isSyncing, setIsSyncing] = useState(false);

  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId), [users, selectedUserId]);
  const activeCompany = useMemo(() => companies.find(c => c.active) || companies[0], [companies]);

  useEffect(() => {
    Promise.all([
      db.getRubrics(),
      db.getRoleConfigs()
    ]).then(([rubricsData, rolesData]) => {
      const sorted = (rubricsData || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setAvailableRubrics(sorted);
      setRoleConfigs(rolesData || []);
    });
  }, []);

  const collaboratorSalary = useMemo(() => {
    if (!selectedUserId) return 0;
    const user = users.find(u => u.id === selectedUserId);
    if (!user) return 0;
    
    const matchedRole = roleConfigs.find(rc => 
      rc.name.toUpperCase() === (user.job_title || '').toUpperCase() || 
      rc.base_role === user.role
    );
    if (matchedRole) {
      return matchedRole.base_salary;
    }
    
    if (user.role === 'ADMIN') return 4500;
    else if (user.role === 'RH') return 4000;
    else if (user.role === 'MECHANIC') return 3200;
    else if (user.role === 'FISCAL') return 3000;
    else if (user.role === 'DRIVER') return 3500;
    else return 2800;
  }, [selectedUserId, users, roleConfigs]);

  const baseSalaryValue = useMemo(() => {
    const base = items.find(i => i.code === '001');
    return base?.value || collaboratorSalary || 0;
  }, [items, collaboratorSalary]);

  const filteredAvailableRubrics = useMemo(() => {
    const cleanSearch = rubricSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return availableRubrics.filter(r => {
      const codeClean = String(r.code || '').toLowerCase();
      const nameClean = String(r.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return codeClean.includes(cleanSearch) || nameClean.includes(cleanSearch);
    });
  }, [availableRubrics, rubricSearch]);

  const totals = useMemo(() => {
      const earnings = items.filter(i => i.type === 'EARNING').reduce((acc, i) => acc + i.value, 0);
      const deductions = items.filter(i => i.type === 'DEDUCTION').reduce((acc, i) => acc + i.value, 0);
      return { earnings, deductions, net: earnings - deductions };
  }, [items]);

  const recalculateItems = (
    currentItems: PayrollItem[], 
    availableRubricsList: PayrollRubric[], 
    colabSalary: number
  ): PayrollItem[] => {
    const baseItem = currentItems.find(i => i.code === '001');
    const currentBaseSalaryValue = baseItem ? baseItem.value : colabSalary;

    return currentItems.map(item => {
      if (item.code === '001') {
        return item;
      }

      const rubricDef = availableRubricsList.find(r => r.id === item.rubric_id || r.code === item.code);
      if (!rubricDef) return item;

      const hasConditions = rubricDef.has_conditions === true || String(rubricDef.has_conditions) === 'true';
      if (!hasConditions) return item;

      let condValStr = '';
      let symbolStr = '';

      if (item.rawInput) {
        if (item.rawInput.endsWith('%')) {
          condValStr = item.rawInput.replace('%', '');
          symbolStr = '%';
        } else {
          condValStr = item.rawInput;
          symbolStr = '';
        }
      } else {
        condValStr = String(rubricDef.condition_value || '0');
        symbolStr = rubricDef.condition_symbol || '';
      }

      const parsedVal = parseFloat(condValStr.replace(',', '.')) || 0;

      let baseValue = currentBaseSalaryValue;
      if (rubricDef.condition_base_rubric_id) {
        const refItem = currentItems.find(i => i.rubric_id === rubricDef.condition_base_rubric_id);
        if (refItem) {
          baseValue = refItem.value;
        } else {
          const refRubric = availableRubricsList.find(r => r.id === rubricDef.condition_base_rubric_id);
          if (refRubric) {
            const refHasConditions = refRubric.has_conditions === true || String(refRubric.has_conditions) === 'true';
            if (refHasConditions) {
              const refCondVal = parseFloat(String(refRubric.condition_value || '0').replace(',', '.')) || 0;
              if (refRubric.condition_symbol === '%') {
                baseValue = (refCondVal / 100) * currentBaseSalaryValue;
              } else {
                baseValue = refCondVal;
              }
            } else if (refRubric.code === '001') {
              baseValue = colabSalary;
            } else {
              baseValue = 0;
            }
          }
        }
      }

      let calculatedVal = 0;
      if (symbolStr === '%') {
        calculatedVal = (parsedVal / 100) * baseValue;
      } else {
        calculatedVal = parsedVal;
      }

      const referenceText = symbolStr === '%' ? `${condValStr}%` : '30d';

      if (Math.abs(item.value - calculatedVal) > 0.01 || item.reference !== referenceText || item.rawInput !== (item.rawInput || (symbolStr === '%' ? `${condValStr}%` : condValStr))) {
        return {
          ...item,
          value: calculatedVal,
          rawInput: item.rawInput || (symbolStr === '%' ? `${condValStr}%` : condValStr),
          reference: referenceText
        };
      }

      return item;
    });
  };

  // Automatically calculate and populate items when a new collaborator is selected
  useEffect(() => {
    if (!selectedUserId || availableRubrics.length === 0) {
      setItems([]);
      return;
    }

    const baseRubric = availableRubrics.find(r => r.code === '001') || {
      id: 'rubric-base',
      code: '001',
      name: 'SALÁRIO BASE',
      type: 'EARNING'
    };

    const initialItems: PayrollItem[] = [
      {
        id: 'item-base-' + Date.now(),
        rubric_id: baseRubric.id,
        code: baseRubric.code,
        description: baseRubric.name,
        reference: '30d',
        value: collaboratorSalary,
        rawInput: collaboratorSalary.toString(),
        type: 'EARNING'
      }
    ];

    const inssRubric = availableRubrics.find(r => r.code === '501');
    const vtRubric = availableRubrics.find(r => r.code === '550');

    if (inssRubric) {
      const condVal = inssRubric.condition_value || '0';
      const condSymbol = inssRubric.condition_symbol || '';
      initialItems.push({
        id: 'item-inss-' + Date.now(),
        rubric_id: inssRubric.id,
        code: inssRubric.code,
        description: inssRubric.name,
        reference: inssRubric.condition_symbol === '%' ? `${inssRubric.condition_value}%` : '30d',
        value: 0,
        rawInput: condSymbol === '%' ? `${condVal}%` : String(condVal),
        type: 'DEDUCTION'
      });
    }

    if (vtRubric) {
      const condVal = vtRubric.condition_value || '0';
      const condSymbol = vtRubric.condition_symbol || '';
      initialItems.push({
        id: 'item-vt-' + Date.now(),
        rubric_id: vtRubric.id,
        code: vtRubric.code,
        description: vtRubric.name,
        reference: vtRubric.condition_symbol === '%' ? `${vtRubric.condition_value}%` : '30d',
        value: 0,
        rawInput: condSymbol === '%' ? `${condVal}%` : String(condVal),
        type: 'DEDUCTION'
      });
    }

    const calculatedInitial = recalculateItems(initialItems, availableRubrics, collaboratorSalary);
    setItems(calculatedInitial);
  }, [selectedUserId, availableRubrics, collaboratorSalary]);

  // Keep items in sync with collaboratorSalary changes or base definition updates
  useEffect(() => {
    if (items.length > 0 && availableRubrics.length > 0) {
      const fresh = recalculateItems(items, availableRubrics, collaboratorSalary);
      
      let changed = false;
      for (let i = 0; i < items.length; i++) {
        if (!fresh[i]) continue;
        if (
          Math.abs(items[i].value - fresh[i].value) > 0.01 || 
          items[i].reference !== fresh[i].reference ||
          items[i].rawInput !== fresh[i].rawInput
        ) {
          changed = true;
          break;
        }
      }
      
      if (changed) {
        setItems(fresh);
      }
    }
  }, [collaboratorSalary, availableRubrics]);

  const addItem = (rubric: PayrollRubric) => {
      let initialRawInput = '0';
      let initialValue = 0;

      const hasConditions = rubric.has_conditions === true || String(rubric.has_conditions) === 'true';

      if (hasConditions && rubric.condition_value !== undefined && rubric.condition_value !== null) {
          const condValStr = String(rubric.condition_value).replace(',', '.');
          const symbolStr = rubric.condition_symbol || '';
          initialRawInput = `${condValStr}${symbolStr}`;
          const parsedVal = parseFloat(condValStr) || 0;
          if (symbolStr === '%') {
              initialValue = (parsedVal / 100) * baseSalaryValue;
          } else {
              initialValue = parsedVal;
          }
      }

      // Evita lançamentos de códigos idênticos no mesmo holerite
      const codeExists = items.find(i => i.code === rubric.code);
      if (codeExists) {
          addToast(`A rubrica [${rubric.code}] já existe neste holerite.`, "warning");
          return;
      }

      const newItem: PayrollItem = {
          id: Math.random().toString(36).substr(2, 9),
          rubric_id: rubric.id,
          code: rubric.code,
          description: rubric.name,
          reference: rubric.condition_symbol === '%' ? `${rubric.condition_value}%` : '30d',
          value: initialValue,
          rawInput: initialRawInput,
          type: rubric.type
      };

      const newItems = [...items, newItem];
      const recalculated = recalculateItems(newItems, availableRubrics, collaboratorSalary);
      setItems(recalculated);
  };

  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));

  const syncOccurrences = async () => {
    if (!selectedUserId) return addToast("Selecione um colaborador primeiro.", "error");
    setIsSyncing(true);
    try {
      const occurrences = await db.getOccurrences();
      const userOccurrences = occurrences.filter((occ: Occurrence) => 
        occ.user_id === selectedUserId && 
        !occ.is_justified &&
        (occ.type === 'FALTA' || occ.type === 'ATRASO')
      );

      if (userOccurrences.length === 0) {
        addToast("Nenhuma ocorrência não justificada encontrada para este colaborador.", "info");
        return;
      }

      const newItems = [...items];
      let addedCount = 0;

      userOccurrences.forEach((occ: Occurrence) => {
        const rubricName = occ.type === 'FALTA' ? 'FALTAS' : 'ATRASOS';
        const rubric = availableRubrics.find(r => r.name.toUpperCase().includes(rubricName) || r.code === (occ.type === 'FALTA' ? '401' : '402'));
        
        if (rubric) {
          // Evitar duplicados para a mesma data se já existir na lista atual
          const alreadyExists = newItems.find(i => i.rubric_id === rubric.id && i.reference.includes(occ.date.split('-').reverse().join('/')));
          if (!alreadyExists) {
            const value = occ.type === 'FALTA' ? (baseSalaryValue / 30) : 0; // Cálculo simples para falta
            newItems.push({
              id: Math.random().toString(36).substr(2, 9),
              rubric_id: rubric.id,
              code: rubric.code,
              description: `${rubric.name} (${occ.date.split('-').reverse().join('/')})`,
              reference: occ.type === 'FALTA' ? '1d' : (occ.hours_lost || '0h'),
              value: value,
              rawInput: value.toString(),
              type: 'DEDUCTION'
            });
            addedCount++;
          }
        }
      });

      const recalculated = recalculateItems(newItems, availableRubrics, collaboratorSalary);
      setItems(recalculated);
      addToast(`${addedCount} ocorrências sincronizadas com sucesso.`, "success");
    } catch (error) {
      console.error(error);
      addToast("Erro ao sincronizar ocorrências.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const updateItemValue = (id: string, field: 'value' | 'reference', val: string) => {
      const updated = items.map(i => {
          if (i.id !== id) return i;
          
          if (field === 'reference') return { ...i, reference: val };
          
          let numericValue: number;
          let finalInput = val;

          // Regra solicitada: Se o valor anterior era '0' e o usuário digitou um número, substitui o '0'
          if (i.rawInput === '0' && val.length > 1 && !val.includes('%')) {
              if (/^[1-9]/.test(val.slice(-1)) || val === '00') {
                 finalInput = val.slice(1);
              }
          }

          if (finalInput.endsWith('%')) {
              const perc = parseFloat(finalInput.replace('%', '').replace(',', '.')) || 0;
              numericValue = (perc / 100) * baseSalaryValue;
          } else {
              numericValue = parseFloat(finalInput.replace(',', '.')) || 0;
          }

          return { ...i, value: numericValue, rawInput: finalInput };
      });

      const recalculated = recalculateItems(updated, availableRubrics, collaboratorSalary);
      setItems(recalculated);
  };

  const handleSaveAndGenerate = async () => {
    if (!selectedUserId || items.length === 0) return addToast("Selecione o colaborador e lance eventos.", "error");
    setIsProcessing(true);
    try {
        await new Promise(r => setTimeout(r, 1500));
        setShowPreview(true);
        addToast("Holerite registrado e pronto para impressão.", "success");
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-24">
      <div className="no-print space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border-2 border-yellow-400">
              <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-slate-900 rounded-2xl text-yellow-400 shadow-lg"><Banknote size={24}/></div>
                  <h2 className="text-xl font-black uppercase italic dark:text-white">Motor de Folha Dinâmico</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-2">
                      <label className="block text-[9px] font-black text-black uppercase mb-2 ml-2">Colaborador (Busca por Nome para UUID)</label>
                      <select 
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-950 border-2 border-yellow-400 rounded-2xl font-bold dark:text-white outline-none"
                        value={selectedUserId || ''}
                        onChange={e => setSelectedUserId(e.target.value)}
                      >
                          <option value="">Selecione o nome do funcionário...</option>
                          {users.sort((a,b) => (a.full_name||'').localeCompare(b.full_name||'')).map((u, idx) => (
                              <option key={u.id || idx} value={u.id}>{u.full_name?.toUpperCase()}</option>
                          ))}
                      </select>
                      {selectedUser && (
                        <p className="mt-2 ml-2 text-[8px] font-mono text-indigo-500 font-bold">VÍNCULO UUID: {selectedUser.id}</p>
                      )}
                  </div>
                  <div>
                      <label className="block text-[9px] font-black text-black uppercase mb-2 ml-2">Competência (MM/YYYY)</label>
                      <input className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-950 border-2 border-yellow-400 rounded-2xl font-bold dark:text-white outline-none" value={refMonth || ''} onChange={e => setRefMonth(e.target.value)} placeholder="03/2025" />
                  </div>
                  <div className="flex items-end">
                      <button 
                        onClick={syncOccurrences}
                        disabled={isSyncing || !selectedUserId}
                        className="w-full py-4 bg-slate-900 text-yellow-400 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-50"
                      >
                        {isSyncing ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
                        Sincronizar Ocorrências
                      </button>
                  </div>
              </div>
          </div>

          {selectedUser && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4">
                <div className="lg:col-span-1 bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border dark:border-zinc-800 shadow-sm flex flex-col">
                    <h3 className="text-[10px] font-black text-black uppercase mb-4 flex items-center gap-2"><Layers size={14}/> Eventos de Rubricas</h3>
                    
                    <div className="relative mb-4">
                        <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar código ou nome..." 
                            className="w-full pl-10 pr-8 py-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border-2 border-yellow-400/20 text-[10px] font-black uppercase outline-none dark:text-zinc-300 shadow-inner transition-all focus:border-yellow-400" 
                            value={rubricSearch} 
                            onChange={e => setRubricSearch(e.target.value)} 
                        />
                        {rubricSearch && (
                            <button 
                                onClick={() => setRubricSearch('')}
                                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="space-y-1 max-h-[500px] overflow-y-auto custom-scrollbar pr-2 flex-1">
                        {availableRubrics.length === 0 ? (
                            <div className="p-4 text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase">Carregando dicionário...</p>
                            </div>
                        ) : filteredAvailableRubrics.length === 0 ? (
                            <div className="p-4 text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase">Nenhuma rubrica localizada.</p>
                            </div>
                        ) : (
                            filteredAvailableRubrics.map((rub, idx) => (
                                <button 
                                    key={rub.id || idx} 
                                    onClick={() => addItem(rub)}
                                    className="w-full text-left p-3 rounded-xl border border-transparent hover:border-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-all group"
                                >
                                    <div className="flex items-center gap-3 w-full overflow-hidden">
                                        <span className="text-[10px] font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-lg group-hover:bg-yellow-400 group-hover:text-slate-900 shrink-0">{rub.code}</span>
                                        <span className="text-[8px] font-bold text-slate-500 dark:text-zinc-400 uppercase whitespace-nowrap truncate leading-none group-hover:text-yellow-600">{rub.name}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="lg:col-span-3 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border-2 border-yellow-400 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-50 dark:bg-zinc-800 font-black uppercase text-black">
                                <tr>
                                    <th className="px-4 py-3">Evento</th>
                                    <th className="px-4 py-3">Referência</th>
                                    <th className="px-4 py-3">Valor (R$ ou %)</th>
                                    <th className="px-4 py-3">Cálculo Real</th>
                                    <th className="px-4 py-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-zinc-800">
                                {items.map((item, idx) => (
                                    <tr key={item.id || idx}>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-black dark:text-white">[{item.code}]</span>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase">{item.description}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <input className="w-16 bg-slate-100 dark:bg-zinc-950 p-2 rounded-lg font-bold outline-none border-2 border-transparent focus:border-yellow-400" value={item.reference || ''} onChange={e => updateItemValue(item.id, 'reference', e.target.value)} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="relative">
                                                <input 
                                                    className="w-32 bg-slate-100 dark:bg-zinc-950 p-2 rounded-lg font-black outline-none border-2 border-transparent focus:border-indigo-500 transition-all" 
                                                    value={item.rawInput || ''} 
                                                    onChange={e => updateItemValue(item.id, 'value', e.target.value)} 
                                                />
                                                {item.rawInput?.includes('%') && <Percent className="absolute right-3 top-2.5 text-indigo-500" size={14}/>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`font-black ${item.type === 'DEDUCTION' ? 'text-red-500' : item.type === 'INFO' ? 'text-indigo-400' : 'text-emerald-600'}`}>
                                                {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => removeItem(item.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-all"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="mt-8 flex justify-between items-center p-6 bg-slate-900 rounded-[2rem] border-2 border-yellow-400 shadow-xl">
                        <div className="flex gap-10">
                            <div className="text-center">
                                <p className="text-[8px] font-black text-yellow-400 uppercase">Vencimentos</p>
                                <p className="text-lg font-black text-white">R$ {totals.earnings.toFixed(2)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[8px] font-black text-red-400 uppercase">Descontos</p>
                                <p className="text-lg font-black text-white">R$ {totals.deductions.toFixed(2)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[8px] font-black text-emerald-400 uppercase">Líquido</p>
                                <p className="text-lg font-black text-white">R$ {totals.net.toFixed(2)}</p>
                            </div>
                        </div>
                        <button 
                            disabled={isProcessing}
                            onClick={handleSaveAndGenerate}
                            className="px-10 py-5 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs flex items-center gap-3 shadow-lg active:scale-95 transition-all"
                        >
                            {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <FileCheck size={20}/>}
                            Salvar e Gerar Holerite A4
                        </button>
                    </div>
                </div>
            </div>
          )}
      </div>

      {showPreview && selectedUser && (
          <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md overflow-y-auto no-print flex items-center justify-center p-4 animate-in fade-in duration-500">
              <div className="flex flex-col items-center gap-6">
                <div className="flex gap-4">
                    <button onClick={() => window.print()} className="px-10 py-4 bg-yellow-400 text-slate-900 rounded-full font-black uppercase text-xs flex items-center gap-3 shadow-2xl hover:scale-105 transition-all"><Printer size={20}/> Imprimir Folha A4</button>
                    <button onClick={() => setShowPreview(false)} className="px-10 py-4 bg-white/10 text-white border border-white/20 rounded-full font-black uppercase text-xs flex items-center gap-3 shadow-2xl hover:bg-red-500 transition-all"><X size={20}/> Fechar</button>
                </div>
                
                <div id="payslip-a4" className="bg-white text-black p-12 font-mono text-[11px] shadow-[0_0_100px_rgba(255,255,255,0.2)]" style={{ width: '210mm', minHeight: '297mm' }}>
                    <div className="border-4 border-black p-8 mb-6">
                        <div className="flex justify-between items-center border-b-2 border-black pb-6 mb-6">
                            <div>
                                <h1 className="text-3xl font-black uppercase leading-none">{activeCompany?.name || 'ViaLivre Gestão'}</h1>
                                <p className="text-xs uppercase mt-2">CNPJ: {activeCompany?.cnpj || '00.000.000/0001-99'}</p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-2xl font-black uppercase">Recibo de Pagamento</h2>
                                <p className="text-sm font-bold mt-2">MÊS DE REFERÊNCIA: {refMonth}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-8 text-[10px]">
                            <div className="col-span-2 border-r-2 border-black pr-6">
                                <p className="font-bold text-gray-500 uppercase mb-1">Nome do Funcionário</p>
                                <p className="text-base font-black uppercase">{selectedUser.full_name}</p>
                            </div>
                            <div className="border-r-2 border-black pr-6">
                                <p className="font-bold text-gray-500 uppercase mb-1">Matrícula</p>
                                <p className="text-base font-black">{selectedUser.registration_id || '---'}</p>
                            </div>
                            <div>
                                <p className="font-bold text-gray-500 uppercase mb-1">Cargo</p>
                                <p className="text-base font-black uppercase">{selectedUser.job_title || 'Colaborador'}</p>
                            </div>
                        </div>
                    </div>

                    <table className="w-full border-collapse border-2 border-black mb-6">
                        <thead className="bg-gray-100 border-b-2 border-black text-[10px] font-black uppercase">
                            <tr>
                                <th className="p-3 border-r-2 border-black text-center w-[10%]">Código</th>
                                <th className="p-3 border-r-2 border-black text-left w-[40%]">Descrição do Evento</th>
                                <th className="p-3 border-r-2 border-black text-center w-[10%]">Ref</th>
                                <th className="p-3 border-r-2 border-black text-right w-[20%]">Vencimentos</th>
                                <th className="p-3 text-right w-[20%]">Descontos</th>
                            </tr>
                        </thead>
                        <tbody className="text-[12px]">
                            {items.filter(i => i.type === 'EARNING').map((it, idx) => (
                                <tr key={it.id || `earn-${idx}`} className="border-b border-gray-200">
                                    <td className="p-3 border-r-2 border-black text-center font-bold">{it.code}</td>
                                    <td className="p-3 border-r-2 border-black uppercase font-black">{it.description}</td>
                                    <td className="p-3 border-r-2 border-black text-center">{it.reference}</td>
                                    <td className="p-3 border-r-2 border-black text-right font-black">{it.value.toFixed(2)}</td>
                                    <td className="p-3 text-right">---</td>
                                </tr>
                            ))}
                            {items.filter(i => i.type === 'DEDUCTION').map((it, idx) => (
                                <tr key={it.id || `ded-${idx}`} className="border-b border-gray-200">
                                    <td className="p-3 border-r-2 border-black text-center font-bold">{it.code}</td>
                                    <td className="p-3 border-r-2 border-black uppercase font-black">{it.description}</td>
                                    <td className="p-3 border-r-2 border-black text-center">{it.reference}</td>
                                    <td className="p-3 border-r-2 border-black text-right">---</td>
                                    <td className="p-3 text-right font-black">{it.value.toFixed(2)}</td>
                                </tr>
                            ))}
                            {Array.from({ length: Math.max(0, 15 - items.length) }).map((_, i) => (
                                <tr key={`empty-${i}`} className="border-b border-gray-100 h-10">
                                    <td className="border-r-2 border-black"></td><td className="border-r-2 border-black"></td><td className="border-r-2 border-black"></td><td className="border-r-2 border-black"></td><td></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="grid grid-cols-2 gap-8 mb-10">
                        <div className="border-2 border-black p-6 space-y-3">
                            <div className="flex justify-between border-b border-black pb-1"><span className="uppercase font-bold">Total de Vencimentos</span><span className="font-black text-base">R$ {totals.earnings.toFixed(2)}</span></div>
                            <div className="flex justify-between border-b border-black pb-1"><span className="uppercase font-bold">Total de Descontos</span><span className="font-black text-base">R$ {totals.deductions.toFixed(2)}</span></div>
                            <div className="bg-black text-white p-5 flex justify-between items-center mt-6">
                                <span className="uppercase font-black text-sm italic">Líquido a Receber</span>
                                <span className="text-3xl font-black italic">R$ {totals.net.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="border-2 border-black p-6">
                            <h4 className="text-[11px] font-black uppercase mb-4 border-b border-black pb-2">Bases e Informativos</h4>
                            <div className="grid grid-cols-2 gap-y-4">
                                {items.filter(i => i.type === 'INFO').map((it, idx) => (
                                    <div key={it.id || `info-${idx}`}>
                                        <p className="text-[9px] font-bold text-gray-500 uppercase">{it.description}</p>
                                        <p className="font-black text-base">R$ {it.value.toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-12 mt-24">
                        <div className="text-center pt-8 border-t-2 border-black">
                            <p className="text-[11px] font-black uppercase">Assinatura do Funcionário</p>
                            <p className="text-[9px] text-gray-400 mt-2">Confirmo o recebimento integral dos valores acima.</p>
                        </div>
                        <div className="text-center pt-8 border-t-2 border-black">
                            <p className="text-[11px] font-black uppercase">ViaLivre Gestão Operacional</p>
                            <p className="text-[9px] text-gray-400 mt-2">Emitido eletronicamente em: {formatDate(new Date())}</p>
                        </div>
                    </div>
                </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PayrollManager;
