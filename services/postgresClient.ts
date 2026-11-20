/**
 * Client-Side PostgreSQL / Aiven Adapter
 * Connects to the Express backend API (/api/db/*, /api/auth/*, /api/events),
 * backed by PostgreSQL on Aiven via process.env.DATABASE_URL.
 */

export const isPostgresConfigured = true;
export const isSupabaseConfigured = true;

function getActiveSystemIdHeader(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const explicit = localStorage.getItem('vialivre_system_id');
    if (explicit) return explicit;
    const u = localStorage.getItem('fluxo_session_user') || localStorage.getItem('@vialivre_user');
    if (u) {
      const parsed = JSON.parse(u);
      if (parsed?.system_id) return String(parsed.system_id);
    }
  } catch {}
  return null;
}

// Global EventSource connection for Server-Sent Events (SSE)
let sseSource: EventSource | null = null;
const tableListeners = new Map<string, Set<(payload: any) => void>>();

export function initSSE() {
  if (typeof window === 'undefined') return;
  if (sseSource) return;

  try {
    sseSource = new EventSource('/api/events');
    sseSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.table) {
          const listeners = tableListeners.get(String(parsed.table).toLowerCase());
          if (listeners) {
            listeners.forEach((cb) => cb(parsed));
          }
        }
      } catch {}
    };
    sseSource.onerror = () => {
      // Automatic reconnection handled by browser EventSource
    };
  } catch (err) {
    console.warn('[SSE] EventSource unavailable:', err);
  }
}

export class PostgresQueryBuilder {
  private tableName: string;
  private filters: Record<string, any> = {};
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private isMutation = false;
  private orCondition: string | null = null;
  private payload: any = null;
  private targetId: string | null = null;
  private isSingle = false;
  private limitCount: number | null = null;
  private abortControllerSignal: AbortSignal | undefined = undefined;
  private ilikeFilter: { column: string; value: string } | null = null;

  constructor(tableName: string) {
    this.tableName = tableName.toLowerCase();
  }

  select(_fields: string = '*', _options?: any) {
    if (!this.isMutation) {
      this.operation = 'select';
    }
    return this;
  }

  insert(data: any) {
    this.operation = 'insert';
    this.isMutation = true;
    this.payload = Array.isArray(data) ? data[0] : data;
    return this;
  }

  upsert(data: any) {
    this.operation = 'insert';
    this.isMutation = true;
    this.payload = Array.isArray(data) ? data[0] : data;
    return this;
  }

  update(data: any) {
    this.operation = 'update';
    this.isMutation = true;
    this.payload = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    this.isMutation = true;
    return this;
  }

  eq(column: string, value: any) {
    if (column === 'id') {
      this.targetId = String(value);
    }
    this.filters[column] = value;
    return this;
  }

  neq(_column: string, _value: any) {
    return this;
  }

  ilike(column: string, value: string) {
    this.ilikeFilter = { column, value };
    return this;
  }

  or(conditions: string) {
    this.orCondition = conditions;
    return this;
  }

  is(column: string, value: any) {
    this.filters[column] = value === null ? 'null' : value;
    return this;
  }

  order(_column: string, _options?: { ascending?: boolean }) {
    return this;
  }

  gte(_column: string, _value: any) {
    return this;
  }

  lte(_column: string, _value: any) {
    return this;
  }

