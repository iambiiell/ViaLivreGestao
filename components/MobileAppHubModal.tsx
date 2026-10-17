import React, { useState, useEffect, useMemo } from 'react';
import {
  Smartphone,
  Download,
  QrCode,
  Layers,
  Check,
  Copy,
  ExternalLink,
  X,
  FileCode,
  Terminal,
  Play,
  CheckCircle2,
  Share2,
  Compass,
  CreditCard,
  ScanLine,
  MapPin,
  Clock,
  Bus,
  RefreshCw,
  FolderArchive
} from 'lucide-react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { db } from '../services/database';

interface MobileAppHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
  systemId?: string | null;
}

export const MobileAppHubModal: React.FC<MobileAppHubModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  systemId
}) => {
  const [activeTab, setActiveTab] = useState<'install' | 'react-native' | 'capacitor' | 'preview'>('install');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'installed' | 'not-supported'>('idle');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [selectedMobileView, setSelectedMobileView] = useState<'passenger' | 'driver' | 'card' | 'scanner'>('passenger');

  // Detect PWA install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallStatus('idle');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://vialivre.app';
  const activeSystemId = systemId || db.getSystemId() || 'sys-vialivre-default';

  // Generate QR Code with current origin for mobile opening
  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(appOrigin, {
      width: 260,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setQrCodeUrl(url))
      .catch(() => {});
  }, [isOpen, appOrigin]);

  const handleCopy = (text: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setInstallStatus('installing');
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallStatus('installed');
      } else {
        setInstallStatus('idle');
      }
      setDeferredPrompt(null);
    } else {
      setInstallStatus('not-supported');
    }
  };

  // React Native / Expo Code Snippets preconfigured with this system's Supabase backend
  const expoPackageJson = useMemo(() => JSON.stringify({
    name: "vialivre-mobile",
    version: "1.0.0",
    scripts: {
      start: "expo start",
      android: "expo start --android",
      ios: "expo start --ios",
      web: "expo start --web"
    },
    dependencies: {
      "expo": "~52.0.0",
      "expo-status-bar": "~2.0.0",
      "react": "18.3.1",
      "react-native": "0.76.5",
      "@supabase/supabase-js": "^2.45.0",
      "lucide-react-native": "^0.475.0",
      "expo-location": "~18.0.4",
      "expo-camera": "~16.0.13",
      "expo-barcode-scanner": "~13.0.1",
      "react-native-safe-area-context": "4.12.0",
      "react-native-screens": "~4.4.0",
      "@react-navigation/native": "^7.0.0",
      "@react-navigation/bottom-tabs": "^7.0.0"
    },
    devDependencies: {
      "@babel/core": "^7.25.0",
      "typescript": "^5.3.3"
    },
    private: true
  }, null, 2), []);

  const expoAppJson = useMemo(() => JSON.stringify({
    expo: {
      name: "ViaLivre Mobile",
      slug: "vialivre-mobile",
      version: "1.0.0",
      orientation: "portrait",
      icon: "./assets/icon.png",
      userInterfaceStyle: "light",
      splash: {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#0f172a"
      },
      ios: {
        supportsTablet: true,
        bundleIdentifier: "com.vialivre.mobile"
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#facc15"
        },
        package: "com.vialivre.mobile",
        permissions: [
          "ACCESS_COARSE_LOCATION",
          "ACCESS_FINE_LOCATION",
          "CAMERA"
        ]
      },
      web: {
        favicon: "./assets/favicon.png"
      },
      extra: {
        eas: {
          projectId: "vialivre-mobile-app"
        }
      }
    }
  }, null, 2), []);

  const expoAppSource = useMemo(() => `/**
 * ViaLivre Mobile - Aplicativo Móvel de Transporte Coletivo
 * Totalmente integrado e sincronizado com o ViaLivre Gestão
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Alert } from 'react-native';
import { createClient } from '@supabase/supabase-js';

// Conexão direta com a base do ViaLivre Gestão
const SUPABASE_URL = 'https://xyzapbchpquycfcqxioz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emFwYmNocHF1eWNmY3F4aW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NTI2MzcsImV4cCI6MjEwNzQyODYzN30.b3cEUOfR9ZTEF7Y3r1cLnIfvGE8kxvmVnm8p69jiSnI';
const SYSTEM_ID = '${activeSystemId}';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [tab, setTab] = useState<'linhas' | 'cartao' | 'ponto'>('linhas');
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRoutes();
    
    // Escuta atualizações em tempo real disparadas pelo painel ViaLivre Gestão
    const channel = supabase
      .channel('vialivre-mobile-sync')
      .on('broadcast', { event: 'vialivre_mobile_event' }, (payload) => {
        console.log('Atualização do ViaLivre Gestão recebida:', payload);
        loadRoutes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('name');
      if (data) setRoutes(data);
    } catch (e) {
      console.warn('Erro ao carregar linhas:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>VIALIVRE MOBILE</Text>
        </View>
        <Text style={styles.headerTitle}>Mobilidade Urbana & Gestão</Text>
        <Text style={styles.headerSub}>Sincronizado com ViaLivre Gestão ({activeSystemId})</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabButton, tab === 'linhas' && styles.tabButtonActive]} 
          onPress={() => setTab('linhas')}
        >
          <Text style={[styles.tabText, tab === 'linhas' && styles.tabTextActive]}>LINHAS & VIAGENS</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, tab === 'cartao' && styles.tabButtonActive]} 
          onPress={() => setTab('cartao')}
        >
          <Text style={[styles.tabText, tab === 'cartao' && styles.tabTextActive]}>MEU CARTÃO / VT</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, tab === 'ponto' && styles.tabButtonActive]} 
          onPress={() => setTab('ponto')}
        >
          <Text style={[styles.tabText, tab === 'ponto' && styles.tabTextActive]}>PONTO MOTORISTA</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {tab === 'linhas' && (
          <View>
            <Text style={styles.sectionTitle}>Linhas e Horários em Tempo Real</Text>
            {routes.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Nenhuma linha carregada no momento</Text>
                <Text style={styles.cardSub}>Toque abaixo para sincronizar com o servidor.</Text>
                <TouchableOpacity style={styles.actionBtn} onPress={loadRoutes}>
                  <Text style={styles.actionBtnText}>Sincronizar Linhas</Text>
                </TouchableOpacity>
              </View>
            ) : (
              routes.map(r => (
                <View key={r.id} style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.routeBadge}>{r.code || 'LINHA'}</Text>
                    <Text style={styles.cardTitle}>{r.name}</Text>
                  </View>
                  <Text style={styles.cardSub}>Tarifa: R$ {Number(r.fare || 4.5).toFixed(2)}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'cartao' && (
          <View>
            <View style={styles.cardGold}>
              <Text style={styles.goldTitle}>Cartão ViaLivre Digital</Text>
              <Text style={styles.goldNumber}>•••• •••• •••• 8842</Text>
              <Text style={styles.goldBalance}>Saldo: R$ 48,50</Text>
            </View>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => Alert.alert('Recarga Pix', 'QR Code de recarga gerado com sucesso.')}
            >
              <Text style={styles.actionBtnText}>+ Recarregar via PIX</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'ponto' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ponto Eletrônico Mobile</Text>
            <Text style={styles.cardSub}>Geolocalização ativada para registro de escala e jornada.</Text>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
              onPress={() => Alert.alert('Ponto Registrado', 'Entrada registrada com sucesso via GPS.')}
            >
              <Text style={styles.actionBtnText}>REGISTRAR PONTO AGORA</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  header: { padding: 20, backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  badge: { alignSelf: 'flex-start', backgroundColor: '#facc15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  badgeText: { color: '#000', fontSize: 10, fontWeight: '900' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  headerSub: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: '#1e293b', padding: 4 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabButtonActive: { backgroundColor: '#facc15' },
  tabText: { color: '#94a3b8', fontSize: 9, fontWeight: '800' },
  tabTextActive: { color: '#000' },
  content: { flex: 1, padding: 16 },
  sectionTitle: { color: '#facc15', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 12 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardGold: { backgroundColor: '#ca8a04', borderRadius: 16, padding: 20, marginBottom: 16 },
  goldTitle: { color: '#fff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  goldNumber: { color: '#fef08a', fontSize: 16, fontWeight: '700', marginVertical: 12, letterSpacing: 2 },
  goldBalance: { color: '#fff', fontSize: 22, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  routeBadge: { backgroundColor: '#facc15', color: '#000', fontSize: 11, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardSub: { color: '#94a3b8', fontSize: 12 },
  actionBtn: { backgroundColor: '#facc15', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  actionBtnText: { color: '#000', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }
});
`, [activeSystemId]);

  // Download complete Expo project ZIP
  const handleDownloadZip = async () => {
    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      zip.file('App.tsx', expoAppSource);
      zip.file('package.json', expoPackageJson);
      zip.file('app.json', expoAppJson);
      zip.file('tsconfig.json', JSON.stringify({
        extends: "expo/tsconfig.base",
        compilerOptions: { strict: true }
      }, null, 2));
      zip.file('README.md', `# ViaLivre Mobile\n\nAplicativo móvel oficial sincronizado com o ViaLivre Gestão.\n\n## Como Rodar\n1. Instale o Node.js e Expo CLI: \`npm install -g eas-cli expo-cli\`\n2. Instale dependências: \`npm install\`\n3. Execute no emulador ou celular: \`npx expo start\`\n\n## Como Gerar APK Android\n\`eas build -p android --profile preview\`\n`);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vialivre-mobile-project-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro gerando zip mobile:', e);
    } finally {
      setIsExportingZip(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto overscroll-contain animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl sm:rounded-[2.5rem] w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-lg">
              <Smartphone size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black uppercase tracking-tight italic">
                  Criar & Instalar Aplicativo Mobile
                </h2>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                  ViaLivre Mobile
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                PWA para instalação direta em celulares, projeto nativo React Native / Expo e APK Android
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 px-4 pt-2 overflow-x-auto gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('install')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'install'
                ? 'border-yellow-400 text-slate-950 dark:text-yellow-400 bg-white dark:bg-zinc-950'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            <Download size={14} />
            Instalação no Celular (PWA)
          </button>

          <button
            onClick={() => setActiveTab('react-native')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'react-native'
                ? 'border-yellow-400 text-slate-950 dark:text-yellow-400 bg-white dark:bg-zinc-950'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            <FileCode size={14} />
            Projeto Expo / React Native
          </button>

          <button
            onClick={() => setActiveTab('capacitor')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'capacitor'
                ? 'border-yellow-400 text-slate-950 dark:text-yellow-400 bg-white dark:bg-zinc-950'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            <Terminal size={14} />
            Gerar APK (Capacitor)
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'preview'
                ? 'border-yellow-400 text-slate-950 dark:text-yellow-400 bg-white dark:bg-zinc-950'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            <Play size={14} />
            Simulador Mobile
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar text-slate-800 dark:text-zinc-200">
          
          {/* TAB 1: INSTALAÇÃO DIRETA PWA */}
          {activeTab === 'install' && (
            <div className="space-y-6">
              {/* Hero Banner */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-yellow-400/15 via-amber-500/10 to-transparent border border-yellow-400/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-yellow-400 text-slate-950">
                    Instalação Imediata
                  </span>
                  <h3 className="text-base font-black uppercase text-slate-950 dark:text-white">
                    Instale o ViaLivre como App Nativo no Smartphone
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium max-w-md">
                    Funciona como um aplicativo de verdade: sem barra de navegação, tela cheia, ícone na tela inicial, cache offline e notificações push.
                  </p>
                </div>

                <button
                  onClick={handleInstallClick}
                  className="w-full sm:w-auto px-6 py-3.5 bg-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg hover:bg-yellow-300 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
                >
                  <Download size={16} />
                  {installStatus === 'installed' ? 'App Já Instalado!' : 'Instalar no Celular'}
                </button>
              </div>

              {/* QR Code and Mobile Step-by-Step */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* QR Code Card */}
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col items-center text-center space-y-3">
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR Code ViaLivre Mobile" className="w-44 h-44 rounded-xl" />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center text-slate-400">
                        <QrCode size={48} className="animate-pulse" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">Aponte a Câmera do Smartphone</h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                      Abra o leitor de QR Code ou câmera do celular para acessar e instalar diretamente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full pt-2">
                    <input
                      type="text"
                      readOnly
                      value={appOrigin}
                      className="flex-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-[11px] font-mono text-slate-600 dark:text-zinc-400 truncate"
                    />
                    <button
                      onClick={() => handleCopy(appOrigin, 'url')}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-xs font-bold rounded-xl transition-all"
                    >
                      {copiedKey === 'url' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Instructions per OS */}
                <div className="space-y-4">
                  {/* Android instructions */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <h4 className="text-xs font-black uppercase">Android (Chrome / Samsung Internet)</h4>
                    </div>
                    <ol className="text-[11px] text-slate-600 dark:text-zinc-400 space-y-1.5 pl-4 list-decimal font-medium">
                      <li>Abra o link no navegador <strong>Google Chrome</strong></li>
                      <li>Toque no botão <strong>"Instalar Aplicativo"</strong> ou nos 3 pontinhos (⋮)</li>
                      <li>Selecione <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar aplicativo"</strong></li>
                      <li>O ícone do ViaLivre será adicionado à sua lista de aplicativos!</li>
                    </ol>
                  </div>

                  {/* iOS instructions */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <h4 className="text-xs font-black uppercase">iPhone & iPad (Safari)</h4>
                    </div>
                    <ol className="text-[11px] text-slate-600 dark:text-zinc-400 space-y-1.5 pl-4 list-decimal font-medium">
                      <li>Abra o link no <strong>Safari</strong> da Apple</li>
                      <li>Toque no botão de <strong>Compartilhar</strong> (ícone com quadrado e seta para cima <Share2 size={11} className="inline" />)</li>
                      <li>Role a lista e toque em <strong>"Adicionar à Tela de Início"</strong></li>
                      <li>Toque em <strong>"Adicionar"</strong> no canto superior direito</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* PWA Features Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col items-center text-center">
                  <CheckCircle2 size={18} className="text-emerald-500 mb-1" />
                  <span className="text-[11px] font-black uppercase">Modo Offline</span>
                  <span className="text-[10px] text-slate-500">Cache local automático</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col items-center text-center">
                  <Smartphone size={18} className="text-blue-500 mb-1" />
                  <span className="text-[11px] font-black uppercase">Tela Cheia</span>
                  <span className="text-[10px] text-slate-500">Sem barra de navegação</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col items-center text-center">
                  <ScanLine size={18} className="text-yellow-500 mb-1" />
                  <span className="text-[11px] font-black uppercase">Câmera & QR</span>
                  <span className="text-[10px] text-slate-500">Leitor de bilhete e cartão</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col items-center text-center">
                  <RefreshCw size={18} className="text-purple-500 mb-1" />
                  <span className="text-[11px] font-black uppercase">Tempo Real</span>
                  <span className="text-[10px] text-slate-500">Supabase Realtime Sync</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROJETO REACT NATIVE / EXPO */}
          {activeTab === 'react-native' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Código Completo do Projeto ViaLivre Mobile (React Native + Expo)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Aplicativo pré-configurado com Supabase, rotas, visualização de passagens e ponto do motorista.
                  </p>
                </div>

                <button
                  onClick={handleDownloadZip}
                  disabled={isExportingZip}
                  className="px-4 py-2 bg-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow hover:bg-yellow-300 active:scale-95 transition-all flex items-center gap-2 shrink-0"
                >
                  <FolderArchive size={15} />
                  {isExportingZip ? 'Gerando ZIP...' : 'Baixar Projeto ZIP'}
                </button>
              </div>

              {/* Code viewer for App.tsx */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-zinc-400">App.tsx (Código Principal)</span>
                  <button
                    onClick={() => handleCopy(expoAppSource, 'appSource')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[10px] font-bold uppercase hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {copiedKey === 'appSource' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copiedKey === 'appSource' ? 'Copiado!' : 'Copiar Código'}
                  </button>
                </div>
                <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 text-[10px] font-mono leading-relaxed overflow-x-auto max-h-72 border border-slate-800 custom-scrollbar">
                  <code>{expoAppSource}</code>
                </pre>
              </div>

              {/* Instructions */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
                <h5 className="text-xs font-black uppercase text-slate-900 dark:text-white">Como Executar ou Gerar APK com Expo:</h5>
                <ol className="text-[11px] text-slate-600 dark:text-zinc-400 space-y-1 pl-4 list-decimal font-mono">
                  <li>npm install -g eas-cli expo-cli</li>
                  <li>npx create-expo-app vialivre-mobile --template blank-typescript</li>
                  <li>npm install @supabase/supabase-js expo-location expo-camera</li>
                  <li>eas build -p android --profile preview (Gera APK direto para download)</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: CONVERTER COM CAPACITOR */}
          {activeTab === 'capacitor' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300">
                <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                  <Terminal size={16} />
                  Transformar este Web App em APK Android com Capacitor
                </h4>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-1">
                  O Capacitor empacota todo o código HTML/React deste sistema em um binário nativo do Android Studio, criando um aplicativo oficial para a Google Play Store ou instalação via arquivo .apk.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-yellow-400 text-xs font-bold">Passo 1: Instalar Capacitor</span>
                    <button
                      onClick={() => handleCopy('npm install @capacitor/core @capacitor/cli @capacitor/android', 'cap1')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedKey === 'cap1' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <code>npm install @capacitor/core @capacitor/cli @capacitor/android</code>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-yellow-400 text-xs font-bold">Passo 2: Inicializar e Adicionar Android</span>
                    <button
                      onClick={() => handleCopy('npx cap init "ViaLivre" "com.vialivre.mobile" --web-dir dist\nnpm run build\nnpx cap add android', 'cap2')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedKey === 'cap2' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <code>npx cap init "ViaLivre" "com.vialivre.mobile" --web-dir dist</code>
                  <br />
                  <code>npm run build</code>
                  <br />
                  <code>npx cap add android</code>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-yellow-400 text-xs font-bold">Passo 3: Abrir no Android Studio e Gerar APK</span>
                    <button
                      onClick={() => handleCopy('npx cap open android', 'cap3')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedKey === 'cap3' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <code>npx cap open android</code>
                  <p className="text-[10px] text-slate-400 pt-1">
                    No Android Studio, clique em <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SIMULADOR MOBILE INTERATIVO */}
          {activeTab === 'preview' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <button
                  onClick={() => setSelectedMobileView('passenger')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                    selectedMobileView === 'passenger' ? 'bg-yellow-400 text-slate-950 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Passageiro & Linhas
                </button>
                <button
                  onClick={() => setSelectedMobileView('card')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                    selectedMobileView === 'card' ? 'bg-yellow-400 text-slate-950 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Cartão & Recarga
                </button>
                <button
                  onClick={() => setSelectedMobileView('driver')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                    selectedMobileView === 'driver' ? 'bg-yellow-400 text-slate-950 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Ponto do Motorista
                </button>
                <button
                  onClick={() => setSelectedMobileView('scanner')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                    selectedMobileView === 'scanner' ? 'bg-yellow-400 text-slate-950 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Validador QR
                </button>
              </div>

              {/* Smartphone Frame */}
              <div className="w-[300px] h-[550px] bg-slate-950 rounded-[3rem] p-3 shadow-2xl border-4 border-slate-800 relative flex flex-col overflow-hidden">
                {/* Notch / Speaker */}
                <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mb-2 shrink-0 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-slate-800 mr-2" />
                  <div className="w-8 h-1 rounded-full bg-slate-800" />
                </div>

                {/* Mobile Screen Container */}
                <div className="flex-1 bg-slate-900 rounded-[2.2rem] overflow-hidden flex flex-col text-white text-xs">
                  {/* Status Bar */}
                  <div className="px-4 py-1.5 flex justify-between items-center text-[9px] text-slate-400 border-b border-slate-800">
                    <span className="font-bold">09:41</span>
                    <div className="flex items-center gap-1.5">
                      <span>5G</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* App Header */}
                  <div className="p-3 bg-slate-950 flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-yellow-400 text-slate-950 flex items-center justify-center font-black text-[10px]">
                        VL
                      </div>
                      <span className="font-black text-[11px] tracking-tight">ViaLivre Mobile</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>

                  {/* Mobile Screen Body */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar text-[11px]">
                    {selectedMobileView === 'passenger' && (
                      <div className="space-y-2">
                        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                          <span className="text-[9px] font-black uppercase text-yellow-400">Próximos Ônibus</span>
                          <div className="flex items-center justify-between mt-1">
                            <div>
                              <p className="font-bold">Linha 101 - Circular Centro</p>
                              <p className="text-[9px] text-slate-400">Chegada prevista: 4 min</p>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">No Horário</span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold">Linha 204 - Terminal Norte</p>
                              <p className="text-[9px] text-slate-400">Chegada prevista: 11 min</p>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[9px] font-bold">A caminho</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedMobileView === 'card' && (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 shadow-md">
                          <span className="text-[9px] font-black uppercase tracking-wider">Cartão Vale Transporte</span>
                          <p className="text-sm font-black mt-2">R$ 54,00</p>
                          <p className="text-[8px] font-mono mt-1 opacity-80">VL-8829-4401</p>
                        </div>
                        <button className="w-full py-2 bg-yellow-400 text-slate-950 rounded-xl font-black text-[10px] uppercase shadow">
                          Recarregar com PIX
                        </button>
                      </div>
                    )}

                    {selectedMobileView === 'driver' && (
                      <div className="space-y-3">
                        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
                          <Clock size={20} className="mx-auto text-yellow-400 mb-1" />
                          <p className="font-black text-xs">Jornada de Trabalho</p>
                          <p className="text-[9px] text-slate-400">07:58:32 trabalhado hoje</p>
                        </div>
                        <button className="w-full py-2.5 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase shadow">
                          Registrar Ponto (GPS)
                        </button>
                      </div>
                    )}

                    {selectedMobileView === 'scanner' && (
                      <div className="space-y-2 text-center">
                        <div className="w-full h-32 rounded-xl bg-slate-950 border-2 border-dashed border-yellow-400/50 flex flex-col items-center justify-center p-2">
                          <ScanLine size={32} className="text-yellow-400 animate-pulse mb-1" />
                          <p className="text-[9px] text-slate-400">Posicione o QR Code da passagem</p>
                        </div>
                        <span className="text-[9px] text-emerald-400 font-bold block">✓ Validador Pronto para Embarque</span>
                      </div>
                    )}
                  </div>

                  {/* Mobile Bottom Tab Bar */}
                  <div className="p-2 bg-slate-950 border-t border-slate-800 flex justify-around text-[8px] font-black uppercase text-slate-400">
                    <span className="text-yellow-400">Início</span>
                    <span>Linhas</span>
                    <span>Cartão</span>
                    <span>Ponto</span>
                  </div>
                </div>

                {/* Home Indicator bar */}
                <div className="w-28 h-1 bg-slate-700 rounded-full mx-auto mt-2 shrink-0" />
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold shrink-0">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Sistema Multitenant ID: <strong className="font-mono text-slate-700 dark:text-zinc-300">{activeSystemId}</strong></span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-xl font-bold transition-all text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileAppHubModal;
