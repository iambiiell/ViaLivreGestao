import express from 'express';
import http from 'http';
import path from 'path';
import nodemailer from 'nodemailer';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  pool,
  runQuery,
  initDatabase,
  checkDatabaseHealth,
  fetchAllRows,
  upsertRow,
  updateRowById,
  deleteRowById,
  deleteByField,
  clearTableData,
  getOperationalContext,
  authenticateUser,
  lookupUserForReset,
  resetUserPassword,
  resolveRootAdminSystemId,
  restoreBackupData,
  extractBackupTablesMap,
  generateUUID,
  DEFAULT_SYSTEM_UUID
} from './server/db';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Server-Sent Events (SSE) manager for instant multi-device real-time synchronization
type SSEClient = express.Response;
const sseClients = new Set<SSEClient>();

function broadcastDbEvent(event: {
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: any;
  old?: any;
  system_id?: string;
}) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

function getSystemIdFromRequest(req: express.Request): string | null {
  const headerId = req.headers['x-system-id'];
  const queryId = req.query.system_id;
  const bodyId = req.body?.system_id;
  const candidate = (Array.isArray(headerId) ? headerId[0] : headerId) ||
                    (Array.isArray(queryId) ? queryId[0] : queryId) ||
                    bodyId;
  return candidate ? String(candidate) : null;
}

function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = process.env.SMTP_PASS || '';
  const parsedPort = Number(process.env.SMTP_PORT);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const from = (process.env.SMTP_FROM || '').trim() || user || 'no-reply@vialivre.com.br';
  const configured = Boolean(host && user && pass);
  return { host, user, pass, port, secure, from, configured };
}

// ==========================================
// 1. HEALTH CHECK, DATABASE INIT & MOBILE SYNC STATUS
// ==========================================
app.get('/api/health', async (_req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const smtp = getSmtpConfig();
  res.json({
    status: dbHealth.connected ? 'ok' : 'degraded',
    serverTime: new Date().toISOString(),
    database: {
      provider: 'Aiven PostgreSQL',
      host: dbHealth.host,
      database: dbHealth.database,
      schema: 'public',
      connected: dbHealth.connected,
      initialized: dbHealth.initialized,
      tablesCount: dbHealth.tablesCount,
      latencyMs: dbHealth.latencyMs,
      error: dbHealth.error || null
    },
    smtp: {
      configured: smtp.configured,
      port: smtp.port,
      secure: smtp.secure
    }
  });
});

app.post('/api/db/init', async (_req, res) => {
  try {
    const initialized = await initDatabase();
    const health = await checkDatabaseHealth();
    res.json({ success: initialized, ...health });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Erro ao inicializar banco' });
  }
});

app.get('/api/mobile/sync/status', async (_req, res) => {
  const dbHealth = await checkDatabaseHealth();
  res.json({
    online: dbHealth.connected,
    provider: 'Aiven PostgreSQL',
    connectedClients: sseClients.size,
    tablesCount: dbHealth.tablesCount,
    latencyMs: dbHealth.latencyMs,
    serverTime: new Date().toISOString()
  });
});

// ==========================================
// 2. REALTIME EVENTS (SSE) & BROADCAST
// ==========================================
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

app.post('/api/events/broadcast', (req, res) => {
  const { table, eventType, payload } = req.body || {};
  broadcastDbEvent({
    table: table || 'broadcast',
    eventType: eventType || 'UPDATE',
    new: payload || {}
  });
  res.json({ success: true, clients: sseClients.size });
});

// ==========================================
// 3. AUTHENTICATION ENDPOINTS (PASSWORD HASHING & TENANT RESOLUTION)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identificação e senha são obrigatórias.' });
  }

  try {
    const result = await authenticateUser(String(identifier), String(password));
    if (!result.user) {
      return res.status(401).json({ error: result.error || 'Credenciais inválidas.' });
    }
    return res.json({ user: result.user });
  } catch (err: any) {
    console.error('[API/AUTH/LOGIN] Erro:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Erro ao autenticar no servidor.' });
  }
});

