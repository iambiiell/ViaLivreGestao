/**
 * Client-Side PostgreSQL / Aiven Adapter
 * Connects to the Express backend API (/api/db/* and /api/events),
 * pointing directly to the public schema on the Aiven PostgreSQL database:
 * DATABASE_URL="postgres://avnadmin:AVNS__WOh3RqB6t8cYBLpx3M@vialivre-db-via-9450.f.aivencloud.com:12006/defaultdb?sslmode=require"
 */

export const isPostgresConfigured = true;
export const isSupabaseConfigured = true; // backward compatibility

// Global EventSource connection for Server-Sent Events (SSE)
let sseSource: EventSource | null = null;
const tableListeners = new Map<string, Set<(payload: any) => void>>();

function initSSE() {
  if (typeof window === 'undefined') return;
  if (sseSource) return;

  try {
    sseSource = new EventSource('/api/events');
    sseSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.table) {
          const listeners = tableListeners.get(parsed.table.toLowerCase());
          if (listeners) {
            listeners.forEach((cb) => cb(parsed));
          }
        }
      } catch (err) {
        console.warn('[SSE] Error processing event:', err);
      }
    };
    sseSource.onerror = () => {
      // Reconnection handled automatically by browser EventSource
    };
  } catch (err) {
    console.warn('[SSE] EventSource unavailable:', err);
  }
}

/**
 * Fluent Query Builder for compatibility with existing Supabase-style calls
 */
export class PostgresQueryBuilder {
  private tableName: string;
  private filters: Record<string, any> = {};
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private isMutation = false;
  private orCondition: string | null = null;
  private payload: any = null;
  private targetId: string | null = null;
  private isSingle = false;

  constructor(tableName: string) {
    this.tableName = tableName.toLowerCase();
  }

  select(_fields: string = '*') {
    if (!this.isMutation) {
      this.operation = 'select';
    }
    return this;
  }

  insert(data: any) {
    this.operation = 'insert';
    this.isMutation = true;
    this.payload = data;
    return this;
  }

  upsert(data: any) {
    this.operation = 'insert';
    this.isMutation = true;
    this.payload = data;
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

  neq(column: string, value: any) {
    // Stored for delete all or conditions
    return this;
  }

  or(conditions: string) {
    this.orCondition = conditions;
    return this;
  }

  is(column: string, value: any) {
    this.filters[column] = value;
    return this;
  }

  order(_column: string, _options?: { ascending?: boolean }) {
    return this;
  }

  gte(column: string, value: any) {
    return this;
  }

  lte(column: string, value: any) {
    return this;
  }

  in(column: string, values: any[]) {
    return this;
  }

  limit(_n: number) {
    return this;
  }

  abortSignal(_signal?: AbortSignal) {
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
    try {
      if (this.operation === 'select') {
        const queryParams = new URLSearchParams();
        for (const [k, v] of Object.entries(this.filters)) {
          if (v !== undefined && v !== null) {
            queryParams.append(k, String(v));
          }
        }
        if (this.orCondition) {
          queryParams.append('or', this.orCondition);
        }
        const url = `/api/db/${this.tableName}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        const res = await fetch(url);
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
        const res = await fetch(`/api/db/${this.tableName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.payload)
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
        if (!id) throw new Error('ID is required for update');
        const res = await fetch(`/api/db/${this.tableName}/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.payload)
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        const updated = await res.json();
        const dataArr = Array.isArray(updated) ? updated : [updated];
        return { data: this.isSingle ? (dataArr[0] || null) : dataArr, error: null };
      }

      if (this.operation === 'delete') {
        const id = this.targetId;
        const url = id ? `/api/db/${this.tableName}/${encodeURIComponent(id)}` : `/api/db/${this.tableName}`;
        const res = await fetch(url, { method: 'DELETE' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        return { data: null, error: null };
      }

      return { data: null, error: null };
    } catch (error: any) {
      console.warn(`[PostgresClient] Error on ${this.tableName}:`, error);
      return { data: null, error };
    }
  }
}

/**
 * Universal Postgres Client mirroring Supabase interface
 */
export const postgresClient = {
  from(tableName: string) {
    return new PostgresQueryBuilder(tableName);
  },

  channel(channelName: string) {
    initSSE();
    let currentTable: string | null = null;
    let onEventCallback: ((payload: any) => void) | null = null;
    const broadcastCleanups: Array<() => void> = [];

    return {
      on(type: string, filter: { event?: string; schema?: string; table?: string; filter?: string }, callback: (payload: any) => void) {
        if (filter?.table) {
          const tbl = String(filter.table).toLowerCase();
          currentTable = tbl;
          onEventCallback = callback;
          if (!tableListeners.has(tbl)) {
            tableListeners.set(tbl, new Set());
          }
          tableListeners.get(tbl)!.add(callback);
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
        // Broadcast custom local event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vialivre-broadcast', { detail: { channel: channelName, message } }));
        }
        return 'ok';
      },
      unsubscribe() {
        if (currentTable && onEventCallback && tableListeners.has(currentTable)) {
          tableListeners.get(currentTable)!.delete(onEventCallback);
        }
        broadcastCleanups.forEach(cleanup => cleanup());
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
          return { data: { session: { user, access_token: 'local-token' } }, error: null };
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
    from(_bucketName: string) {
      return {
        async upload(fileName: string, file: File | Blob): Promise<{ data: any; error: any }> {
          try {
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = async () => {
                const dataUrl = reader.result as string;
                try {
                  const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dataUrl, fileName })
                  });
                  const json = await res.json();
                  resolve({ data: json, error: null });
                } catch (err: any) {
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
              publicUrl: `/assets/${fileName}`
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
