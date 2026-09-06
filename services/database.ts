import { 
  BusRoute, 
  Company, 
  Trip, 
  User, 
  Vehicle, 
  IssueReport, 
  City, 
  Notice, 
  TicketSale, 
  Inspection, 
  TicketingConfig, 
  PayrollRubric, 
  RoleConfig, 
  AppNotification, 
  Shift, 
  SystemSettings, 
  TimeEntry 
} from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { safeLocalStorage } from '../utils/storage';
import { RealtimeChannel } from '@supabase/supabase-js';

export { supabase, isSupabaseConfigured };

export type TableName = 
  | 'routes' 
  | 'trips' 
  | 'users' 
  | 'companies' 
  | 'vehicles' 
  | 'occurrences' 
  | 'cities' 
  | 'notices' 
  | 'push_subscriptions' 
  | 'ticket_sales' 
  | 'maintenance' 
  | 'maintenance_logs'
  | 'inspections' 
  | 'ticketing_config' 
  | 'payroll_rubrics' 
  | 'payroll'
  | 'payroll_details'
  | 'salary_items'
  | 'role_configs' 
  | 'notifications' 
  | 'shifts' 
  | 'daily_schedules'
  | 'time_tracking' 
  | 'driver_logs' 
  | 'conductor_logs'
  | 'dispatcher_logs'
  | 'routes_logs' 
  | 'system_settings' 
  | 'system_versions'
  | 'imp_cards' 
  | 'imp_card_recharges' 
  | 'user_occurrences' 
  | 'traffic_violations' 
  | 'user_fines' 
  | 'job_applications' 
  | 'job_vacancies' 
  | 'skins' 
  | 'trips_audit' 
  | 'activation_keys' 
  | 'subscriptions' 
  | 'ticket_booths' 
  | 'bus_stations'
  | 'bus_terminals'
  | 'itineraries'
  | 'itinerary_sections'
  | 'route_sections'
  | 'passengers'
  | 'cashier_logs';

export interface PendingAction {
  id: string;
  table: TableName;
  action: 'create' | 'update' | 'delete';
  payload?: any;
  recordId: string;
  timestamp: number;
}

export interface DbStatus {
  isOffline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
}

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const isValidUUID = (str: any): boolean => {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export const cleanPayload = (table: TableName, obj: any, isUpdate = false) => {
  if (!obj || typeof obj !== 'object') return {};
  
  const cleaned: Record<string, any> = {};
  for (const [key, v] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    if (key === 'id' && !isUpdate && typeof v === 'undefined') continue;
    if (v === undefined) continue;

    if (v === '' || v === 'none' || v === 'null') {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.endsWith('_id') ||
        lowerKey === 'id' ||
        lowerKey.includes('date') ||
        lowerKey.includes('at') ||
        lowerKey.includes('time') ||
        lowerKey.includes('birth') ||
        lowerKey.includes('expiry') ||
        lowerKey.includes('valid') ||
        lowerKey.includes('price') ||
        lowerKey.includes('amount') ||
        lowerKey.includes('cost') ||
        lowerKey.includes('balance') ||
        lowerKey.includes('capacity') ||
        lowerKey.includes('seats') ||
        lowerKey.includes('km') ||
        lowerKey.includes('salary') ||
        lowerKey.includes('points') ||
        lowerKey.includes('code')
      ) {
        cleaned[key] = null;
        continue;
      }
      cleaned[key] = null;
      continue;
    }

    if (table === 'trips' && key === 'passengers' && typeof v === 'object' && v !== null) {
      cleaned[key] = JSON.stringify(v);
      continue;
    }

    cleaned[key] = v;
  }
  
  if (table === 'bus_stations') {
    delete cleaned.address;
    delete cleaned.created_by;
    delete cleaned.is_active;
    delete cleaned.system_id;
  }
  
  if (table === 'time_tracking' as any) {
    delete cleaned.total_daily_hours;
  }
  
  if (table === 'users') {
    delete cleaned.pis;
    delete cleaned.occurrences;
  }

  if (currentSystemId && !cleaned.system_id && !['subscriptions', 'activation_keys'].includes(table)) {
    cleaned.system_id = currentSystemId;
  }
  
  return cleaned;
};