app.post('/api/auth/lookup', async (req, res) => {
  const { identifier } = req.body || {};
  if (!identifier) {
    return res.status(400).json({ error: 'Informe e-mail, login ou CPF.' });
  }
  try {
    const user = await lookupUserForReset(String(identifier));
    if (!user) {
      return res.status(404).json({ error: 'Usuário não localizado.' });
    }
    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao localizar usuário.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { userId, newPassword } = req.body || {};
  if (!userId || !newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ error: 'ID do usuário e nova senha (mínimo 4 caracteres) são obrigatórios.' });
  }
  try {
    const ok = await resetUserPassword(String(userId), String(newPassword));
    if (!ok) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao redefinir senha.' });
  }
});

app.post('/api/auth/resolve-system-id', async (req, res) => {
  try {
    const systemId = await resolveRootAdminSystemId(req.body || null);
    return res.json({ system_id: systemId || DEFAULT_SYSTEM_UUID });
  } catch (err: any) {
    return res.json({ system_id: DEFAULT_SYSTEM_UUID });
  }
});

// ==========================================
// 4. GENERIC DATABASE CRUD API (AIVEN POSTGRESQL PUBLIC SCHEMA)
// ==========================================
function getDbErrorStatus(err: any): number {
  if (!pool) return 503;
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  if (code === '57014' || msg.includes('timeout')) return 504;
  if (code === '53300' || msg.includes('too many clients') || msg.includes('remaining connection slots')) return 503;
  return 500;
}

app.get('/api/db/:table', async (req, res) => {
  const { table } = req.params;
  const systemId = getSystemIdFromRequest(req);
  const bypassSystemId = req.query.bypass_system_id === 'true' || req.query.bypassSystemId === 'true';
  const strictSystemId = req.query.strict_system_id === 'true';

  try {
    const rows = await fetchAllRows(table, req.query as Record<string, any>, {
      systemId,
      bypassSystemId,
      strictSystemId
    });
    res.json(rows);
  } catch (err: any) {
    console.error(`[API] Error fetching table ${table}:`, err?.message || err);
    res.status(getDbErrorStatus(err)).json({ error: err?.message || 'Database query failure' });
  }
});

app.post('/api/db/:table', async (req, res) => {
  const { table } = req.params;
  const systemId = getSystemIdFromRequest(req);
  const payload = req.body;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ error: 'Payload JSON inválido. É esperado um objeto.' });
  }

  try {
    const saved = await upsertRow(table, payload, systemId);
    broadcastDbEvent({
      table,
      eventType: payload?.id ? 'UPDATE' : 'INSERT',
      new: saved,
      system_id: saved?.system_id || systemId || undefined
    });
    res.json(saved);
  } catch (err: any) {
    console.error(`[API] Error inserting/upserting in ${table}:`, err?.message || err);
    res.status(getDbErrorStatus(err)).json({ error: err?.message || 'Insert error' });
  }
});

app.put('/api/db/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  const systemId = getSystemIdFromRequest(req);
  const bypassSystemId = req.query.bypass_system_id === 'true';
  const payload = req.body;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ error: 'Payload JSON inválido. É esperado um objeto.' });
  }

  try {
    const updated = await updateRowById(table, id, payload, systemId, bypassSystemId);
    broadcastDbEvent({
      table,
      eventType: 'UPDATE',
      new: updated,
      system_id: updated?.system_id || systemId || undefined
    });
    res.json(updated);
  } catch (err: any) {
    console.error(`[API] Error updating in ${table}:`, err?.message || err);
    res.status(getDbErrorStatus(err)).json({ error: err?.message || 'Update error' });
  }
});

app.delete('/api/db/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  const systemId = getSystemIdFromRequest(req);
  const bypassSystemId = req.query.bypass_system_id === 'true';

  try {
    const success = await deleteRowById(table, id, systemId, bypassSystemId);
    broadcastDbEvent({
      table,
      eventType: 'DELETE',
      old: { id },
      system_id: systemId || undefined
    });
    res.json({ success, id });
  } catch (err: any) {
    console.error(`[API] Error deleting from ${table}:`, err?.message || err);
    res.status(getDbErrorStatus(err)).json({ error: err?.message || 'Delete error' });
  }
});