  in(_column: string, _values: any[]) {
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  abortSignal(signal?: AbortSignal) {
    this.abortControllerSignal = signal;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this.execute();
  }

  single() {
    this.isSingle = true;
    return this.execute();
  }

  then(onfulfilled?: (value: { data: any; error: any }) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  async execute(): Promise<{ data: any; error: any }> {
    const sysId = getActiveSystemIdHeader();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    if (sysId) headers['x-system-id'] = sysId;

    const safeSerialize = (data: unknown): string => {
      const seen = new WeakSet<object>();
      return JSON.stringify(data ?? {}, (_k, val) => {
        if (typeof val === 'string') return val.replace(/\u0000/g, '');
        if (typeof val === 'bigint') return val.toString();
        if (typeof val === 'function' || typeof val === 'symbol') return undefined;
        if (typeof val === 'number' && !Number.isFinite(val)) return null;
        if (val instanceof Set) return Array.from(val);
        if (val instanceof Map) return Object.fromEntries(val.entries());
        if (val !== null && typeof val === 'object') {
          if (seen.has(val)) return undefined;
          seen.add(val);
        }
        return val;
      });
    };

    const requestWithRetry = async (url: string, init: RequestInit = {}, retries = 2, timeoutMs = 15000): Promise<Response> => {
      let lastErr: any;
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (this.abortControllerSignal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const controller = new AbortController();
        let timedOut = false;
        const onExtAbort = () => controller.abort();
        this.abortControllerSignal?.addEventListener('abort', onExtAbort, { once: true });
        const timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);

        try {
          const res = await fetch(url, { ...init, signal: controller.signal });
          if (res.ok) return res;

          const errText = await res.clone().text().catch(() => '');
          const retryableHttp =
            res.status === 408 ||
            res.status === 425 ||
            res.status === 429 ||
            res.status === 502 ||
            res.status === 503 ||
            res.status === 504 ||
            (res.status === 500 && /too many clients|remaining connection slots|timeout|terminat|connection|econnreset/i.test(errText));

          if (retryableHttp && attempt < retries) {
            await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt) + Math.floor(Math.random() * 120)));
            continue;
          }
          return res;
        } catch (err: any) {
          lastErr = err;
          const isExtAborted = Boolean(this.abortControllerSignal?.aborted && !timedOut);
          const isTransient = !isExtAborted && (timedOut || err?.name === 'AbortError' || err?.name === 'TypeError' || /failed to fetch|network|timeout|load failed/i.test(err?.message || ''));
          if (isTransient && attempt < retries) {
            await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt) + Math.floor(Math.random() * 120)));
            continue;
          }
          if (timedOut) {
            const timeoutErr = new Error(`Timeout de conexão após ${timeoutMs}ms ao acessar ${url}`);
            timeoutErr.name = 'TimeoutError';
            throw timeoutErr;
          }
          throw err;
        } finally {
          clearTimeout(timer);
          this.abortControllerSignal?.removeEventListener('abort', onExtAbort);
        }
      }
      throw lastErr;
    };

    try {
      if (this.operation === 'select') {
        const queryParams = new URLSearchParams();
        for (const [k, v] of Object.entries(this.filters)) {
          if (v !== undefined) {
            queryParams.append(k, String(v));
          }
        }
        if (this.orCondition) {
          queryParams.append('or', this.orCondition);
        }
        if (this.limitCount !== null) {
          queryParams.append('limit', String(this.limitCount));
        }
        const url = `/api/db/${this.tableName}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        const res = await requestWithRetry(url, { headers });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        const data = await res.json();
        if (this.isSingle) {
          return { data: Array.isArray(data) && data.length > 0 ? data[0] : null, error: null };
        }
        return { data: Array.isArray(data) ? data : [], error: null };
      }

      if (this.operation === 'insert') {
        const res = await requestWithRetry(`/api/db/${this.tableName}`, {
          method: 'POST',
          headers,
          body: safeSerialize(this.payload)
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        const saved = await res.json();
        const dataArr = Array.isArray(saved) ? saved : [saved];
        return { data: this.isSingle ? (dataArr[0] || null) : dataArr, error: null };
      }

      if (this.operation === 'update') {
        const id = this.targetId || this.payload?.id;
        if (!id) throw new Error('ID é obrigatório para atualização');
        const res = await requestWithRetry(`/api/db/${this.tableName}/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers,
          body: safeSerialize(this.payload)
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        const updated = await res.json();
        const dataArr = Array.isArray(updated) ? updated : [updated];
        return { data: this.isSingle ? (dataArr[0] || null) : dataArr, error: null };
      }

      if (this.operation === 'delete') {
        if (this.ilikeFilter) {
          const qp = new URLSearchParams({
            field: this.ilikeFilter.column,
            value: this.ilikeFilter.value,
            case_insensitive: 'true'
          });
          const res = await requestWithRetry(`/api/db/${this.tableName}?${qp.toString()}`, {
            method: 'DELETE',
            headers
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
          return { data: null, error: null };
        }

        const id = this.targetId;
        const url = id ? `/api/db/${this.tableName}/${encodeURIComponent(id)}` : `/api/db/${this.tableName}`;
        const res = await requestWithRetry(url, { method: 'DELETE', headers });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        return { data: null, error: null };
      }

      return { data: null, error: null };
    } catch (error: any) {
      console.warn(`[PostgresClient] Erro em ${this.tableName}:`, error?.message || error);
      return { data: null, error };
    }
  }
}

