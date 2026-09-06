import { db } from './database';
import { AppNotification } from '../types';

export interface MockNotificationRecord {
  id: string;
  type: 'EMAIL' | 'PUSH';
  recipient: string;
  title: string;
  message: string;
  status: 'SENT' | 'FAILED';
  sent_at: string;
  download_link?: string;
}

export class MockNotificationService {
  /**
   * Simulates sending an Email notification.
   */
  static async sendEmail(to: string, subject: string, body: string, downloadLink?: string): Promise<MockNotificationRecord> {
    const id = 'mock-email-' + Math.random().toString(36).substring(2, 11);

    const record: MockNotificationRecord = {
      id,
      type: 'EMAIL',
      recipient: to,
      title: subject,
      message: body,
      status: 'SENT',
      sent_at: new Date().toISOString(),
      download_link: downloadLink
    };

    this.saveToHistory(record);
    return record;
  }

  /**
   * Simulates sending a Push notification.
   */
  static async sendPush(recipientId: string, title: string, body: string, downloadLink?: string): Promise<MockNotificationRecord> {
    const id = 'mock-push-' + Math.random().toString(36).substring(2, 11);

    const record: MockNotificationRecord = {
      id,
      type: 'PUSH',
      recipient: recipientId,
      title,
      message: body,
      status: 'SENT',
      sent_at: new Date().toISOString(),
      download_link: downloadLink
    };

    this.saveToHistory(record);
    return record;
  }

  /**
   * High-level method to notify the admin about a successful backup export.
   * Compiles the mail/push content, logs them via both systems, and persists in DB.
   */
  static async notifyAdminAboutBackup(
    adminId: string,
    adminEmail: string,
    fileName: string,
    downloadLink: string,
    systemId?: string
  ): Promise<{ email: MockNotificationRecord; push: MockNotificationRecord; systemNotifId: string }> {
    
    const title = `💾 Backup Automático Concluído`;
    const statusText = `SUCESSO`;
    const body = `Olá, Administrador. O backup automático dos seus dados do sistema ViaLivre foi concluído com sucesso às ${new Date().toLocaleTimeString('pt-BR')}.\n\n` +
                 `Status: ${statusText}\n` +
                 `Nome do Arquivo: ${fileName}\n` +
                 `Para restaurar ou resguardar seus dados, você pode baixar a cópia de segurança pelo botão abaixo ou através da central de notificações do sistema.`;

    // 1. Send Simulated Email
    const emailResult = await this.sendEmail(
      adminEmail,
      `[ViaLivre] Cópia de Segurança Concluída (${statusText})`,
      body,
      downloadLink
    );

    // 2. Send Simulated Push Notification
    const pushResult = await this.sendPush(
      adminId,
      title,
      `Cópia de segurança '${fileName}' concluída com ${statusText}. Toque para salvar e baixar os dados em JSON.`,
      downloadLink
    );

    // 3. Create a real AppNotification inside DB so that details appear on Dashboard/Alerts panel
    const systemNotifId = Math.random().toString(36).substring(2, 11);
    try {
      await db.create<AppNotification>('notifications', {
        id: systemNotifId,
        system_id: systemId,
        user_id: adminId,
        title,
        message: `O backup semanal automático de dados do sistema foi realizado com sucesso. Arquivo: ${fileName}. Status: OK. Você pode baixar os dados exportados utilizando o botão de download no link anexado a esta notificação.`,
        type: 'SUCCESS',
        category: 'SYSTEM',
        target_role: 'ADMIN',
        is_read: false,
        created_at: new Date().toISOString(),
        metadata: {
          download_url: downloadLink,
          file_name: fileName,
          sender_service: 'MockNotificationService',
          notification_channels: ['EMAIL', 'PUSH'],
          backup_status: 'SUCCESS'
        }
      });
    } catch (e) {
      console.error('Failed to register system AppNotification for backup', e);
    }

    return {
      email: emailResult,
      push: pushResult,
      systemNotifId
    };
  }

  private static saveToHistory(record: MockNotificationRecord) {
    try {
      const historyStr = localStorage.getItem('vialivre_mock_notification_log') || '[]';
      const history = JSON.parse(historyStr);
      history.unshift(record);
      localStorage.setItem('vialivre_mock_notification_log', JSON.stringify(history.slice(0, 100)));
    } catch (e) {
      console.warn('Erro ao salvar histórico de notificações simuladas:', e);
    }
  }

  static getHistory(): MockNotificationRecord[] {
    try {
      const historyStr = localStorage.getItem('vialivre_mock_notification_log') || '[]';
      return JSON.parse(historyStr);
    } catch (e) {
      return [];
    }
  }
}
