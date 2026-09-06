import React, { useState, useEffect } from 'react';
import { Upload, Copy, Trash2, Search, Plus, CheckCircle2, AlertCircle, X, Download, Edit2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, supabase } from '../services/database';
import { Skin, Company, User } from '../types';

interface SkinRepositoryProps {
  currentUser: User | null;
  companies: Company[];
  skins: Skin[];
}

export default function SkinRepository({ currentUser, companies, skins }: SkinRepositoryProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newSkin, setNewSkin] = useState({
    skin_name: '',
    bus_model: '',
    company_id: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingSkin, setEditingSkin] = useState<Skin | null>(null);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'png' || extension === 'dds') {
        setSelectedFile(file);
      } else {
        showNotification('error', 'Apenas arquivos .png ou .dds são permitidos.');
        e.target.value = '';
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !newSkin.skin_name || !newSkin.bus_model || !newSkin.company_id) {
      showNotification('error', 'Preencha todos os campos e selecione um arquivo.');
      return;
    }

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const systemPath = currentUser?.system_id ? `${currentUser.system_id}/` : '';
      const filePath = `skins/${systemPath}${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('skins')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('skins')
        .getPublicUrl(filePath);

      const skinData: Partial<Skin> = {
        ...newSkin,
        file_url: publicUrl
      };

      await db.create('skins', skinData);
      showNotification('success', 'Skin enviada com sucesso!');
      setShowUploadModal(false);
      setNewSkin({ skin_name: '', bus_model: '', company_id: '' });
      setSelectedFile(null);
    } catch (error) {
      console.error('Error uploading skin:', error);
      showNotification('error', 'Erro ao enviar skin.');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    showNotification('success', 'Link copiado!');
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!confirm('Tem certeza que deseja excluir esta skin?')) return;

    try {
      // Extract file path from URL
      const path = fileUrl.split('/storage/v1/object/public/skins/')[1];
      if (path) {
        await supabase.storage.from('skins').remove([path]);
      }
      await db.delete('skins', id);
      showNotification('success', 'Skin excluída.');
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
    } catch (error) {
      console.error('Error deleting skin:', error);
      showNotification('error', 'Erro ao excluir skin.');
    }
  };

  const handleDownload = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${name}.${url.split('.').pop()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      showNotification('success', 'Download iniciado!');
    } catch (error) {
      console.error('Error downloading skin:', error);
      showNotification('error', 'Erro ao baixar skin.');
    }
  };

  const handleUpdate = async () => {
    if (!editingSkin) return;
    setUploading(true);
    try {
      let fileUrl = editingSkin.file_url;

      if (editingFile) {
        // Delete old file if it exists
        const oldPath = editingSkin.file_url.split('/storage/v1/object/public/skins/')[1];
        if (oldPath) {
          await supabase.storage.from('skins').remove([oldPath]);
        }

        // Upload new file
        const fileExt = editingFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const systemPath = currentUser?.system_id ? `${currentUser.system_id}/` : '';
        const filePath = `skins/${systemPath}${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('skins')
          .upload(filePath, editingFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('skins')
          .getPublicUrl(filePath);
        
        fileUrl = publicUrl;
      }

      await db.update('skins', { ...editingSkin, file_url: fileUrl });
      showNotification('success', 'Skin atualizada com sucesso!');
      setEditingSkin(null);
      setEditingFile(null);
    } catch (error) {
      console.error('Error updating skin:', error);
      showNotification('error', 'Erro ao atualizar skin.');
    } finally {
      setUploading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const filteredSkins = (skins || []).filter(skin => 
    skin.skin_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    skin.bus_model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 bg-white dark:bg-zinc-950 min-h-screen text-slate-900 dark:text-white transition-colors">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic">REPOSITÓRIO DE SKINS</h1>
          <p className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">Gerencie e hospede skins para seus veículos</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg"
        >
          <Plus size={20} />
          Nova Skin
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por nome ou modelo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-gray-800 rounded-lg py-2 pl-10 pr-4 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="flex overflow-x-auto pb-6 gap-6 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:overflow-x-visible md:pb-0 md:snap-none custom-scrollbar">
          {filteredSkins.map((skin) => (
            <motion.div
              key={skin.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="min-w-[280px] sm:min-w-[320px] md:min-w-0 snap-center flex-1 bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden group hover:border-blue-500/50 transition-all h-full flex flex-col shadow-sm hover:shadow-md"
            >
              <div className="aspect-video bg-slate-100 dark:bg-[#2a2a2a] flex items-center justify-center relative overflow-hidden shrink-0">
                {skin.file_url.endsWith('.png') ? (
                  <img src={skin.file_url} alt={skin.skin_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="text-slate-400 dark:text-gray-500 flex flex-col items-center">
                    <Upload size={40} className="mb-2" />
                    <span className="text-xs uppercase font-bold">DDS File</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => copyToClipboard(skin.file_url)}
                    className="p-2 bg-blue-600 rounded-lg hover:bg-blue-700 text-white transition-colors"
                    title="Copiar Link"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => handleDownload(skin.file_url, skin.skin_name)}
                    className="p-2 bg-emerald-600 rounded-lg hover:bg-emerald-700 text-white transition-colors"
                    title="Baixar Skin"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => setEditingSkin(skin)}
                    className="p-2 bg-amber-600 rounded-lg hover:bg-amber-700 text-white transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(skin.id, skin.file_url)}
                    className="p-2 bg-red-600 rounded-lg hover:bg-red-700 text-white transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-lg mb-1 truncate text-slate-900 dark:text-white">{skin.skin_name}</h3>
                <div className="flex justify-between items-center text-sm mt-auto">
                  <span className="text-slate-500 dark:text-gray-400">{skin.bus_model}</span>
                  <span className="text-blue-600 dark:text-blue-400 text-xs font-medium px-2 py-1 bg-blue-50 dark:bg-blue-400/10 rounded">
                    {companies.find(c => c.id === skin.company_id)?.name || 'Empresa'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nova Skin</h2>
                <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-gray-400 mb-1">Nome da Skin</label>
                  <input
                    type="text"
                    value={newSkin.skin_name}
                    onChange={(e) => setNewSkin({ ...newSkin, skin_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#2a2a2a] border border-slate-200 dark:border-gray-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ex: ViaLivre Gestão Express"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-gray-400 mb-1">Modelo do Ônibus</label>
                  <input
                    type="text"
                    value={newSkin.bus_model}
                    onChange={(e) => setNewSkin({ ...newSkin, bus_model: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#2a2a2a] border border-slate-200 dark:border-gray-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ex: Marcopolo G8"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-gray-400 mb-1">Empresa</label>
                  <select
                    value={newSkin.company_id}
                    onChange={(e) => setNewSkin({ ...newSkin, company_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#2a2a2a] border border-slate-200 dark:border-gray-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Selecione uma empresa</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-gray-400 mb-1">Arquivo (.png ou .dds)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".png,.dds"
                      onChange={handleFileChange}
                      className="hidden"
                      id="skin-file"
                    />
                    <label
                      htmlFor="skin-file"
                      className="flex items-center justify-center gap-2 w-full bg-slate-50 dark:bg-[#2a2a2a] border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-lg px-4 py-8 hover:border-blue-500 cursor-pointer transition-colors"
                    >
                      <Upload size={24} className="text-slate-400" />
                      <span className="text-slate-500 dark:text-gray-400">{selectedFile ? selectedFile.name : 'Clique para selecionar'}</span>
                    </label>
                  </div>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Upload size={20} />
                      Enviar Skin
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingSkin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center">
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase italic">Editar Skin</h2>
                <button onClick={() => setEditingSkin(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-2">Nome da Skin</label>
                  <input
                    type="text"
                    value={editingSkin.skin_name}
                    onChange={(e) => setEditingSkin({ ...editingSkin, skin_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#2a2a2a] border border-slate-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-2">Modelo do Ônibus</label>
                  <input
                    type="text"
                    value={editingSkin.bus_model}
                    onChange={(e) => setEditingSkin({ ...editingSkin, bus_model: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#2a2a2a] border border-slate-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-2">Empresa</label>
                  <select
                    value={editingSkin.company_id}
                    onChange={(e) => setEditingSkin({ ...editingSkin, company_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#2a2a2a] border border-slate-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Selecione uma empresa</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-2">Nova Imagem (Opcional)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".png,.dds"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setEditingFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      id="edit-skin-file"
                    />
                    <label
                      htmlFor="edit-skin-file"
                      className="flex items-center justify-center gap-2 w-full bg-slate-50 dark:bg-[#2a2a2a] border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-xl px-4 py-6 hover:border-blue-500 cursor-pointer transition-colors"
                    >
                      <Upload size={20} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-500 dark:text-gray-400 truncate max-w-[200px]">
                        {editingFile ? editingFile.name : 'Alterar imagem'}
                      </span>
                    </label>
                  </div>
                </div>
                <button
                  onClick={handleUpdate}
                  disabled={uploading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black uppercase text-xs py-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xl"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Save size={18} />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-lg shadow-2xl z-50 ${
              notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