app.delete('/api/db/:table', async (req, res) => {
  const { table } = req.params;
  const systemId = getSystemIdFromRequest(req);
  const { field, value, case_insensitive } = req.query;

  try {
    if (field && value !== undefined) {
      const success = await deleteByField(
        table,
        String(field),
        String(value),
        case_insensitive === 'true',
        systemId
      );
      broadcastDbEvent({ table, eventType: 'DELETE', old: { [String(field)]: value } });
      return res.json({ success });
    }

    const success = await clearTableData(table, systemId);
    broadcastDbEvent({
      table,
      eventType: 'DELETE',
      old: { all: true },
      system_id: systemId || undefined
    });
    res.json({ success });
  } catch (err: any) {
    console.error(`[API] Error clearing/deleting table ${table}:`, err?.message || err);
    res.status(getDbErrorStatus(err)).json({ error: err?.message || 'Clear error' });
  }
});

// ==========================================
// 4B. RESTAURAÇÃO DE BACKUP COMPLETO (.JSON)
// ==========================================
app.post('/api/backup/restore', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Arquivo/payload de backup inválido.' });
  }

  const rawBackup = body.backup && typeof body.backup === 'object' ? body.backup : body;
  const targetSystemId =
    (typeof body.targetSystemId === 'string' && body.targetSystemId.trim()) ||
    getSystemIdFromRequest(req) ||
    DEFAULT_SYSTEM_UUID;

  const detectedTables = extractBackupTablesMap(rawBackup);
  if (Object.keys(detectedTables).length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Nenhuma tabela ou registro válido encontrado no backup para restauração.'
    });
  }

  try {
    const result = await restoreBackupData(rawBackup, targetSystemId);
    broadcastDbEvent({
      table: 'backup_restore',
      eventType: 'UPDATE',
      new: {
        action: 'restore',
        recordsRestored: result.recordsRestored,
        tablesRestored: result.tablesRestored
      },
      system_id: result.targetSystemId
    });
    return res.json(result);
  } catch (err: any) {
    console.error('[API/BACKUP/RESTORE] Erro ao restaurar backup:', err?.message || err);
    return res.status(getDbErrorStatus(err)).json({
      success: false,
      error: err?.message || 'Erro interno ao restaurar backup no PostgreSQL.'
    });
  }
});

// ==========================================
// 5. OPERATIONAL CONTEXT & AI ASSISTANT ("TICO")
// ==========================================
app.get('/api/ai/operational-context', async (req, res) => {
  try {
    const systemId = getSystemIdFromRequest(req);
    const context = await getOperationalContext(systemId);
    res.json(context);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch operational context' });
  }
});

function getValidGeminiApiKey(): string | null {
  const candidate = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (candidate && typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }
  return null;
}

