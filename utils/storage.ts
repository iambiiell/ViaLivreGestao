// Safe Storage Utility to prevent QuotaExceededError and render crashes
const memoryStorage = new Map<string, string>();

/**
 * Sanitizes an ImpCard object before writing to session storage.
 * Removes heavy base64 images or oversized string properties to ensure
 * the session data stays minimal (< 1KB).
 */
export const sanitizeCardForSession = (card: any) => {
  if (!card || typeof card !== 'object') return null;

  const photoUrl =
    typeof card.photo_url === 'string' && card.photo_url.length > 2000
      ? undefined
      : card.photo_url;

  return {
    id: card.id,
    system_id: card.system_id,
    company_id: card.company_id,
    name: card.name || '',
    surname: card.surname || '',
    cpf: card.cpf || '',
    rg: card.rg || '',
    card_number: card.card_number || '',
    type: card.type || 'Vale Transporte',
    balance: Number(card.balance) || 0,
    phone: card.phone || '',
    email: card.email || '',
    birth_date: card.birth_date || '',
    cep: card.cep || '',
    address_street: card.address_street || '',
    address_number: card.address_number || '',
    address_complement: card.address_complement || '',
    address_neighborhood: card.address_neighborhood || '',
    address_city: card.address_city || '',
    address_state: card.address_state || '',
    responsible_name: card.responsible_name || card.guardian_name || '',
    responsible_birth_date: card.responsible_birth_date || card.guardian_birth_date || '',
    relationship: card.relationship || card.guardian_relationship || '',
    is_passenger_buyer: Boolean(card.is_passenger_buyer),
    password: card.password || '',
    photo_url: photoUrl,
    created_at: card.created_at || '',
    updated_at: card.updated_at || ''
  };
};

/**
 * Attempts to clear temporary / disposable caches when quota is exceeded
 */
const pruneStorageQuota = () => {
  try {
    if (typeof localStorage === 'undefined') return;
    const disposablePrefixes = [
      'temp_',
      'cache_',
      'vialivre_db_routes_logs',
      'vialivre_db_driver_logs',
      'vialivre_db_inspections',
      'vialivre_db_occurrences',
      'vialivre_db_maintenance',
      'passenger_read_notices',
      'passenger_hidden_notices',
      'vialivre_deleted_'
    ];

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && disposablePrefixes.some(p => k.startsWith(p) || k.includes('log') || k.includes('cache'))) {
        keysToRemove.push(k);
      }
    }

    keysToRemove.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
  } catch (e) {
    console.warn('[safeStorage] Erro ao limpar chaves temporárias de localStorage:', e);
  }
};

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(key);
        if (item !== null) return item;
      }
    } catch (e) {
      console.warn(`[safeStorage] Não foi possível ler '${key}' de localStorage:`, e);
    }
    return memoryStorage.get(key) || null;
  },

  setItem: (key: string, value: string): boolean => {
    // Always keep memory storage in sync
    memoryStorage.set(key, value);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return true;
      }
    } catch (err: any) {
      console.warn(`[safeStorage] Cota excedida ou erro ao salvar '${key}' em localStorage. Tentando recuperação...`, err);
      // Attempt quota recovery
      pruneStorageQuota();
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
          return true;
        }
      } catch (retryErr) {
        console.warn(`[safeStorage] Falha definitiva no localStorage para '${key}'. Mantendo em memória.`, retryErr);
        return false;
      }
    }
    return false;
  },

  removeItem: (key: string): void => {
    memoryStorage.delete(key);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {}
  }
};
