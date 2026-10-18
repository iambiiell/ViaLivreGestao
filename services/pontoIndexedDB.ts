/**
 * Serviço de Persistência Local em IndexedDB para o Ponto Eletrônico
 * ViaLivre Gestão de Frotas & Transporte Coletivo
 * 
 * Permite que colaboradores registrem jornada (Entrada, Intervalos e Saída)
 * de forma 100% offline, garantindo armazenamento no dispositivo
 * e sincronização automática transparente assim que houver sinal de internet.
 */

import { TimeEntry } from '../types';
import { supabase, cleanPayload, isNetworkError, generateUUID } from './database';

export interface OfflinePunch {
  id: string;
  system_id: string;
  user_id: string;
  user_name?: string;
  user_role?: string;
  date: string; // 'YYYY-MM-DD'
  time: string; // 'HH:mm'
  action: 'clock_in' | 'break_start' | 'break_end' | 'clock_out';
  action_label: string; // 'Entrada' | 'Saída Intervalo' | 'Retorno Intervalo' | 'Fim de Expediente'
  timestamp: number;
  geolocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
  location_name?: string;
  notes?: string;
  sync_status: 'PENDING' | 'SYNCED' | 'FAILED';
  sync_attempts: number;
  last_sync_error?: string | null;
  synced_at?: number | null;
  created_at: string;
}