export const isNetworkError = (error: any): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  if (!error) return false;
  
  if (error.code && typeof error.code === 'string' && (error.code.length === 5 || error.code.startsWith('PGRST'))) {
    return false;
  }
  
  const msg = (typeof error === 'string' ? error : (error.message || error.details || error.hint || '')).toLowerCase();
  const name = (error.name || '').toLowerCase();
  
  return (
    name === 'aborterror' ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('net::err') ||
    msg.includes('connection refused') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('offline') ||
    msg.includes('load failed')
  );
};

let currentSystemId: string | null = null;

// Helper para gerenciar exclusões locais
const getDeletedIds = (table: TableName): Set<string> => {
  try {
    const raw = safeLocalStorage.getItem(`vialivre_deleted_${table}`);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    return new Set<string>();
  }
};

const addDeletedId = (table: TableName, id: string): void => {
  try {
    const set = getDeletedIds(table);
    set.add(id);
    safeLocalStorage.setItem(`vialivre_deleted_${table}`, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn(`[DB_DELETED_SAVE_ERROR] Erro ao gravar exclusão de ${table}:`, e);
  }
};

const removeDeletedId = (table: TableName, id: string): void => {
  try {
    const set = getDeletedIds(table);
    if (set.has(id)) {
      set.delete(id);
      safeLocalStorage.setItem(`vialivre_deleted_${table}`, JSON.stringify(Array.from(set)));
    }
  } catch (e) {}
};

// Cache local como suporte secundário
const getLocalData = <T>(table: TableName): T[] => {
  const deleted = getDeletedIds(table);
  try {
    const raw = safeLocalStorage.getItem(`vialivre_db_${table}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((x: any) => x && x.id && !deleted.has(x.id)) as T[];
      }
    }
    if (table === 'bus_stations' || table === 'bus_terminals') {
      const bsRaw = safeLocalStorage.getItem('vialivre_bus_stations');
      if (bsRaw !== null) {
        const bsParsed = JSON.parse(bsRaw);
        if (Array.isArray(bsParsed)) return bsParsed.filter((x: any) => x && x.id && !deleted.has(x.id)) as T[];
      }
    }
  } catch (e) {
    console.warn(`[DB_LOCAL_READ_ERROR] Erro ao ler cache local de ${table}:`, e);
  }

  return [];
};

const setLocalData = <T>(table: TableName, data: T[]): void => {
  try {
    safeLocalStorage.setItem(`vialivre_db_${table}`, JSON.stringify(data));
    if (table === 'bus_stations' || table === 'bus_terminals') {
      safeLocalStorage.setItem('vialivre_bus_stations', JSON.stringify(data));
    }
  } catch (e) {
    console.warn(`[DB_LOCAL_SAVE_ERROR] Erro ao salvar cache local de ${table}:`, e);
  }
};

// Gerenciamento de Fila de Sincronização
const SYNC_QUEUE_KEY = 'vialivre_sync_queue';

const getSyncQueue = (): PendingAction[] => {
  try {
    const raw = safeLocalStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Erro ao ler fila de sincronização:', e);
    return [];
  }
};

const saveSyncQueue = (queue: PendingAction[]): void => {
  try {
    safeLocalStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    notifyStatusChange();
  } catch (e) {
    console.error('Erro ao salvar fila de sincronização:', e);
  }
};

const addToSyncQueue = (item: Omit<PendingAction, 'id' | 'timestamp'>): PendingAction => {
  const queue = getSyncQueue();
  const newAction: PendingAction = {
    ...item,
    id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now()
  };
  
  const existingIdx = queue.findIndex(q => q.table === item.table && q.recordId === item.recordId);
  if (existingIdx !== -1) {
    if (item.action === 'delete') {
      if (queue[existingIdx].action === 'create') {
        queue.splice(existingIdx, 1);
        saveSyncQueue(queue);
        return newAction;
      }
      queue[existingIdx] = newAction;
    } else if (item.action === 'update') {
      if (queue[existingIdx].action === 'create') {
        queue[existingIdx].payload = { ...queue[existingIdx].payload, ...item.payload };
      } else {
        queue[existingIdx] = newAction;
      }
    }
  } else {
    queue.push(newAction);
  }

  saveSyncQueue(queue);
  return newAction;
};

let dbStatus: DbStatus = {
  isOffline: !isSupabaseConfigured,
  pendingSyncCount: getSyncQueue().length,
  isSyncing: false,
  lastSyncAt: null,
  lastError: !isSupabaseConfigured ? 'Banco de dados em nuvem não configurado' : null
};

const statusListeners = new Set<(status: DbStatus) => void>();

const dispatchSystemToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vialivre-show-toast', { detail: { message, type } }));
  }
};

const notifyStatusChange = () => {
  dbStatus.pendingSyncCount = getSyncQueue().length;
  statusListeners.forEach(cb => {
    try {
      cb({ ...dbStatus });
    } catch (e) {
      console.warn('Erro em listener de status do banco:', e);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vialivre-db-status', { detail: { ...dbStatus } }));
  }
};

const updateStatus = (updates: Partial<DbStatus>) => {
  let changed = false;
  Object.entries(updates).forEach(([k, v]) => {
    if ((dbStatus as any)[k] !== v) {
      (dbStatus as any)[k] = v;
      changed = true;
    }
  });

  if (changed) {
    notifyStatusChange();
  }
};

// Monitoramento de Conexão Online/Offline e Sincronização Periódica
if (typeof window !== 'undefined') {
  const triggerAutoSync = async () => {
    db.checkConnection().then(async (isOnline) => {
      if (isOnline) {
        const result = await db.syncPendingActions();
        window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
        if (result.syncedCount > 0) {
          dispatchSystemToast(`Sincronizado: ${result.syncedCount} itens salvos na nuvem`, 'success');
        }
      }
    });
  };

  window.addEventListener('online', () => {
    dispatchSystemToast('Rede reconectada. Sincronizando...', 'info');
    triggerAutoSync();
  });

  window.addEventListener('offline', () => {
    updateStatus({ isOffline: true, lastError: 'Sem conexão com a internet' });
    dispatchSystemToast('Sem conexão com a internet', 'warning');
  });

  // Sincronizar ao focar na janela (ex: quando o usuário volta pro computador ou alterna abas)
  window.addEventListener('focus', () => {
    triggerAutoSync();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerAutoSync();
    }
  });

  // Intervalo suave em segundo plano para manter dados sincronizados entre múltiplos dispositivos
  setInterval(() => {
    if (!dbStatus.isSyncing) {
      db.syncPendingActions();
    }
  }, 25000);
}

export const db = {
  setSystemId: (id: string | null) => {
    currentSystemId = id;
  },

  getSystemId: () => currentSystemId,

  getIsolatedTables: (): TableName[] => [
    'routes', 'trips', 'users', 'companies', 'vehicles', 'occurrences', 
    'notices', 'ticket_sales', 'maintenance', 'driver_logs', 'conductor_logs',
    'dispatcher_logs', 'ticketing_config', 'payroll_rubrics', 'payroll',
    'role_configs', 'notifications', 'shifts', 'daily_schedules', 'time_tracking', 
    'system_settings', 'imp_cards', 'imp_card_recharges', 'user_occurrences', 
    'traffic_violations', 'user_fines', 'job_applications', 'job_vacancies', 
    'skins', 'trips_audit', 'subscriptions', 'ticket_booths', 'bus_stations',
    'bus_terminals', 'itineraries'
  ],

  getStatus: (): DbStatus => ({
    ...dbStatus,
    pendingSyncCount: getSyncQueue().length
  }),

  subscribeStatus: (callback: (status: DbStatus) => void): (() => void) => {
    statusListeners.add(callback);
    callback({ ...dbStatus, pendingSyncCount: getSyncQueue().length });
    return () => {
      statusListeners.delete(callback);
    };
  },

  checkConnection: async (): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const { error } = await supabase.from('companies').select('id').limit(1).abortSignal(controller.signal);
      clearTimeout(timeoutId);

      if (error && isNetworkError(error)) {
        updateStatus({ isOffline: true, lastError: error.message });
        return false;
      }
      updateStatus({ isOffline: false, lastError: null });
      return true;
    } catch (e: any) {
      if (isNetworkError(e)) {
        updateStatus({ isOffline: true, lastError: 'Sem conexão com a internet' });
        return false;
      }
      updateStatus({ isOffline: false, lastError: null });
      return true;
    }
  },

  syncPendingActions: async (): Promise<{ success: boolean; syncedCount: number }> => {
    const queue = getSyncQueue();
    if (queue.length === 0) return { success: true, syncedCount: 0 };
    if (dbStatus.isSyncing) return { success: false, syncedCount: 0 };

    updateStatus({ isSyncing: true });
    let syncedCount = 0;
    const remainingQueue: PendingAction[] = [...queue];

    for (const item of queue) {
      try {
        if (item.action === 'create' || item.action === 'update') {
          const payload = cleanPayload(item.table, item.payload, true);
          const { error } = await supabase.from(item.table).upsert(payload);
          if (error && isNetworkError(error)) throw error;
        } else if (item.action === 'delete') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.recordId);
          if (error && isNetworkError(error)) throw error;
        }

        const idx = remainingQueue.findIndex(q => q.id === item.id);
        if (idx !== -1) remainingQueue.splice(idx, 1);
        syncedCount++;
      } catch (err: any) {
        if (isNetworkError(err)) {
          updateStatus({ isOffline: true, lastError: err?.message || 'Erro de rede' });
          saveSyncQueue(remainingQueue);
          updateStatus({ isSyncing: false });
          return { success: false, syncedCount };
        } else {
          const idx = remainingQueue.findIndex(q => q.id === item.id);
          if (idx !== -1) remainingQueue.splice(idx, 1);
        }
      }
    }

    saveSyncQueue(remainingQueue);
    updateStatus({ isSyncing: false, isOffline: false, lastSyncAt: Date.now(), lastError: null });
    return { success: true, syncedCount };
  },

  // BUSCA UNIVERSAL NA NUVEM (Single Source of Truth)
  fetchAll: async <T>(table: TableName): Promise<T[]> => {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*');

      if (error) {
        if (isNetworkError(error)) {
          updateStatus({ isOffline: true, lastError: error.message });
        }
        return getLocalData<T>(table);
      }

      updateStatus({ isOffline: false, lastError: null });
      if (data && Array.isArray(data)) {
        setLocalData(table, data);
        return data as T[];
      }

      return [];
    } catch (e: any) {
      return getLocalData<T>(table);
    }
  },

  fetchAllGlobal: async <T>(table: TableName): Promise<T[]> => {
    return db.fetchAll<T>(table);
  },

  // CRIAÇÃO DIRETA NA NUVEM
  create: async <T extends { id?: string; system_id?: string }>(table: TableName, item: Partial<T>): Promise<T | null> => {
    const payload = cleanPayload(table, item, true);
    
    // Geração de ID seguro
    if (table === 'role_configs') {
      delete payload.id;
    } else if (!payload.id || !isValidUUID(payload.id)) {
      if (table !== 'system_settings') {
        payload.id = generateUUID();
      }
    }
    
    if (payload.id) {
      removeDeletedId(table, String(payload.id));
    }

    try {
      const { data, error } = await supabase.from(table).upsert(payload).select();
      if (error) {
        if (!isNetworkError(error)) {
          console.error(`Supabase create error on ${table}:`, error);
        }
        if (isNetworkError(error)) {
          addToSyncQueue({ table, action: 'create', payload, recordId: String(payload.id) });
          const localList = getLocalData<any>(table);
          setLocalData(table, [payload, ...localList.filter((x: any) => x.id !== payload.id)]);
          return payload as T;
        }
        throw error;
      }

      const finalItem = (Array.isArray(data) && data.length > 0 ? data[0] : (data || payload)) as T;
      const localList = getLocalData<any>(table);
      setLocalData(table, [finalItem, ...localList.filter((x: any) => x.id !== (finalItem as any).id)]);
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'create', item: finalItem } }));
      }
      
      return finalItem as T;
    } catch (e: any) {
      if (!isNetworkError(e)) {
        console.error(`Exception during create on ${table}:`, e);
      }
      addToSyncQueue({ table, action: 'create', payload, recordId: String(payload.id) });
      const localList = getLocalData<any>(table);
      setLocalData(table, [payload, ...localList.filter((x: any) => x.id !== payload.id)]);
      return payload as T;
    }
  },

  // ATUALIZAÇÃO DIRETA NA NUVEM
  update: async <T extends { id: string; system_id?: string }>(table: TableName, item: T): Promise<T | null> => {
    const payload = cleanPayload(table, item, true);
    
    if (item.id) {
      removeDeletedId(table, item.id);
    }

    try {
      const { data, error } = await supabase.from(table).update(payload).eq('id', item.id).select();
      if (error) {
        if (!isNetworkError(error)) {
          console.error(`Supabase update error on ${table}:`, error);
        }
        if (isNetworkError(error)) {
          addToSyncQueue({ table, action: 'update', payload, recordId: item.id });
          const localList = getLocalData<any>(table);
          const idx = localList.findIndex((x: any) => x.id === item.id);
          if (idx !== -1) localList[idx] = { ...localList[idx], ...payload };
          else localList.push(payload);
          setLocalData(table, localList);
          return item;
        }
        throw error;
      }

      const finalItem = (Array.isArray(data) && data.length > 0 ? data[0] : (data || item)) as T;
      const localList = getLocalData<any>(table);
      const idx = localList.findIndex((x: any) => x.id === item.id);
      if (idx !== -1) localList[idx] = finalItem;
      else localList.push(finalItem);
      setLocalData(table, localList);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'update', item: finalItem } }));
      }

      return finalItem as T;
    } catch (e: any) {
      if (!isNetworkError(e)) {
        console.error(`Exception during update on ${table}:`, e);
      }
      addToSyncQueue({ table, action: 'update', payload, recordId: item.id });
      const localList = getLocalData<any>(table);
      const idx = localList.findIndex((x: any) => x.id === item.id);
      if (idx !== -1) localList[idx] = { ...localList[idx], ...payload };
      else localList.push(payload);
      setLocalData(table, localList);
      return item;
    }
  },

  // EXCLUSÃO DIRETA NA NUVEM
  delete: async (table: TableName, id: string): Promise<boolean> => {
    if (!id || typeof id !== 'string' || (id as any).nativeEvent || (id as any).target) {
      console.error(`db.delete called with invalid id for table ${table}:`, id);
      return false;
    }

    addDeletedId(table, id);

    const localList = getLocalData<any>(table);
    setLocalData(table, localList.filter((x: any) => x && x.id !== id));

    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) {
        if (!isNetworkError(error)) {
          console.error(`Supabase delete error on ${table}:`, error);
        }
        if (isNetworkError(error)) {
          addToSyncQueue({ table, action: 'delete', recordId: id });
        }
      } else {
        removeDeletedId(table, id);
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vialivre-data-changed', { detail: { table, action: 'delete', id } }));
      }
      
      return true;
    } catch (e: any) {
      if (!isNetworkError(e)) {
        console.error(`Exception during delete on ${table}:`, e);
      }
      addToSyncQueue({ table, action: 'delete', recordId: id });
      return true;
    }
  },

  clearTable: async (table: TableName): Promise<boolean> => {
    try {
      const localList = getLocalData<any>(table);
      localList.forEach((item: any) => {
        if (item && item.id) addDeletedId(table, item.id);
      });
      setLocalData(table, []);
      await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      return true;
    } catch (error) {
      setLocalData(table, []);
      return true;
    }
  },

  initializeRealtime: (onEvent: (table: string, payload: any) => void): any => {
    return { unsubscribe: () => {} };
  },

  subscribeTable: (table: TableName, onEvent: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: any; old: any }) => void): { unsubscribe: () => void } => {
    try {
      const channelId = `rt-${table}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase
        .channel(channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (p: any) => {
          onEvent({
            eventType: p.eventType as any,
            new: p.new,
            old: p.old
          });
        })
        .subscribe();
      return {
        unsubscribe: () => {
          try {
            supabase.removeChannel(channel);
          } catch (e) {
            channel.unsubscribe();
          }
        }
      };
    } catch (e) {
      console.warn(`Erro ao assinar Realtime para ${table}:`, e);
      return { unsubscribe: () => {} };
    }
  },

  subscribeTables: (tables: TableName[], onEvent: (table: TableName, payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: any; old: any }) => void): { unsubscribe: () => void } => {
    const subs = tables.map(tbl => db.subscribeTable(tbl, (p) => onEvent(tbl, p)));
    return {
      unsubscribe: () => {
        subs.forEach(s => s.unsubscribe());
      }
    };
  },

  // MÉTODOS DE CONSULTA (Compatibilidade Direta e Aliases getAll...)
  getUsers: () => db.fetchAll<User>('users'),
  getAllUsers: () => db.fetchAll<User>('users'),

  getCities: () => db.fetchAll<City>('cities'),
  getAllCities: () => db.fetchAll<City>('cities'),

  getRoutes: () => db.fetchAll<BusRoute>('routes'),
  getAllRoutes: () => db.fetchAll<BusRoute>('routes'),

  getTrips: () => db.fetchAll<Trip>('trips'),
  getAllTrips: () => db.fetchAll<Trip>('trips'),

  getCompanies: () => db.fetchAll<Company>('companies'),
  getAllCompanies: () => db.fetchAll<Company>('companies'),

  getVehicles: () => db.fetchAll<Vehicle>('vehicles'),
  getAllVehicles: () => db.fetchAll<Vehicle>('vehicles'),

  getReports: () => db.fetchAll<IssueReport>('occurrences'),
  getAllReports: () => db.fetchAll<IssueReport>('occurrences'),

  getNotices: () => db.fetchAll<Notice>('notices'),
  getAllNotices: () => db.fetchAll<Notice>('notices'),

  getSales: () => db.fetchAll<TicketSale>('ticket_sales'),
  getAllSales: () => db.fetchAll<TicketSale>('ticket_sales'),

  getInspections: () => db.fetchAll<Inspection>('inspections'),
  getAllInspections: () => db.fetchAll<Inspection>('inspections'),

  getDailySchedules: () => db.fetchAll<any>('daily_schedules'),
  getAllDailySchedules: () => db.fetchAll<any>('daily_schedules'),

  getTicketingConfig: () => db.fetchAll<TicketingConfig>('ticketing_config'),
  getRubrics: () => db.fetchAll<PayrollRubric>('payroll_rubrics'),
  getRoleConfigs: () => db.fetchAll<RoleConfig>('role_configs'),
  getNotifications: () => db.fetchAll<AppNotification>('notifications'),
  getShifts: () => db.fetchAll<Shift>('shifts'),
  getOccurrences: () => db.fetchAll<any>('user_occurrences'),
  getDriverLogs: () => db.fetchAll<any>('driver_logs'),
  getSystemSettings: () => db.fetchAll<SystemSettings>('system_settings'),
  getImpCards: () => db.fetchAll<any>('imp_cards'),
  getImpCardRecharges: () => db.fetchAll<any>('imp_card_recharges'),
  getTrafficViolations: () => db.fetchAll<any>('traffic_violations'),
  getUserFines: () => db.fetchAll<any>('user_fines'),
  getJobApplications: () => db.fetchAll<any>('job_applications'),
  getJobVacancies: () => db.fetchAll<any>('job_vacancies'),
  getSkins: () => db.fetchAll<any>('skins'),
  getTripsAudit: () => db.fetchAll<any>('trips_audit'),
  getTicketBooths: () => db.fetchAll<any>('ticket_booths'),
  getBusStations: () => db.fetchAll<any>('bus_stations'),
  getBusTerminals: () => db.fetchAll<any>('bus_terminals'),
  getItineraries: () => db.fetchAll<any>('itineraries'),

  getSubscriptions: () => db.fetchAll<any>('subscriptions'),
  getAllSubscriptions: () => db.fetchAll<any>('subscriptions'),

  getActivationKeys: () => db.fetchAll<any>('activation_keys'),
  getAllActivationKeys: () => db.fetchAll<any>('activation_keys'),

  getTimeTracking: () => db.fetchAll<TimeEntry>('time_tracking'),
  getTimeEntries: async (userId?: string): Promise<TimeEntry[]> => {
    try {
      let query = supabase.from('time_tracking').select('*');
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data) {
        setLocalData('time_tracking', data);
        return data as TimeEntry[];
      }
    } catch (err) {
      console.warn('Falha na busca de ponto remoto:', err);
    }
    const local = getLocalData<TimeEntry>('time_tracking');
    return userId ? local.filter(e => (e as any).user_id === userId) : local;
  },

  saveTimeEntry: async (entry: Partial<TimeEntry>): Promise<TimeEntry | null> => {
    return db.create<TimeEntry>('time_tracking', entry);
  },

  getUserProfile: async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase.from('users').select('*').or(`id.eq.${userId},email.eq.${userId}`).maybeSingle();
      if (!error && data) return data as User;
    } catch (e) {
      console.warn('Erro ao carregar perfil do Supabase:', e);
    }
    const localUsers = getLocalData<User>('users');
    return localUsers.find(u => u.id === userId || (u as any).email === userId) || null;
  },

  updateUserProfile: async (userData: Partial<User> & { id: string }): Promise<User | null> => {
    return db.update<User>('users', userData as User);
  }
};