function generateLocalTicoResponse(prompt: string, operationalData: any, _focus?: string): string {
  const p = (prompt || '').toLowerCase();
  const fleet = operationalData.fleetSummary || { total: 0, active: 0, maintenance: 0, vehicles: [] };
  const routes = operationalData.routesSummary || { totalActiveRoutes: 0, routes: [] };
  const occurrences = operationalData.occurrencesSummary || { pendingOccurrences: 0, occurrences: [] };
  const trips = operationalData.tripsSummary || { totalTripsLogged: 0, recentTrips: [] };

  if (p.includes('frota') || p.includes('veículo') || p.includes('veiculo') || p.includes('ônibus') || p.includes('onibus')) {
    const maintList = (fleet.vehicles || [])
      .filter((v: any) => v.status === 'MAINTENANCE' || v.status === 'MANUTENÇÃO' || v.status === 'MANUTENCAO')
      .map((v: any) => `${v.prefix || v.plate || 'Veículo'} (${v.model || 'Ônibus'})`)
      .slice(0, 5)
      .join(', ');

    return `Olá! Sou o Tico, o Assistente Operacional do ViaLivre Gestão. Aqui está o resumo da nossa frota no Aiven PostgreSQL:
• Frota Total: ${fleet.total} veículos cadastrados
• Em Operação: ${fleet.active} veículos ativos
• Em Manutenção: ${fleet.maintenance} veículos${maintList ? ` (Ex: ${maintList})` : ''}

A taxa de disponibilidade da frota está em ${fleet.total > 0 ? Math.round((fleet.active / fleet.total) * 100) : 100}%. Todos os veículos ativos estão liberados para cumprimento das ordens de serviço.`;
  }

  if (p.includes('manuten') || p.includes('oficina') || p.includes('revis') || p.includes('preventiv') || p.includes('quebr')) {
    const maintVehicles = (fleet.vehicles || [])
      .filter((v: any) => v.status === 'MAINTENANCE' || v.status === 'MANUTENÇÃO' || v.status === 'MANUTENCAO')
      .slice(0, 6);

    let text = `Olá! Sou o Tico. Atualmente temos ${fleet.maintenance} veículo(s) com registro de manutenção preventiva ou corretiva no Aiven PostgreSQL.\n`;
    if (maintVehicles.length > 0) {
      text += `\nVeículos em oficina:\n` + maintVehicles.map((v: any) => `• Prefixo ${v.prefix || v.plate}: ${v.model || 'Ônibus'} - ${v.notes || 'Aguardando liberação mecânica'}`).join('\n');
    } else {
      text += `\nNenhum veículo em parada técnica crítica no momento. Toda a frota ativa está liberada para escalas.`;
    }
    return text;
  }

  if (p.includes('rota') || p.includes('itinerár') || p.includes('linha') || p.includes('horário') || p.includes('horario') || p.includes('escala')) {
    const routeSample = (routes.routes || []).slice(0, 6).map((r: any) => `• Linha ${r.prefixo_linha || 'N/A'}: ${r.origin || 'Origem'} ⇄ ${r.destination || 'Destino'}`).join('\n');
    return `Olá! Sou o Tico. Temos ${routes.totalActiveRoutes} itinerário(s) cadastrado(s) no Aiven PostgreSQL:\n\n${routeSample || '• Linhas ativas regulares em circulação'}\n\nTodas as linhas sincronizadas com as viagens programadas.`;
  }

  if (p.includes('ocorrên') || p.includes('ocorren') || p.includes('problema') || p.includes('incidente') || p.includes('aviso')) {
    if (occurrences.pendingOccurrences > 0) {
      const sample = (occurrences.occurrences || []).slice(0, 4).map((o: any) => `• ${o.title || o.type || 'Alerta'}: ${o.description || 'Pendente de validação'}`).join('\n');
      return `Olá! Sou o Tico. Identifiquei ${occurrences.pendingOccurrences} ocorrência(s) pendente(s) no sistema:\n\n${sample}\n\nRecomendo verificar a aba de Ocorrências para despacho operacional prioritário.`;
    } else {
      return `Olá! Sou o Tico. Não há ocorrências pendentes no momento. A operação segue fluida e dentro dos horários planejados.`;
    }
  }

  if (p.includes('viagen') || p.includes('viagem') || p.includes('saída') || p.includes('partida')) {
    return `Olá! Sou o Tico. No banco Aiven PostgreSQL temos ${trips.totalTripsLogged} viagem(ns) registradas no histórico operacional. As escalas programadas estão sendo acompanhadas em tempo real.`;
  }

  return `Olá! Sou o Tico, o Assistente Operacional Inteligente do ViaLivre Gestão.

Sincronizado diretamente com o banco Aiven PostgreSQL:
• Frota Operacional: ${fleet.active}/${fleet.total} veículos em operação (${fleet.maintenance} em manutenção)
• Rotas Ativas: ${routes.totalActiveRoutes} linhas cadastradas
• Ocorrências Pendentes: ${occurrences.pendingOccurrences} registros
• Histórico de Viagens: ${trips.totalTripsLogged} viagens

Como posso auxiliar na gestão operacional hoje? Posso detalhar itinerários, status de ônibus, manutenções preventivas ou escalas.`;
}

