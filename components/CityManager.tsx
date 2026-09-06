
import React, { useState, useEffect, useMemo } from 'react';
import { City, User } from '../types';
import { Plus, Trash2, MapPin, AlertTriangle, Loader2, X, Pencil, Binary, Search, Save, Globe } from 'lucide-react';

interface CityManagerProps {
  cities: City[];
  currentUser: User | null;
  onAddCity: (city: Partial<City>) => void;
  onUpdateCity: (city: City) => void;
  onDeleteCity: (id: string) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

const BRAZIL_STATES = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const CityManager: React.FC<CityManagerProps> = ({ cities = [], onAddCity, onUpdateCity, onDeleteCity, addToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newCityName, setNewCityName] = useState('');
  const [newState, setNewState] = useState('');
  const [isIntermunicipal, setIsIntermunicipal] = useState(false);
  const [manualCode, setManualCode] = useState<string>('');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCities = useMemo(() => {
    return (cities || [])
      .filter(c => 
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.state || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cities, searchTerm]);

  useEffect(() => {
      if (newState && !isIntermunicipal) {
          setTimeout(() => setIsLoadingCities(true), 0);
          fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${newState}/municipios`)
            .then(res => res.json())
            .then(data => { 
                setAvailableCities(data.map((c: any) => c.nome).sort()); 
            })
            .catch(() => {})
            .finally(() => setIsLoadingCities(false));
      } else { 
        setTimeout(() => setAvailableCities([]), 0); 
      }
  }, [newState, isIntermunicipal]);

  const handleOpenModal = (city?: City) => {
      if (city) { 
          setEditingId(city.id); 
          setNewState(city.state); 
          setNewCityName(city.name);
          setIsIntermunicipal(city.name.includes('INTERMUNICIPAL'));
          setManualCode(city.code.toString());
      } 
      else { 
          setEditingId(null); 
          setNewState(''); 
          setNewCityName(''); 
          setIsIntermunicipal(false);
          setManualCode((cities.length + 1).toString());
      }
      setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!newState || !manualCode || (!isIntermunicipal && !newCityName)) {
        addToast("Preencha o Estado e a Cidade (ou marque Intermunicipal).", "error");
        return;
    }
    
    const cityName = isIntermunicipal ? `INTERMUNICIPAL (${newState})` : newCityName;
    const cityData: any = { name: cityName, state: newState, code: Number(manualCode) };
    
    if (editingId) {
        onUpdateCity({ ...cityData, id: editingId });
    } else {
        onAddCity(cityData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 gap-4 transition-colors">
        <div className="flex-1 w-full">
            <h2 className="text-3xl font-black text-black dark:text-zinc-100 tracking-tighter uppercase italic leading-none transition-colors">Municípios Atendidos</h2>
            <div className="mt-6 relative max-w-md">
                <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Pesquisar cidade ou estado..." 
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black uppercase outline-none shadow-inner dark:text-zinc-300 transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-8 py-4 rounded-2xl hover:bg-blue-700 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95"><Plus size={20} /> Nova Cidade</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCities.map((city) => (
          <div key={city.id}>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 flex justify-between items-center hover:shadow-xl transition-all group relative overflow-hidden transition-colors h-full">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-lg shadow-inner">{city.state}</div>
                <div>
                    <h3 className="font-black text-slate-800 dark:text-white uppercase text-sm leading-tight tracking-tight">{city.name}</h3>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Cód. Operacional: {city.code}</p>
                </div>
              </div>
              <div className="flex gap-1 items-center">
                  <button onClick={() => handleOpenModal(city)} className="p-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all"><Pencil size={18}/></button>
                  
                  {deletingId === city.id ? (
                    <div className="flex gap-1 animate-in fade-in slide-in-from-right-2">
                      <button 
                        onClick={() => { onDeleteCity(city.id); setDeletingId(null); }} 
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
                      onClick={() => setDeletingId(city.id)} 
                      className="p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                      title="Excluir Cidade"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] border dark:border-zinc-800 overflow-hidden transition-colors animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic leading-none">{editingId ? 'Editar Cidade' : 'Nova Cidade'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:rotate-90 transition-transform"><X size={32}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-blue-400">
                    <Globe className="text-blue-500" size={24}/>
                    <div className="flex-1">
                      <label className="text-[10px] font-black text-black uppercase">Apenas Intermunicipal</label>
                      <p className="text-[8px] text-black">Marque para registrar todo o estado sem cidade fixa</p>
                    </div>
                    <input type="checkbox" className="w-6 h-6 rounded-lg accent-blue-600" checked={isIntermunicipal} onChange={e => setIsIntermunicipal(e.target.checked)} />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-black uppercase mb-2 ml-2">Estado (UF) *</label>
                    <select className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 outline-none" value={newState} onChange={e => setNewState(e.target.value)}>
                        <option value="">Selecione...</option>
                        {BRAZIL_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                </div>
                {!isIntermunicipal && (
                  <div className="animate-in fade-in duration-300">
                      <label className="block text-[10px] font-black text-black uppercase mb-2 ml-2">Cidade *</label>
                      <div className="relative">
                          <select disabled={!newState || isLoadingCities} className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 appearance-none outline-none" value={newCityName} onChange={e => setNewCityName(e.target.value)}>
                              <option value="">{isLoadingCities ? 'Carregando cidades...' : 'Selecione...'}</option>
                              {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          {isLoadingCities && <Loader2 className="absolute right-4 top-4 animate-spin text-blue-500" size={20}/>}
                      </div>
                  </div>
                )}
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Cód. Operacional *</label>
                    <input type="number" className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 outline-none" value={manualCode} onChange={e => setManualCode(e.target.value)} />
                </div>
                <div className="flex gap-4 pt-6">
                    <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest border-none transition-colors">Cancelar</button>
                    <button onClick={handleSave} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 border-2 border-blue-400 transition-all"><Save size={20}/> Salvar Cidade</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CityManager;