export interface PontoSyncResult {
  totalPending: number;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

const DB_NAME = 'vialivre_ponto_indexeddb';
const DB_VERSION = 1;
const STORE_PUNCHES = 'offline_punches';
const STORE_CACHE = 'time_tracking_cache';
const STORE_AUDIT = 'ponto_audit_log';

class PontoIndexedDBService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isSyncing = false;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAutoSync();
    }
  }

  /**
   * Inicializa e abre a conexão com o IndexedDB
   */
  public async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB não é suportado neste ambiente.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Store para Batidas de Ponto Offline (Fila e Histórico Local)
        if (!db.objectStoreNames.contains(STORE_PUNCHES)) {
          const punchStore = db.createObjectStore(STORE_PUNCHES, { keyPath: 'id' });
          punchStore.createIndex('user_id', 'user_id', { unique: false });
          punchStore.createIndex('date', 'date', { unique: false });
          punchStore.createIndex('sync_status', 'sync_status', { unique: false });
          punchStore.createIndex('timestamp', 'timestamp', { unique: false });
          punchStore.createIndex('action', 'action', { unique: false });
        }

        // 2. Store para Cache de Cartão de Ponto (TimeEntry)
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          const cacheStore = db.createObjectStore(STORE_CACHE, { keyPath: 'id' });
          cacheStore.createIndex('user_id', 'user_id', { unique: false });
          cacheStore.createIndex('date', 'date', { unique: false });
          cacheStore.createIndex('system_id', 'system_id', { unique: false });
        }

        // 3. Store para Auditoria Inviolável (Log Local de Batidas)
        if (!db.objectStoreNames.contains(STORE_AUDIT)) {
          const auditStore = db.createObjectStore(STORE_AUDIT, { keyPath: 'id' });
          auditStore.createIndex('user_id', 'user_id', { unique: false });
          auditStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Erro ao abrir banco de ponto:', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Salva um registro de ponto no IndexedDB imediatamente (garantia offline).
   * Atualiza o cache local e tenta sincronização em background se houver internet.
   */
  public async recordPunchOffline(params: {
    userId: string;
    userName?: string;
    userRole?: string;
    systemId?: string;
    date?: string;
    time?: string;
    action: 'clock_in' | 'break_start' | 'break_end' | 'clock_out';
    actionLabel?: string;
    locationName?: string;
    geolocation?: { latitude: number; longitude: number; accuracy?: number } | null;
    notes?: string;
  }): Promise<{ punch: OfflinePunch; isOnline: boolean; syncImmediate: boolean }> {
    const db = await this.getDB();
    const now = new Date();
    const dateStr = params.date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = params.time || now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const actionLabels: Record<string, string> = {
      clock_in: 'Entrada',
      break_start: 'Saída Intervalo',
      break_end: 'Retorno Intervalo',
      clock_out: 'Fim de Expediente'
    };

    const actionLabel = params.actionLabel || actionLabels[params.action] || 'Marcação de Ponto';

    const punch: OfflinePunch = {
      id: `ponto-offline-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      system_id: params.systemId || 'sys-vialivre-default',
      user_id: params.userId,
      user_name: params.userName,
      user_role: params.userRole,
      date: dateStr,
      time: timeStr,
      action: params.action,
      action_label: actionLabel,
      timestamp: Date.now(),
      geolocation: params.geolocation || null,
      location_name: params.locationName || 'Registro Local (Dispositivo)',
      notes: params.notes,
      sync_status: 'PENDING',
      sync_attempts: 0,
      created_at: now.toISOString()
    };

    // 1. Salvar no ObjectStore de Batidas Offline
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PUNCHES, STORE_AUDIT], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      tx.objectStore(STORE_PUNCHES).put(punch);

      // Log de Auditoria Local
      tx.objectStore(STORE_AUDIT).put({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        punch_id: punch.id,
        user_id: punch.user_id,
        action: punch.action,
        date: punch.date,
        time: punch.time,
        timestamp: punch.timestamp,
        recorded_at: now.toISOString()
      });
    });

    // 2. Atualizar o cache local de TimeEntry no IndexedDB e LocalStorage
    await this.updateLocalCacheWithPunch(punch);

    this.notifyListeners();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vialivre-ponto-offline-saved', { detail: { punch } }));
      window.dispatchEvent(new CustomEvent('vialivre-timetracking-updated'));
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
    }

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
    let syncImmediate = false;

    // Se estiver online, tenta subir para a nuvem em background imediatamente
    if (isOnline) {
      this.syncPendingPunches().then(res => {
        if (res.syncedCount > 0) {
          syncImmediate = true;
        }
      }).catch(err => {
        console.warn('[IndexedDB Ponto] Sincronização em background adiada:', err);
      });
    }

    return { punch, isOnline, syncImmediate };
  }

  /**
   * Atualiza o cache local (TimeEntry) com base na batida registrada
   */
  private async updateLocalCacheWithPunch(punch: OfflinePunch): Promise<void> {
    const db = await this.getDB();

    // 1. Buscar se já existe uma TimeEntry no cache para este usuário e data
    const existingCache = await new Promise<TimeEntry | undefined>((resolve) => {
      const tx = db.transaction(STORE_CACHE, 'readonly');
      const store = tx.objectStore(STORE_CACHE);
      const index = store.index('user_id');
      const req = index.getAll(punch.user_id);

      req.onsuccess = () => {
        const matches = (req.result || []) as TimeEntry[];
        const found = matches.find(e => e.date === punch.date);
        resolve(found);
      };
      req.onerror = () => resolve(undefined);
    });

    let targetEntry: TimeEntry;

    if (existingCache) {
      targetEntry = { ...existingCache };
    } else {
      targetEntry = {
        id: generateUUID(),
        system_id: punch.system_id,
        user_id: punch.user_id,
        date: punch.date,
        clock_in: '',
        break_start: '',
        break_end: '',
        clock_out: '',
        notes: `[Criado Offline IDB às ${punch.time}]`
      };
    }

    // Aplicar a ação correspondente
    if (punch.action === 'clock_in') {
      targetEntry.clock_in = punch.time;
    } else if (punch.action === 'break_start') {
      targetEntry.break_start = punch.time;
    } else if (punch.action === 'break_end') {
      targetEntry.break_end = punch.time;
    } else if (punch.action === 'clock_out') {
      targetEntry.clock_out = punch.time;
      // Auto-fechar intervalo se pendente
      if (targetEntry.break_start && !targetEntry.break_end) {
        targetEntry.break_end = punch.time;
      }
    }

    // Calcular total de horas se tiver entrada e saída
    if (targetEntry.clock_in && targetEntry.clock_out) {
      const parseTime = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return (h || 0) + (m || 0) / 60;
      };
      let hours = parseTime(targetEntry.clock_out) - parseTime(targetEntry.clock_in);
      if (targetEntry.break_start && targetEntry.break_end) {
        hours -= (parseTime(targetEntry.break_end) - parseTime(targetEntry.break_start));
      }
      if (hours < 0) hours += 24;
      targetEntry.total_daily_hours = Math.max(0, Number(hours.toFixed(2)));
    }

    // Salvar no IndexedDB Cache
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CACHE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_CACHE).put(targetEntry);
    });

    // Também espelhar no localStorage para compatibilidade com outros módulos legados
    try {
      const raw = localStorage.getItem('vialivre_db_time_tracking');
      const list = raw ? JSON.parse(raw) : [];
      const updatedList = Array.isArray(list) 
        ? [targetEntry, ...list.filter((e: any) => e.id !== targetEntry.id && !(e.user_id === targetEntry.user_id && e.date === targetEntry.date))]
        : [targetEntry];
      localStorage.setItem('vialivre_db_time_tracking', JSON.stringify(updatedList));
    } catch {}
  }

  /**
   * Retorna a quantidade de batidas pendentes de sincronização
   */
  public async getPendingPunchesCount(userId?: string): Promise<number> {
    try {
      const db = await this.getDB();
      return new Promise<number>((resolve) => {
        const tx = db.transaction(STORE_PUNCHES, 'readonly');
        const store = tx.objectStore(STORE_PUNCHES);
        const index = store.index('sync_status');
        const req = index.getAll('PENDING');

        req.onsuccess = () => {
          const list = (req.result || []) as OfflinePunch[];
          if (userId) {
            resolve(list.filter(p => p.user_id === userId).length);
          } else {
            resolve(list.length);
          }
        };
        req.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }

  /**
   * Retorna a lista de batidas pendentes
   */
  public async getPendingPunches(userId?: string): Promise<OfflinePunch[]> {
    try {
      const db = await this.getDB();
      return new Promise<OfflinePunch[]>((resolve) => {
        const tx = db.transaction(STORE_PUNCHES, 'readonly');
        const store = tx.objectStore(STORE_PUNCHES);
        const index = store.index('sync_status');
        const req = index.getAll('PENDING');

        req.onsuccess = () => {
          let list = (req.result || []) as OfflinePunch[];
          if (userId) {
            list = list.filter(p => p.user_id === userId);
          }
          list.sort((a, b) => a.timestamp - b.timestamp);
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * Retorna todas as batidas locais (histórico offline)
   */
  public async getAllPunches(userId?: string): Promise<OfflinePunch[]> {
    try {
      const db = await this.getDB();
      return new Promise<OfflinePunch[]>((resolve) => {
        const tx = db.transaction(STORE_PUNCHES, 'readonly');
        const store = tx.objectStore(STORE_PUNCHES);
        const req = store.getAll();

        req.onsuccess = () => {
          let list = (req.result || []) as OfflinePunch[];
          if (userId) {
            list = list.filter(p => p.user_id === userId);
          }
          list.sort((a, b) => b.timestamp - a.timestamp);
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * Retorna os registros TimeEntry mantidos no cache do IndexedDB
   */
  public async getCachedTimeEntries(userId?: string): Promise<TimeEntry[]> {
    try {
      const db = await this.getDB();
      return new Promise<TimeEntry[]>((resolve) => {
        const tx = db.transaction(STORE_CACHE, 'readonly');
        const store = tx.objectStore(STORE_CACHE);
        const req = store.getAll();

        req.onsuccess = () => {
          let list = (req.result || []) as TimeEntry[];
          if (userId) {
            list = list.filter(e => e.user_id === userId);
          }
          list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * Salva no cache do IndexedDB a lista de TimeEntries trazidas da nuvem
   */
  public async cacheTimeEntries(entries: TimeEntry[]): Promise<void> {
    try {
      if (!Array.isArray(entries) || entries.length === 0) return;
      const db = await this.getDB();
      const tx = db.transaction(STORE_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_CACHE);
      entries.forEach(entry => {
        if (entry && entry.id) {
          store.put(entry);
        }
      });
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('[IndexedDB] Erro ao atualizar cache de time entries:', e);
    }
  }

  /**
   * Sincroniza todas as batidas pendentes com o Supabase Cloud
   */
  public async syncPendingPunches(): Promise<PontoSyncResult> {
    if (this.isSyncing) {
      return { totalPending: 0, syncedCount: 0, failedCount: 0, errors: ['Sincronização já em andamento'] };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const pendingCount = await this.getPendingPunchesCount();
      return { totalPending: pendingCount, syncedCount: 0, failedCount: 0, errors: ['Dispositivo offline'] };
    }

    this.isSyncing = true;
    const pendingPunches = await this.getPendingPunches();

    if (pendingPunches.length === 0) {
      this.isSyncing = false;
      return { totalPending: 0, syncedCount: 0, failedCount: 0, errors: [] };
    }

    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    const db = await this.getDB();

    for (const punch of pendingPunches) {
      try {
        punch.sync_attempts = (punch.sync_attempts || 0) + 1;

        // 1. Verificar se já existe um registro para o usuário nessa data na nuvem
        const { data: existingRows, error: searchError } = await supabase
          .from('time_tracking')
          .select('*')
          .eq('user_id', punch.user_id)
          .eq('date', punch.date);

        if (searchError) {
          if (isNetworkError(searchError)) {
            throw searchError;
          }
        }

        const remoteEntry = existingRows && existingRows.length > 0 ? existingRows[0] : null;

        if (remoteEntry) {
          // Atualizar o registro existente com a nova batida
          const updatePayload: any = {
            id: remoteEntry.id,
            user_id: punch.user_id,
            date: punch.date,
            system_id: punch.system_id || remoteEntry.system_id
          };

          if (punch.action === 'clock_in') {
            updatePayload.clock_in = punch.time;
          } else if (punch.action === 'break_start') {
            updatePayload.break_start = punch.time;
          } else if (punch.action === 'break_end') {
            updatePayload.break_end = punch.time;
          } else if (punch.action === 'clock_out') {
            updatePayload.clock_out = punch.time;
            if (remoteEntry.break_start && !remoteEntry.break_end) {
              updatePayload.break_end = punch.time;
            }
          }

          const syncNote = `[Sincronizado do IndexedDB: ${punch.action_label} às ${punch.time}]`;
          updatePayload.notes = remoteEntry.notes 
            ? `${remoteEntry.notes} | ${syncNote}`
            : syncNote;

          const cleaned = cleanPayload('time_tracking', updatePayload, true);
          const { error: updateError } = await supabase
            .from('time_tracking')
            .update(cleaned)
            .eq('id', remoteEntry.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          // Inserir novo registro inicial
          const insertPayload: any = {
            id: generateUUID(),
            system_id: punch.system_id || 'sys-vialivre-default',
            user_id: punch.user_id,
            date: punch.date,
            clock_in: punch.action === 'clock_in' ? punch.time : '',
            break_start: punch.action === 'break_start' ? punch.time : '',
            break_end: punch.action === 'break_end' ? punch.time : '',
            clock_out: punch.action === 'clock_out' ? punch.time : '',
            notes: `[Batida Offline IndexedDB: ${punch.action_label} às ${punch.time}] ${punch.notes || ''}`
          };

          const cleaned = cleanPayload('time_tracking', insertPayload, true);
          const { error: insertError } = await supabase
            .from('time_tracking')
            .insert(cleaned);

          if (insertError) {
            throw insertError;
          }
        }

        // Marcar batida no IndexedDB como sincronizada
        punch.sync_status = 'SYNCED';
        punch.synced_at = Date.now();
        punch.last_sync_error = null;

        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_PUNCHES, 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.objectStore(STORE_PUNCHES).put(punch);
        });

        syncedCount++;
      } catch (err: any) {
        failedCount++;
        const errMsg = err?.message || String(err);
        errors.push(errMsg);

        punch.sync_status = 'PENDING';
        punch.last_sync_error = errMsg;

        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_PUNCHES, 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.objectStore(STORE_PUNCHES).put(punch);
        });

        if (isNetworkError(err)) {
          // Se for erro de rede, interrompe o loop para economizar tentativas e aguardar sinal
          break;
        }
      }
    }

    this.isSyncing = false;
    this.notifyListeners();

    if (syncedCount > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vialivre-ponto-synced', {
        detail: { syncedCount, failedCount }
      }));
      window.dispatchEvent(new CustomEvent('vialivre-timetracking-updated'));
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
    }

    return {
      totalPending: pendingPunches.length,
      syncedCount,
      failedCount,
      errors
    };
  }

  /**
   * Assina atualizações do serviço IndexedDB
   */
  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.warn('[IndexedDB Ponto] Erro em listener:', e);
      }
    });
  }

  /**
   * Inicializa ouvintes para sincronização automática quando a rede voltar
   */
  private initAutoSync() {
    window.addEventListener('online', () => {
      console.log('[IndexedDB Ponto] Conexão restabelecida. Sincronizando batidas pendentes...');
      setTimeout(() => {
        this.syncPendingPunches();
      }, 1000);
    });

    window.addEventListener('focus', () => {
      if (navigator.onLine) {
        this.syncPendingPunches();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.syncPendingPunches();
      }
    });

    // Sincronizador de fundo a cada 25 segundos se houver registros pendentes
    setInterval(async () => {
      if (navigator.onLine && !this.isSyncing) {
        const count = await this.getPendingPunchesCount();
        if (count > 0) {
          this.syncPendingPunches();
        }
      }
    }, 25000);
  }
}

export const pontoIndexedDB = new PontoIndexedDBService();