app.post('/api/ai/assistant', async (req, res) => {
  const { prompt, focus } = req.body;
  const systemId = getSystemIdFromRequest(req);

  try {
    const operationalData = await getOperationalContext(systemId);
    const apiKey = getValidGeminiApiKey();

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        const systemPrompt = `Você é o Tico, o Assistente Operacional Inteligente do ViaLivre Gestão, um sistema avançado de transporte público e gerenciamento de frotas rodoviárias e urbanas.
Você está conectado diretamente em tempo real à base de dados Aiven PostgreSQL da ViaLivre.
Você tem acesso em tempo real ao contexto operacional abaixo:

--- DADOS OPERACIONAIS EM TEMPO REAL (AIVEN POSTGRESQL) ---
- Frota Total: ${operationalData.fleetSummary.total} veículos (${operationalData.fleetSummary.active} operacionais / ${operationalData.fleetSummary.maintenance} em oficina ou manutenção).
- Lista de Veículos: ${JSON.stringify(operationalData.fleetSummary.vehicles.slice(0, 30))}
- Rotas / Itinerários: ${JSON.stringify(operationalData.routesSummary.routes.slice(0, 30))}
- Viagens Recentes / Programadas: ${JSON.stringify(operationalData.tripsSummary.recentTrips.slice(0, 30))}
- Ocorrências e Avisos Técnicos: ${JSON.stringify(operationalData.occurrencesSummary.occurrences.slice(0, 20))}
-----------------------------------------------------------

Instruções:
- Apresente-se como Tico sempre que apropriado.
- Seja conciso, ágil, prestativo e profissional.
- Baseie suas respostas estritamente no contexto da frota, rotas e escala do sistema ViaLivre.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\nFoco da consulta: ${focus || 'Geral'}\nPergunta do operador: "${prompt}"` }] }
          ]
        });

        if (response.text) {
          return res.json({
            reply: response.text,
            contextSummary: operationalData
          });
        }
      } catch (geminiErr: any) {
        console.warn('[Tico AI Assistant] Operando com inteligência operacional PostgreSQL nativa:', geminiErr?.message || geminiErr);
      }
    }

    const reply = generateLocalTicoResponse(prompt, operationalData, focus);
    return res.json({
      reply,
      contextSummary: operationalData
    });
  } catch (err: any) {
    console.warn('[Tico AI Assistant] Erro no endpoint:', err?.message || err);
    return res.json({
      reply: 'Olá, sou o Tico! A central de inteligência operacional está sincronizada com o banco de dados Aiven PostgreSQL.',
      contextSummary: {
        timestamp: new Date().toISOString(),
        database: 'Aiven PostgreSQL',
        fleetSummary: { total: 0, active: 0, maintenance: 0, vehicles: [] },
        routesSummary: { totalActiveRoutes: 0, routes: [] },
        tripsSummary: { totalTripsLogged: 0, recentTrips: [] },
        occurrencesSummary: { pendingOccurrences: 0, occurrences: [] },
        companiesSummary: { companies: [] }
      }
    });
  }
});

app.post('/api/ai/maintenance-estimate', async (req, res) => {
  const { techReport } = req.body;
  const apiKey = getValidGeminiApiKey();

  if (!techReport?.trim()) {
    return res.json({ cost: 150, partDetails: 'Estimativa padrão / Revisão geral' });
  }

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Você é um engenheiro mecânico de frotas de ônibus e transporte rodoviário.
Analise o relatório técnico abaixo e estime o custo aproximado total (em Reais R$) e liste resumidamente as principais peças e serviços deduzidos.

Relatório Técnico: "${techReport}"

Responda em formato JSON estrito:
{
  "cost": <número em reais>,
  "partDetails": "<resumo das peças e serviços identificados>"
}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cost: { type: Type.NUMBER, description: 'Custo total estimado em Reais' },
              partDetails: { type: Type.STRING, description: 'Lista sucinta de peças ou serviços identificados' }
            },
            required: ['cost', 'partDetails']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (typeof parsed.cost === 'number') {
        return res.json({
          cost: parsed.cost,
          partDetails: parsed.partDetails || 'Manutenção geral realizada'
        });
      }
    } catch {}
  }

  const rep = (techReport || '').toLowerCase();
  let calculatedCost = 250;
  const parts: string[] = [];

  if (rep.includes('motor') || rep.includes('cabeçote') || rep.includes('pistão')) {
    calculatedCost += 1800;
    parts.push('Revisão de componentes do motor');
  }
  if (rep.includes('freio') || rep.includes('pastilha') || rep.includes('disco') || rep.includes('lona')) {
    calculatedCost += 420;
    parts.push('Troca de pastilhas/lonas e retífica de tambor/disco');
  }
  if (rep.includes('óleo') || rep.includes('oleo') || rep.includes('filtro')) {
    calculatedCost += 350;
    parts.push('Troca de óleo de motor 15W40 e kit de filtros');
  }
  if (rep.includes('pneu') || rep.includes('alinhamento') || rep.includes('balanceamento')) {
    calculatedCost += 600;
    parts.push('Geometria completa, alinhamento e rodízio');
  }
  if (rep.includes('embreagem') || rep.includes('câmbio') || rep.includes('cambio')) {
    calculatedCost += 1200;
    parts.push('Inspeção de embreagem e fluido hidráulico');
  }
  if (rep.includes('suspens') || rep.includes('amortecedor') || rep.includes('mola')) {
    calculatedCost += 750;
    parts.push('Troca de amortecedores e buchas da suspensão');
  }
  if (parts.length === 0) {
    parts.push('Revisão preventiva geral e mão de obra');
  }

  return res.json({
    cost: calculatedCost,
    partDetails: parts.join(', ')
  });
});

