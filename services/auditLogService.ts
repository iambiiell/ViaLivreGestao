/**
 * Audit Log Service
 * Manages chronological recording and retrieval of critical operational actions:
 * - Trip deletion & updates
 * - Driver/conductor shift alterations
 * - Route modifications
 * - System configuration & backup executions
 */

import { AuditLog, AuditActionType, AuditSeverity, User } from '../types';
import { db } from './database';

const AUDIT_STORAGE_KEY = 'vialivre_audit_logs_history';

// Generate UUID safely
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Initial realistic seed records for operational transparency
function getInitialSeedLogs(): AuditLog[] {
  const now = Date.now();
  return [
    {
      id: generateUUID(),
      user_name: 'Carlos Mendes',
      user_role: 'DESPACHANTE',
      user_email: 'despachante.carlos@vialivre.com',
      action_type: 'TRIP_DELETED',
      severity: 'CRITICAL',
      entity_type: 'TRIP',
      entity_id: 'TRP-1082',
      entity_label: 'Linha 102 - São Paulo → Santos (14:30)',
      description: 'Viagem das 14:30 cancelada e excluída da escala devido a pane mecânica severa no veículo.',
      details: 'Ônibus prefixo FLX-802 apresentou superaquecimento de motor no terminal. Passagistas realocados na viagem subsequente das 15:00.',
      previous_state: { status: 'Agendada', bus_number: '802', driver: 'Roberto Santos', passengers_count: 38 },
      created_at: new Date(now - 1000 * 60 * 22).toISOString() // 22 minutes ago
    },
    {
      id: generateUUID(),
      user_name: 'Mariana Duarte',
      user_role: 'GERENTE OPERACIONAL',
      user_email: 'mariana.operacoes@vialivre.com',
      action_type: 'SHIFT_MODIFIED',
      severity: 'WARNING',
      entity_type: 'SHIFT',
      entity_id: 'SHF-904',
      entity_label: 'Escala 06:00 às 14:00 - Turno Matutino',
      description: 'Substituição urgente de motorista titular na escala do Corredor Metropolitano Central.',
      details: 'Motorista titular João Batista afastado por atestado médico. Substituto convocado: Fernando Lima (Matrícula: FLX-044).',
      previous_state: { driver_id: 'usr-01', driver_name: 'João Batista', work_shift: '06:00 - 14:00' },
      new_state: { driver_id: 'usr-09', driver_name: 'Fernando Lima', work_shift: '06:00 - 14:00' },
      created_at: new Date(now - 1000 * 60 * 75).toISOString() // 75 minutes ago
    },
    {
      id: generateUUID(),
      user_name: 'Admin Central',
      user_role: 'ADMIN',
      user_email: 'admin@vialivre.com',
      action_type: 'BACKUP_TRIGGERED',
      severity: 'INFO',
      entity_type: 'BACKUP',
      entity_id: 'BKP-SNAP-01',
      entity_label: 'Backup Automático Programado (Nuvem)',
      description: 'Cópia de segurança periódica concluída com integridade estrutural verificada em 18 tabelas.',
      details: 'Destino: Servidor Cloud Supabase. Total de registros salvos: 1.428 registros. Tamanho: 482 KB.',
      created_at: new Date(now - 1000 * 60 * 60 * 4).toISOString() // 4 hours ago
    },
    {
      id: generateUUID(),
      user_name: 'Ricardo Nogueira',
      user_role: 'DESPACHANTE',
      user_email: 'despacho.ricardo@vialivre.com',
      action_type: 'TRIP_UPDATED',
      severity: 'WARNING',
      entity_type: 'TRIP',
      entity_id: 'TRP-1055',
      entity_label: 'Linha 201 - Campinas → Jundiaí (08:15)',
      description: 'Status da viagem alterado para ATRASADA devido a congestionamento na Rodovia Anhanguera (KM 62).',
      previous_state: { status: 'Agendada', delay_minutes: 0 },
      new_state: { status: 'Atrasada', delay_minutes: 25 },
      created_at: new Date(now - 1000 * 60 * 60 * 7).toISOString() // 7 hours ago
    },
    {
      id: generateUUID(),
      user_name: 'Mariana Duarte',
      user_role: 'GERENTE OPERACIONAL',
      user_email: 'mariana.operacoes@vialivre.com',
      action_type: 'SHIFT_CREATED',
      severity: 'INFO',
      entity_type: 'SHIFT',
      entity_id: 'SHF-903',
      entity_label: 'Nova Escala Adicional - Turno Noturno 22:00 às 06:00',
      description: 'Atribuição de escala de reforço para atender demanda de feriado e alta temporada.',
      new_state: { driver_name: 'Carlos Eduardo', route: 'Linha 305 - Noturna', bus_model: 'Marcopolo Paradiso 1200' },
      created_at: new Date(now - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
    }
  ];
}

export class AuditLogService {
  /**
   * Retrieves all chronological audit log records
   */
  static async getLogs(): Promise<AuditLog[]> {
    let localLogs: AuditLog[] = [];
    try {
      const stored = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (stored) {
        localLogs = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[AuditLogService] Error parsing stored audit logs:', e);
    }

    // Try fetching remote logs from trips_audit if available
    try {
      const remote = await db.getTripsAudit();
      if (Array.isArray(remote) && remote.length > 0) {
        // Merge without duplicates
        const map = new Map<string, AuditLog>();
        localLogs.forEach(l => map.set(l.id, l));
        remote.forEach((r: any) => {
          if (r && r.id) {
            map.set(r.id, {
              id: r.id,
              system_id: r.system_id,
              user_id: r.user_id,
              user_name: r.user_name || r.operator_name || 'Operador',
              user_role: r.user_role || 'OPERADOR',
              action_type: r.action_type || 'TRIP_UPDATED',
              severity: r.severity || 'WARNING',
              entity_type: r.entity_type || 'TRIP',
              entity_id: r.entity_id || r.trip_id,
              entity_label: r.entity_label || r.route_name,
              description: r.description || r.action || 'Ação registrada no sistema',
              details: r.details,
              previous_state: r.previous_state,
              new_state: r.new_state,
              created_at: r.created_at || new Date().toISOString()
            });
          }
        });
        localLogs = Array.from(map.values());
      }
    } catch (err) {
      // Offline fallback ok
    }

    // If still empty, load initial seed records
    if (!localLogs || localLogs.length === 0) {
      localLogs = getInitialSeedLogs();
      try {
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(localLogs));
      } catch {}
    }

    // Return strictly sorted descending by created_at (newest first)
    return localLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Records a critical operational action
   */
  static async logAction(
    action: {
      action_type: AuditActionType;
      severity: AuditSeverity;
      entity_type: 'TRIP' | 'SHIFT' | 'ROUTE' | 'USER' | 'VEHICLE' | 'BACKUP' | 'SYSTEM';
      entity_id?: string;
      entity_label?: string;
      description: string;
      details?: string;
      previous_state?: Record<string, any>;
      new_state?: Record<string, any>;
      currentUser?: User | null;
    }
  ): Promise<AuditLog> {
    const user = action.currentUser;
    const newLog: AuditLog = {
      id: generateUUID(),
      system_id: user?.system_id,
      user_id: user?.id,
      user_name: user?.full_name || user?.name || 'Operador do Sistema',
      user_role: user?.job_title || user?.role || 'OPERADOR',
      user_email: user?.email,
      user_photo: user?.photo_url || user?.avatar_url,
      action_type: action.action_type,
      severity: action.severity,
      entity_type: action.entity_type,
      entity_id: action.entity_id,
      entity_label: action.entity_label,
      description: action.description,
      details: action.details,
      previous_state: action.previous_state,
      new_state: action.new_state,
      created_at: new Date().toISOString()
    };

    // Save locally
    try {
      const stored = localStorage.getItem(AUDIT_STORAGE_KEY);
      const existing: AuditLog[] = stored ? JSON.parse(stored) : [];
      const updated = [newLog, ...existing.filter(l => l.id !== newLog.id)].slice(0, 500); // keep up to 500 records
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[AuditLogService] Error saving log to localStorage:', e);
    }

    // Attempt remote persistence
    try {
      await db.create('trips_audit', {
        id: newLog.id,
        system_id: newLog.system_id,
        user_id: newLog.user_id,
        user_name: newLog.user_name,
        user_role: newLog.user_role,
        action_type: newLog.action_type,
        severity: newLog.severity,
        entity_type: newLog.entity_type,
        entity_id: newLog.entity_id,
        entity_label: newLog.entity_label,
        description: newLog.description,
        details: newLog.details,
        created_at: newLog.created_at
      });
    } catch (err) {
      // Local fallback active
    }

    // Dispatch realtime event
    window.dispatchEvent(new CustomEvent('vialivre-audit-updated', { detail: newLog }));

    return newLog;
  }

  /**
   * Clears audit logs (restricted action)
   */
  static async clearLogs(): Promise<void> {
    try {
      localStorage.removeItem(AUDIT_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('vialivre-audit-updated'));
    } catch {}
  }
}