export const postgresClient = {
  from(tableName: string) {
    return new PostgresQueryBuilder(tableName);
  },

  channel(channelName: string) {
    initSSE();
    const attachedTables: Array<{ tbl: string; cb: (p: any) => void }> = [];
    const broadcastCleanups: Array<() => void> = [];

    return {
      on(type: string, filter: { event?: string; schema?: string; table?: string; filter?: string }, callback: (payload: any) => void) {
        if (filter?.table) {
          const tbl = String(filter.table).toLowerCase();
          if (!tableListeners.has(tbl)) {
            tableListeners.set(tbl, new Set());
          }
          tableListeners.get(tbl)!.add(callback);
          attachedTables.push({ tbl, cb: callback });
        } else if (type === 'broadcast') {
          const targetEvent = filter?.event;
          const handler = (e: any) => {
            const detail = e.detail;
            if (!detail) return;
            const matchesChannel = !detail.channel || detail.channel === channelName;
            const matchesEvent = !targetEvent || detail.message?.event === targetEvent || detail.event === targetEvent;
            if (matchesChannel && matchesEvent) {
              callback(detail.message || detail);
            }
          };
          if (typeof window !== 'undefined') {
            window.addEventListener('vialivre-broadcast', handler);
            broadcastCleanups.push(() => window.removeEventListener('vialivre-broadcast', handler));
          }
        }
        return this;
      },
      subscribe() {
        return this;
      },
      async send(message: any) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vialivre-broadcast', { detail: { channel: channelName, message } }));
        }
        try {
          fetch('/api/events/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: channelName, eventType: 'UPDATE', payload: message })
          }).catch(() => {});
        } catch {}
        return 'ok';
      },
      unsubscribe() {
        attachedTables.forEach(({ tbl, cb }) => {
          tableListeners.get(tbl)?.delete(cb);
        });
        broadcastCleanups.forEach((cleanup) => cleanup());
      }
    };
  },

  removeChannel(channelObj: any) {
    if (channelObj && typeof channelObj.unsubscribe === 'function') {
      channelObj.unsubscribe();
    }
  },

  auth: {
    async getUser() {
      try {
        const saved =
          (typeof localStorage !== 'undefined' && (localStorage.getItem('@vialivre_user') || localStorage.getItem('fluxo_session_user'))) || null;
        if (saved) {
          const user = JSON.parse(saved);
          return { data: { user }, error: null };
        }
      } catch {}
      return { data: { user: null }, error: null };
    },

    async getSession() {
      try {
        const saved =
          (typeof localStorage !== 'undefined' && (localStorage.getItem('@vialivre_user') || localStorage.getItem('fluxo_session_user'))) || null;
        if (saved) {
          const user = JSON.parse(saved);
          return { data: { session: { user, access_token: 'vialivre-session' } }, error: null };
        }
      } catch {}
      return { data: { session: null }, error: null };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      if (typeof window !== 'undefined') {
        const handler = (e: any) => {
          callback('SIGNED_IN', { user: e.detail });
        };
        window.addEventListener('vialivre-user-changed', handler);
        return {
          data: {
            subscription: {
              unsubscribe: () => window.removeEventListener('vialivre-user-changed', handler)
            }
          }
        };
      }
      return {
        data: {
          subscription: { unsubscribe: () => {} }
        }
      };
    }
  },

  storage: {
    from(bucketName: string) {
      const uploadedUrls = new Map<string, string>();
      return {
        async upload(fileName: string, file: File | Blob): Promise<{ data: any; error: any }> {
          try {
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = async () => {
                const dataUrl = reader.result as string;
                try {
                  const sysId = getActiveSystemIdHeader();
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  if (sysId) headers['x-system-id'] = sysId;

                  const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ dataUrl, fileName, bucket: bucketName })
                  });
                  const json = await res.json();
                  const finalUrl = json?.publicUrl || dataUrl;
                  uploadedUrls.set(fileName, finalUrl);
                  resolve({ data: { ...json, publicUrl: finalUrl }, error: null });
                } catch {
                  uploadedUrls.set(fileName, dataUrl);
                  resolve({ data: { publicUrl: dataUrl }, error: null });
                }
              };
              reader.onerror = (err) => resolve({ data: null, error: err });
              reader.readAsDataURL(file);
            });
          } catch (error: any) {
            return { data: null, error };
          }
        },
        getPublicUrl(fileName: string) {
          return {
            data: {
              publicUrl: uploadedUrls.get(fileName) || `/assets/${fileName}`
            }
          };
        },
        async remove(paths: string[]): Promise<{ data: any; error: any }> {
          return { data: paths, error: null };
        }
      };
    }
  }
};