app.post('/api/ai/route-plan', async (req, res) => {
  const { origin, destination } = req.body;
  const apiKey = getValidGeminiApiKey();

  const fallbackDistance = 65;
  const fallbackDuration = 75;

  if (!origin || !destination) {
    return res.json({
      origin: origin || 'Origem',
      destination: destination || 'Destino',
      distance_km: fallbackDistance,
      duration_minutes: fallbackDuration
    });
  }

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Você é um planejador de rotas de transporte intermunicipal e urbano no Brasil.
Calcule a distância rodoviária aproximada em quilômetros (distance_km) e a duração estimada em minutos (duration_minutes) para uma viagem de ônibus entre as cidades:
Origem: "${origin}"
Destino: "${destination}"

Responda em formato JSON estrito:
{
  "distance_km": <número>,
  "duration_minutes": <número>
}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              distance_km: { type: Type.NUMBER, description: 'Distância rodoviária em KM' },
              duration_minutes: { type: Type.NUMBER, description: 'Duração aproximada em minutos' }
            },
            required: ['distance_km', 'duration_minutes']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (typeof parsed.distance_km === 'number' && typeof parsed.duration_minutes === 'number') {
        return res.json({
          origin,
          destination,
          distance_km: Math.round(parsed.distance_km),
          duration_minutes: Math.round(parsed.duration_minutes)
        });
      }
    } catch {}
  }

  const baseKm = Math.max(35, Math.min(350, Math.round((origin.length * 7 + destination.length * 8) * 0.8)));
  const baseMinutes = Math.round(baseKm * 1.25 + 15);

  return res.json({
    origin,
    destination,
    distance_km: baseKm,
    duration_minutes: baseMinutes
  });
});

// ==========================================
// 6. FILE UPLOAD & STORAGE IN AIVEN POSTGRESQL
// ==========================================
app.post('/api/upload', async (req, res) => {
  const { dataUrl, fileName, bucket } = req.body || {};
  const systemId = getSystemIdFromRequest(req) || DEFAULT_SYSTEM_UUID;

  if (!dataUrl) {
    return res.status(400).json({ error: 'dataUrl is required' });
  }

  const fileId = generateUUID();
  const cleanName = fileName || `file_${Date.now()}`;

  if (pool) {
    try {
      await upsertRow('uploads', {
        id: fileId,
        system_id: systemId,
        bucket: bucket || 'default',
        file_name: cleanName,
        content_type: String(dataUrl).split(';')[0]?.replace('data:', '') || 'application/octet-stream',
        data_url: dataUrl
      }, systemId);
      return res.json({
        id: fileId,
        publicUrl: dataUrl,
        fileUrl: `/api/files/${fileId}`,
        fileName: cleanName
      });
    } catch (err: any) {
      console.warn('[UPLOAD] Fallback para URL direta:', err?.message);
    }
  }

  res.json({
    id: fileId,
    publicUrl: dataUrl,
    fileName: cleanName
  });
});

app.get('/api/files/:id', async (req, res) => {
  const { id } = req.params;
  if (!pool) return res.status(404).send('Not found');
  try {
    const result = await runQuery(`SELECT data_url, content_type, file_name FROM public.uploads WHERE id = $1 LIMIT 1`, [id]);
    const row = result.rows[0];
    if (!row || !row.data_url) return res.status(404).send('File not found');

    const matches = String(row.data_url).match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      const mimeType = matches[1];
      const buf = Buffer.from(matches[2], 'base64');
      res.setHeader('Content-Type', mimeType);
      return res.send(buf);
    }
    res.redirect(row.data_url);
  } catch {
    res.status(500).send('Error loading file');
  }
});

