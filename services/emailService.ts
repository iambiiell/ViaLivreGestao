import { db } from './database';
import { AppNotification, User } from '../types';
import { NotificationService } from './NotificationService';
import { MockNotificationService } from './MockNotificationService';

export interface EmailDispatchRecord {
  id: string;
  to: string;
  subject: string;
  body: string;
  type: 'VERIFICATION_CODE' | 'BACKUP_ATTACHMENT' | 'KEY_ACTIVATED' | 'KEY_EXPIRATION' | 'ALERT';
  code?: string;
  fileName?: string;
  attachmentDataUrl?: string;
  status: 'SENT' | 'SIMULATED';
  timestamp: string;
}

export interface VerificationCodeRecord {
  code: string;
  email: string;
  purpose: 'REGISTER' | 'PASSWORD_RESET' | 'PASSENGER_REGISTER';
  payload?: any;
  createdAt: number;
  expiresAt: number; // 15 minutes
}

const STORAGE_VERIFICATION_KEY = 'vialivre_pending_verification_codes';
const STORAGE_EMAIL_LOG_KEY = 'vialivre_email_dispatch_log';
const DISMISSED_ALERTS_KEY = 'vialivre_dismissed_alert_signatures';

export class EmailService {
  /**
   * Generates a 6-digit numeric verification code
   */
  static generate6DigitCode(): string {
    const codeNum = Math.floor(100000 + Math.random() * 900000);
    return codeNum.toString();
  }

