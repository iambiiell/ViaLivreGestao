import React, { useState, useMemo } from 'react';
import { BusStation, User, Company } from '../types';
import { 
  Plus, 
  Trash2, 
  MapPin, 
  AlertTriangle, 
  Loader2, 
  X, 
  Pencil, 
  Search, 
  Save, 
  Building2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cepMask } from '../utils/masks';
import { fetchAddress } from '../services/cep';

interface BusStationManagerProps {
  busStations?: BusStation[];
  companies?: Company[];
  users?: User[];
  currentUser?: User | null;
  onAddStation: (station: Partial<BusStation>) => void;
  onUpdateStation: (station: BusStation) => void;
  onDeleteStation: (id: string) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const BusStationManager: React.FC<BusStationManagerProps> = ({ 
  busStations = [], 
  onAddStation, 
  onUpdateStation, 
  onDeleteStation,
  addToast 
}) => {
  // Station Modal States
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [deletingStationId, setDeletingStationId] = useState<string | null>(null);
  
  // Station Form States
  const [name, setName] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [platforms, setPlatforms] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  // Helper to parse stored address string
  const parseStoredAddress = (addr: string) => {
    if (!addr) return { cepVal: '', logVal: '', barVal: '', cidVal: '', estVal: '', numVal: '', compVal: '' };
    
    let cepVal = '';
    const cepMatch = addr.match(/CEP:\s*([0-9\-]+)/i);
    if (cepMatch) cepVal = cepMatch[1];

    let logVal = '';
    let numVal = '';
    let compVal = '';
    let barVal = '';
    let cidVal = '';
    let estVal = '';

    const parts = addr.split(',').map(p => p.trim());
    if (parts.length >= 1) logVal = parts[0];
    
    if (parts.length >= 2) {
      const rest = parts[1];
      const dashSplit = rest.split('-').map(p => p.trim());
      if (dashSplit.length > 0) numVal = dashSplit[0];
      if (dashSplit.length > 1) compVal = dashSplit[1];
    }

    if (parts.length >= 3) {
      barVal = parts[2];
    }

    if (parts.length >= 4) {
      const cityState = parts[3].split('-').map(p => p.trim());
      if (cityState.length > 0) cidVal = cityState[0];
      if (cityState.length > 1) estVal = cityState[1];
    }

    return {
      cepVal,
      logVal,
      barVal,
      cidVal,
      estVal,
      numVal,
      compVal
    };
  };

  // Filtered Stations
  const filteredStations = useMemo(() => {
    return (busStations || [])
      .filter(s => 
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.platforms || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [busStations, searchTerm]);

  // Station Handlers
  const handleOpenStationModal = (station?: BusStation) => {
    if (station) { 
      setEditingStationId(station.id); 
      setName(station.name); 
      const parsed = parseStoredAddress(station.address);
      setCep(parsed.cepVal);
      setLogradouro(parsed.logVal);
      setBairro(parsed.barVal);
      setCidade(parsed.cidVal);
      setEstado(parsed.estVal);
      setNumber(parsed.numVal);
      setComplement(parsed.compVal);
      setPlatforms(station.platforms);
    } 
    else { 
      setEditingStationId(null); 
      setName(''); 
      setCep('');
      setLogradouro('');
      setBairro('');
      setCidade('');
      setEstado('');
      setNumber('');
      setComplement('');
      setPlatforms('');
    }
    setIsStationModalOpen(true);
  };

  const handleStationCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = cepMask(e.target.value);
    setCep(val);
    
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsLoadingCep(true);
      try {
        const data = await fetchAddress(clean);
        if (data) {
          setLogradouro(data.addressStreet || '');
          setBairro(data.addressNeighborhood || '');
          setCidade(data.addressCity || '');
          setEstado(data.addressState || '');
        } else {
          addToast("CEP não encontrado.", "warning");
        }
      } catch (err) {
        addToast("Erro ao buscar CEP.", "error");
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const handleToggleStatus = (station: BusStation) => {
    const newStatus = station.is_active === false ? true : false;
    onUpdateStation({ ...station, is_active: newStatus });
    addToast(`Rodoviária ${newStatus ? 'ativada' : 'inativada'} com sucesso!`, 'success');
  };

  const handleSaveStation = () => {
    if (!name.trim() || !platforms.trim()) {
      addToast("Preencha o Nome e ao menos uma Plataforma.", "error");
      return;
    }
    if (!cep.trim() || !logradouro.trim() || !bairro.trim() || !cidade.trim() || !estado.trim() || !number.trim()) {
      addToast("Preencha todos os campos obrigatórios do endereço (CEP, Logradouro, Número, Bairro, Cidade e Estado).", "error");
      return;
    }
    
    const combinedAddress = `${logradouro}, ${number}${complement ? ` - ${complement}` : ''} - ${bairro}, ${cidade} - ${estado}, CEP: ${cep}`;
    
    const existingStation = busStations.find(s => s.id === editingStationId);
    const stationData: Partial<BusStation> = { 
      name: name.trim(), 
      address: combinedAddress, 
      platforms: platforms.trim(),
      is_active: existingStation ? (existingStation.is_active !== false) : true
    };
    
    if (editingStationId) {
      onUpdateStation({ ...stationData, id: editingStationId } as BusStation);
      addToast("Rodoviária atualizada com sucesso!", "success");
    } else {
      onAddStation(stationData);
      addToast("Rodoviária cadastrada com sucesso!", "success");
    }
    setIsStationModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 gap-6 transition-colors">
        <div className="flex-1 w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 rounded-2xl">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                Rodoviárias Conveniadas
              </h2>
              <p className="text-xs text-slate-400 uppercase font-bold">
                Gerencie terminais rodoviários e plataformas de embarque
              </p>
            </div>
            <span className="text-xs font-extrabold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-3 py-1 rounded-full border border-slate-200 dark:border-zinc-700 ml-2">
              {busStations.length}
            </span>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-4 top-4 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar rodoviária, endereço ou plataforma..." 
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black uppercase outline-none shadow-inner dark:text-zinc-300 transition-all placeholder:text-slate-400"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => handleOpenStationModal()} 
            className="w-full md:w-auto px-6 py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-extrabold text-[10px] uppercase rounded-2xl flex items-center justify-center gap-2 border-2 border-slate-950 transition-colors shadow-lg select-none cursor-pointer"
          >
            <Plus size={16} /> Nova Rodoviária
          </button>
        </div>
      </div>

      {/* Stations Grid */}
      {filteredStations.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 p-16 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 text-center uppercase tracking-tighter transition-colors">
          <Building2 className="mx-auto text-slate-300 dark:text-zinc-700 mb-4" size={48} />
          <h3 className="text-xl font-black text-slate-400 dark:text-zinc-500">Nenhuma Rodoviária Encontrada</h3>
          <p className="mt-2 text-xs text-slate-400">Clique em "Nova Rodoviária" acima para adicionar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStations.map((station) => (
            <motion.div 
              layout
              key={station.id}
              className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800 flex flex-col justify-between shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-2xl text-red-600 dark:text-red-400">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                        station.is_active !== false 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${station.is_active !== false ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {station.is_active !== false ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleToggleStatus(station)}
                      className={`px-2.5 py-2 rounded-xl transition-all cursor-pointer text-[9px] font-black uppercase ${
                        station.is_active !== false 
                          ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20' 
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300'
                      }`}
                      title={station.is_active !== false ? 'Desativar Rodoviária' : 'Ativar Rodoviária'}
                    >
                      {station.is_active !== false ? 'Desativar' : 'Ativar'}
                    </button>
                    <button 
                      onClick={() => handleOpenStationModal(station)} 
                      className="p-2 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl transition-all cursor-pointer"
                      title="Editar Rodoviária"
                    >
                      <Pencil size={14} />
                    </button>
                    <button 
                      onClick={() => setDeletingStationId(station.id)} 
                      className="p-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 rounded-xl transition-all cursor-pointer"
                      title="Excluir Rodoviária"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-white leading-none tracking-tight">{station.name}</h4>
                  <div className="mt-3 flex items-start gap-2 text-slate-500 dark:text-zinc-400">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-red-500" />
                    <span className="text-[10px] font-black leading-tight">{station.address}</span>
                  </div>
                </div>

                {/* Platforms Badge */}
                <div className="pt-2 border-t border-slate-50 dark:border-zinc-800/50">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-2">Plataformas Disponíveis:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {station.platforms.split(',').map((p, idx) => (
                      <span 
                        key={idx} 
                        className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[8px] font-black rounded-lg border border-slate-200 dark:border-zinc-700"
                      >
                        {p.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* MODAL: ADICIONAR / EDITAR RODOVIÁRIA */}
      <AnimatePresence>
        {isStationModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-zinc-800 shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center p-8 border-b border-slate-50 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-2.5">
                  <Building2 size={22} className="text-yellow-500" />
                  {editingStationId ? 'Editar Rodoviária' : 'Adicionar Rodoviária'}
                </h3>
                <button 
                  onClick={() => setIsStationModalOpen(false)} 
                  className="p-2 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-full text-slate-400 dark:text-zinc-300 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Nome Comercial *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Rodoviária Central" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2 flex items-center justify-between">
                      <span>CEP *</span>
                      {isLoadingCep && <Loader2 size={12} className="animate-spin text-yellow-500" />}
                    </label>
                    <input 
                      type="text" 
                      placeholder="00000-000" 
                      value={cep} 
                      onChange={handleStationCepChange}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">UF / Estado *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: GO" 
                      value={estado} 
                      onChange={e => setEstado(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Logradouro *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Avenida Goiás" 
                      value={logradouro} 
                      onChange={e => setLogradouro(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Número *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 1000" 
                      value={number} 
                      onChange={e => setNumber(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Complemento</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Terminal 2" 
                      value={complement} 
                      onChange={e => setComplement(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Bairro *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Centro" 
                      value={bairro} 
                      onChange={e => setBairro(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Cidade *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Goiânia" 
                      value={cidade} 
                      onChange={e => setCidade(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Plataformas (separadas por vírgula) *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Plataforma 1, Plataforma 2, Plataforma 3" 
                    value={platforms} 
                    onChange={e => setPlatforms(e.target.value)}
                    className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 p-8 border-t border-slate-50 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
                <button 
                  onClick={() => setIsStationModalOpen(false)} 
                  className="px-6 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-extrabold text-[10px] uppercase rounded-2xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveStation} 
                  className="px-6 py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-extrabold text-[10px] uppercase rounded-2xl border-2 border-slate-950 flex items-center gap-2 select-none cursor-pointer"
                >
                  <Save size={14} /> Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CONFIRMAR EXCLUSÃO DE RODOVIÁRIA */}
      <AnimatePresence>
        {deletingStationId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-2xl flex flex-col text-center"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-2">Excluir Rodoviária?</h3>
              <p className="text-xs text-slate-500 mb-8 uppercase font-bold">Esta ação é irreversível e pode afetar itinerários já vinculados a esta estação.</p>
              
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => setDeletingStationId(null)} 
                  className="px-6 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-extrabold text-[10px] uppercase rounded-2xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    onDeleteStation(deletingStationId);
                    setDeletingStationId(null);
                    addToast("Rodoviária removida.", "info");
                  }} 
                  className="px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10px] uppercase rounded-2xl border-2 border-red-950 select-none cursor-pointer"
                >
                  Excluir Definitivamente
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusStationManager;