// ==========================================
// 7. EMAIL DISPATCH API (NODEMAILER / SMTP + FALLBACK)
// ==========================================
app.post('/api/email/send', async (req, res) => {
  const { to, subject, text, code, purpose, fileName, attachmentDataUrl } = req.body || {};
  if (!to || !subject) {
    return res.status(400).json({ error: 'to and subject are required' });
  }

  const smtp = getSmtpConfig();

  if (smtp.configured) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: {
          user: smtp.user,
          pass: smtp.pass
        }
      });

      const attachments: any[] = [];
      if (attachmentDataUrl && typeof attachmentDataUrl === 'string' && attachmentDataUrl.startsWith('data:')) {
        try {
          const base64Part = attachmentDataUrl.split(',')[1];
          if (base64Part) {
            attachments.push({
              filename: fileName || 'backup_vialivre.json',
              content: Buffer.from(base64Part, 'base64')
            });
          }
        } catch {}
      }

      await transporter.sendMail({
        from: smtp.from,
        to,
        subject,
        text: text || '',
        attachments
      });

      console.log(`[EMAIL_SMTP_SENT] Para: ${to} | Assunto: ${subject} | Propósito: ${purpose || 'ALERT'}`);
      return res.json({
        success: true,
        provider: 'nodemailer-smtp',
        to,
        subject,
        status: 'sent',
        timestamp: new Date().toISOString()
      });
    } catch (smtpErr: any) {
      console.warn('[EMAIL_SMTP_WARN] Falha ao enviar via SMTP, registrando log local:', smtpErr?.message || smtpErr);
    }
  }

  console.log(`[EMAIL_DISPATCH] Para: ${to} | Assunto: ${subject} | Código: ${code || 'N/A'} | Propósito: ${purpose || 'GENERAL'}`);
  res.json({
    success: true,
    provider: 'simulated',
    to,
    subject,
    status: 'sent',
    timestamp: new Date().toISOString()
  });
});

// Middleware de tratamento seguro para erros de payload JSON (ex: body malformado)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && req.path.startsWith('/api/')) {
    const status = typeof err.status === 'number' ? err.status : 400;
    return res.status(status).json({ error: err.message || 'Requisição inválida.' });
  }
  next(err);
});

// ==========================================
// 8. VITE MIDDLEWARE & STATIC SERVING
// ==========================================
async function startServer() {
  // Garante que rejeições/exceções assíncronas transitórias (DB/SMTP/Socket) não derrubem o servidor
  process.on('unhandledRejection', (reason: any) => {
    console.warn('[ViaLivre] Promessa rejeitada tratada globalmente:', reason?.message || reason);
  });
  process.on('uncaughtException', (err: any) => {
    console.error('[ViaLivre] Exceção não capturada tratada:', err?.message || err);
    if (err?.code === 'EADDRINUSE' || err?.code === 'EACCES') {
      process.exit(1);
    }
  });

  // Inicializa tabelas no Aiven PostgreSQL automaticamente sem bloquear o boot
  initDatabase().catch((err) => {
    console.warn('[Aiven PostgreSQL] Inicialização adiada:', err?.message || err);
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: { server: httpServer },
        ...(hmrDisabled ? { watch: null } : {})
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.on('error', (err: any) => {
    console.error('[ViaLivre] Erro no servidor HTTP:', err?.message || err);
    if (err?.code === 'EADDRINUSE') {
      process.exit(1);
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    const smtp = getSmtpConfig();
    console.log(`[ViaLivre] Full-Stack Server running on port ${PORT}`);
    console.log(`[ViaLivre] Backend conectado ao Aiven PostgreSQL via pg (${pool ? 'DATABASE_URL configurada' : 'aguardando DATABASE_URL'})`);
    console.log(`[ViaLivre] Serviço SMTP: ${smtp.configured ? `configurado (porta ${smtp.port})` : 'modo simulado (aguardando SMTP_HOST/SMTP_USER/SMTP_PASS)'}`);
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`[ViaLivre] Recebido ${signal}. Encerrando conexões com PostgreSQL...`);
    for (const client of sseClients) {
      try {
        client.end();
      } catch {}
    }
    sseClients.clear();
    httpServer.close(async () => {
      if (pool) {
        try {
          await pool.end();
        } catch {}
      }
      process.exit(0);
    });
    setTimeout(async () => {
      if (pool) {
        try {
          await pool.end();
        } catch {}
      }
      process.exit(0);
    }, 3000);
  };

  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[ViaLivre] Falha crítica ao iniciar servidor:', err);
  process.exit(1);
});