  /**
   * Stores a verification code for an email with 15-minute validity
   */
  static storeVerificationCode(
    email: string,
    code: string,
    purpose: 'REGISTER' | 'PASSWORD_RESET' | 'PASSENGER_REGISTER',
    payload?: any
  ): VerificationCodeRecord {
    const now = Date.now();
    const record: VerificationCodeRecord = {
      code,
      email: email.trim().toLowerCase(),
      purpose,
      payload,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000 // 15 minutes
    };

    try {
      const existingStr = localStorage.getItem(STORAGE_VERIFICATION_KEY);
      const list: VerificationCodeRecord[] = existingStr ? JSON.parse(existingStr) : [];
      // Remove any previous pending codes for this email and purpose
      const filtered = list.filter(
        item => !(item.email === record.email && item.purpose === record.purpose)
      );
      filtered.push(record);
      localStorage.setItem(STORAGE_VERIFICATION_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Erro ao salvar código de verificação no localStorage:', e);
    }

    return record;
  }

  /**
   * Validates a 6-digit verification code
   */
  static verifyCode(
    email: string,
    inputCode: string,
    purpose: 'REGISTER' | 'PASSWORD_RESET' | 'PASSENGER_REGISTER'
  ): { valid: boolean; message: string; record?: VerificationCodeRecord } {
    const cleanCode = (inputCode || '').replace(/\D/g, '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (cleanCode.length !== 6) {
      return { valid: false, message: 'O código deve conter exatamente 6 dígitos numéricos.' };
    }

    try {
      const existingStr = localStorage.getItem(STORAGE_VERIFICATION_KEY);
      const list: VerificationCodeRecord[] = existingStr ? JSON.parse(existingStr) : [];
      
      const found = list.find(
        item => item.email === cleanEmail && item.purpose === purpose && item.code === cleanCode
      );

      if (!found) {
        return { valid: false, message: 'Código de 6 dígitos inválido ou não encontrado para este e-mail.' };
      }

      if (Date.now() > found.expiresAt) {
        return { valid: false, message: 'Este código expirou. Solicite um novo código de verificação.' };
      }

      // Remove validated code from pending
      const remaining = list.filter(item => item !== found);
      localStorage.setItem(STORAGE_VERIFICATION_KEY, JSON.stringify(remaining));

      return { valid: true, message: 'Código validado com sucesso!', record: found };
    } catch (e) {
      return { valid: false, message: 'Erro ao validar o código.' };
    }
  }

  /**
   * Sends 6-digit verification code email
   */
  static async sendVerificationCodeEmail(
    email: string,
    userName: string,
    purpose: 'REGISTER' | 'PASSWORD_RESET' | 'PASSENGER_REGISTER',
    payload?: any
  ): Promise<{ code: string; record: EmailDispatchRecord }> {
    const code = this.generate6DigitCode();
    this.storeVerificationCode(email, code, purpose, payload);

    let subject = '';
    let titleHeader = '';
    let actionDesc = '';

    if (purpose === 'REGISTER') {
      subject = `[ViaLivre] Código de Confirmação de Cadastro: ${code}`;
      titleHeader = 'Confirmação de Cadastro - ViaLivre Gestão';
      actionDesc = 'utilizado para ativar sua conta de Administrador/Colaborador no sistema';
    } else if (purpose === 'PASSWORD_RESET') {
      subject = `[ViaLivre] Código para Redefinição de Senha: ${code}`;
      titleHeader = 'Redefinição de Senha de Acesso';
      actionDesc = 'solicitado para redefinir sua senha de acesso';
    } else {
      subject = `[ViaLivre] Código de Verificação do Passageiro: ${code}`;
      titleHeader = 'Verificação de Conta de Passageiro / Cartão VT';
      actionDesc = 'para validar sua identificação no portal do passageiro';
    }

    const body = `Olá, ${userName || 'Usuário'}!\n\n` +
      `Seu código de verificação com 6 dígitos é:\n\n` +
      `👉  ${code}  👈\n\n` +
      `Este código é ${actionDesc} e tem validade de 15 minutos.\n\n` +
      `Se você não solicitou este código, por favor desconsidere este e-mail por motivos de segurança.\n\n` +
      `Atenciosamente,\nEquipe de Segurança & Suporte ViaLivre Gestão`;

    const dispatchRecord: EmailDispatchRecord = {
      id: `email-code-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      to: email,
      subject,
      body,
      type: 'VERIFICATION_CODE',
      code,
      status: 'SENT',
      timestamp: new Date().toISOString()
    };

    this.saveEmailLog(dispatchRecord);

    // 1. Send simulated mock email
    await MockNotificationService.sendEmail(email, subject, body);

    // 2. Dispatch device notification with the code for immediate testing convenience
    NotificationService.sendLocalNotification(subject, {
      body: `Seu código de verificação de 6 dígitos é: ${code}`,
      icon: '/Logo_ViaLivre.png'
    });

    // 3. Attempt server endpoint dispatch
    try {
      fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject,
          text: body,
          code,
          purpose
        })
      }).catch(() => {});
    } catch {}

    return { code, record: dispatchRecord };
  }

  /**
   * Sends automated Root Administrator notification when a new key is activated
   */
  static async sendAdminKeyActivationAlert(
    adminEmail: string,
    keyDetails: {
      keyCode: string;
      planType: string;
      companyName?: string;
      activatedByName?: string;
      expiresAt: string;
      systemId?: string;
    }
  ): Promise<EmailDispatchRecord> {
    const subject = `[ViaLivre Gestão] 🔑 Chave de Ativação Ativada: ${keyDetails.keyCode}`;
    const body = `Prezado Administrador Raiz,\n\n` +
      `Informamos que uma nova chave de ativação foi vinculada com sucesso ao sistema ViaLivre Gestão:\n\n` +
      `• Chave / Código: ${keyDetails.keyCode}\n` +
      `• Plano: ${keyDetails.planType}\n` +
      `• Empresa / Unidade: ${keyDetails.companyName || 'Matriz'}\n` +
      `• Ativado por: ${keyDetails.activatedByName || 'Administrador'}\n` +
      `• Data de Expiração: ${new Date(keyDetails.expiresAt).toLocaleDateString('pt-BR')}\n` +
      `• Identificador do Sistema: ${keyDetails.systemId || 'Padrão'}\n\n` +
      `O sistema está ativo e operando com todos os privilégios liberados.\n\n` +
      `Atenciosamente,\nViaLivre Gestão - Central de Licenciamento`;

    const dispatchRecord: EmailDispatchRecord = {
      id: `email-key-act-${Date.now()}`,
      to: adminEmail,
      subject,
      body,
      type: 'KEY_ACTIVATED',
      status: 'SENT',
      timestamp: new Date().toISOString()
    };

    this.saveEmailLog(dispatchRecord);
    await MockNotificationService.sendEmail(adminEmail, subject, body);

    // Register DB AppNotification
    try {
      await db.create<AppNotification>('notifications', {
        id: `notif-key-${Date.now()}`,
        system_id: keyDetails.systemId,
        title: `🔑 Nova Chave Ativada: ${keyDetails.keyCode}`,
        message: `A chave ${keyDetails.keyCode} (${keyDetails.planType}) foi ativada com sucesso para ${keyDetails.companyName || 'a organização'}. Validade até ${new Date(keyDetails.expiresAt).toLocaleDateString('pt-BR')}.`,
        type: 'SUCCESS',
        category: 'SYSTEM',
        target_role: 'ADMIN',
        is_read: false,
        created_at: new Date().toISOString()
      });
    } catch (e) {}

    return dispatchRecord;
  }

  /**
   * Sends automated Root Administrator notification when key/subscription is expiring
   */
  static async sendAdminKeyExpirationAlert(
    adminEmail: string,
    keyDetails: {
      keyCode?: string;
      planType: string;
      expiresAt: string;
      daysRemaining: number;
      systemId?: string;
    }
  ): Promise<EmailDispatchRecord> {
    const subject = `[ViaLivre Gestão] ⚠️ Aviso de Expiração: Plano ${keyDetails.planType} expira em ${keyDetails.daysRemaining} dia(s)`;
    const body = `Prezado Administrador Raiz,\n\n` +
      `Atenção: A licença do sistema ViaLivre Gestão está próxima do vencimento:\n\n` +
      `• Plano: ${keyDetails.planType}\n` +
      `• Chave Vinculada: ${keyDetails.keyCode || 'Licença Ativa'}\n` +
      `• Data de Expiração: ${new Date(keyDetails.expiresAt).toLocaleDateString('pt-BR')}\n` +
      `• Dias Restantes: ${keyDetails.daysRemaining} dia(s)\n\n` +
      `Para evitar a interrupção das operações de escala, venda de passagens e controle de ponto, renove sua chave de ativação na aba de Licenciamento.\n\n` +
      `Atenciosamente,\nViaLivre Gestão - Central de Licenciamento`;

    const dispatchRecord: EmailDispatchRecord = {
      id: `email-key-exp-${Date.now()}`,
      to: adminEmail,
      subject,
      body,
      type: 'KEY_EXPIRATION',
      status: 'SENT',
      timestamp: new Date().toISOString()
    };

    this.saveEmailLog(dispatchRecord);
    await MockNotificationService.sendEmail(adminEmail, subject, body);

    try {
      await db.create<AppNotification>('notifications', {
        id: `notif-exp-${Date.now()}`,
        system_id: keyDetails.systemId,
        title: `⚠️ Licença Expira em ${keyDetails.daysRemaining} dia(s)`,
        message: `Sua assinatura do plano ${keyDetails.planType} expira no dia ${new Date(keyDetails.expiresAt).toLocaleDateString('pt-BR')}. Renove com uma nova chave para manter os serviços ativos.`,
        type: 'WARNING',
        category: 'SYSTEM',
        target_role: 'ADMIN',
        is_read: false,
        created_at: new Date().toISOString()
      });
    } catch (e) {}

    return dispatchRecord;
  }

  /**
   * Sends automated email with backup file attachment and download URL to the Root Administrator
   */
  static async sendAdminBackupFileEmail(
    adminEmail: string,
    fileName: string,
    backupJsonString: string,
    approxSize: string,
    systemId?: string
  ): Promise<EmailDispatchRecord> {
    const subject = `[ViaLivre] 💾 Cópia de Segurança Completa em Anexo: ${fileName}`;
    const nowStr = new Date().toLocaleString('pt-BR');
    
    // Create base64 Data URL for the attachment
    const blob = new Blob([backupJsonString], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    let base64Data = '';
    try {
      base64Data = `data:application/json;base64,${btoa(unescape(encodeURIComponent(backupJsonString)))}`;
    } catch {
      base64Data = downloadUrl;
    }

    const body = `Olá, Administrador Raiz!\n\n` +
      `O arquivo completo de cópia de segurança (backup) do sistema ViaLivre Gestão foi gerado com sucesso às ${nowStr}.\n\n` +
      `• Nome do Arquivo: ${fileName}\n` +
      `• Tamanho Aproximado: ${approxSize}\n` +
      `• Status: Concluído e Resguardado com Sucesso\n\n` +
      `O arquivo de backup em formato JSON está anexado a este comunicado para seu resguardo e pode ser utilizado a qualquer momento na aba 'Restaurar' do painel administrativo para reestabelecer os dados da organização.\n\n` +
      `Atenciosamente,\nViaLivre Gestão - Sistema Automatizado de Segurança de Dados`;

    const dispatchRecord: EmailDispatchRecord = {
      id: `email-backup-${Date.now()}`,
      to: adminEmail,
      subject,
      body,
      type: 'BACKUP_ATTACHMENT',
      fileName,
      attachmentDataUrl: base64Data,
      status: 'SENT',
      timestamp: new Date().toISOString()
    };

    this.saveEmailLog(dispatchRecord);
    await MockNotificationService.sendEmail(adminEmail, subject, body, downloadUrl);

    // Register DB AppNotification with backup attachment metadata
    try {
      await db.create<AppNotification>('notifications', {
        id: `notif-backup-${Date.now()}`,
        system_id: systemId,
        title: `💾 Backup Enviado por E-mail: ${fileName}`,
        message: `Uma cópia do backup (${approxSize}) foi transmitida com sucesso para o e-mail do Administrador (${adminEmail}). Arquivo pronto para download e restauração.`,
        type: 'SUCCESS',
        category: 'SYSTEM',
        target_role: 'ADMIN',
        is_read: false,
        created_at: new Date().toISOString(),
        metadata: {
          download_url: downloadUrl,
          file_name: fileName,
          backup_size: approxSize,
          sent_to_email: adminEmail
        }
      });
    } catch (e) {}

    return dispatchRecord;
  }

  /**
   * Save email record to history
   */
  private static saveEmailLog(record: EmailDispatchRecord) {
    try {
      const existingStr = localStorage.getItem(STORAGE_EMAIL_LOG_KEY);
      const list: EmailDispatchRecord[] = existingStr ? JSON.parse(existingStr) : [];
      list.unshift(record);
      localStorage.setItem(STORAGE_EMAIL_LOG_KEY, JSON.stringify(list.slice(0, 100)));
      window.dispatchEvent(new CustomEvent('vialivre-email-dispatched', { detail: record }));
    } catch (e) {
      console.warn('Erro ao salvar log de e-mail:', e);
    }
  }

  /**
   * Get email history log
   */
  static getEmailLog(): EmailDispatchRecord[] {
    try {
      const str = localStorage.getItem(STORAGE_EMAIL_LOG_KEY);
      return str ? JSON.parse(str) : [];
    } catch {
      return [];
    }
  }

  /**
   * Dismissed alert signatures store to prevent deleted alerts from resurrecting
   */
  static getDismissedAlertSignatures(): Set<string> {
    try {
      const raw = localStorage.getItem(DISMISSED_ALERTS_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  static dismissAlertSignature(signature: string) {
    if (!signature) return;
    try {
      const set = this.getDismissedAlertSignatures();
      set.add(signature);
      localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  }

  static dismissNotificationAlert(notif: any) {
    if (!notif) return;
    if (notif.id) this.dismissAlertSignature(notif.id);
    if (notif.category && notif.title) this.dismissAlertSignature(`${notif.category}::${notif.title}`);
    const meta = typeof notif.metadata === 'string' 
      ? (() => { try { return JSON.parse(notif.metadata); } catch(e) { return {}; } })() 
      : (notif.metadata || {});
    if (meta.signature) this.dismissAlertSignature(meta.signature);
    if (meta.trip_id) {
      this.dismissAlertSignature(`trip_${meta.trip_id}`);
      this.dismissAlertSignature(`trip_delay_${meta.trip_id}`);
    }
    if (meta.vehicle_id) {
      this.dismissAlertSignature(`vehicle_${meta.vehicle_id}`);
      this.dismissAlertSignature(`maint_${meta.vehicle_id}`);
      this.dismissAlertSignature(String(meta.vehicle_id));
    }
    if (meta.occurrence_id) {
      this.dismissAlertSignature(`occ_${meta.occurrence_id}`);
      this.dismissAlertSignature(String(meta.occurrence_id));
    }
    if (meta.time_entry_id) {
      this.dismissAlertSignature(`time_${meta.time_entry_id}`);
      this.dismissAlertSignature(String(meta.time_entry_id));
    }
  }

  static clearDismissedAlertSignatures() {
    try {
      localStorage.removeItem(DISMISSED_ALERTS_KEY);
    } catch {}
  }
}
