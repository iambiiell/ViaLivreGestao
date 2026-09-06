/**
 * Serviço de Notificações Locais e no Dispositivo (Push/Desktop/Web Notification)
 */

export class NotificationService {
  private static defaultIcon = 'https://kkvmtqthahbcobsqmugl.supabase.co/storage/v1/object/public/assets/Logo_ViaLivre.png';

  /**
   * Solicita permissão do usuário para envio de notificações no dispositivo
   */
  static async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[NotificationService] Este navegador não suporta notificações de sistema/desktop.');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (err) {
        console.warn('[NotificationService] Erro ao solicitar permissão de notificação:', err);
        return false;
      }
    }

    return false;
  }

  /**
   * Dispara uma notificação nativa no dispositivo do usuário
   */
  static async sendLocalNotification(title: string, options?: NotificationOptions): Promise<Notification | null> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return null;
    }

    // Tentar obter permissão se ainda não foi concedida ou negada
    if (Notification.permission === 'default') {
      await this.requestPermission();
    }

    if (Notification.permission !== 'granted') {
      return null;
    }

    const finalOptions: NotificationOptions = {
      icon: this.defaultIcon,
      badge: this.defaultIcon,
      requireInteraction: false,
      silent: false,
      ...options
    };

    // Feedback tátil em dispositivos móveis compatíveis
    try {
      if ('navigator' in window && 'vibrate' in navigator) {
        navigator.vibrate([120, 60, 120]);
      }
    } catch {
      // Ignora erro se vibração não for permitida
    }

    // 1. Tenta disparar via Service Worker se registrado
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.showNotification) {
          await registration.showNotification(title, finalOptions);
          return null;
        }
      } catch (swErr) {
        console.warn('[NotificationService] Fallback de SW para Notification padrão:', swErr);
      }
    }

    // 2. Disparo padrão via Web Notification API
    try {
      const notif = new Notification(title, finalOptions);
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      return notif;
    } catch (e) {
      console.warn('[NotificationService] Falha ao instanciar Notification:', e);
      return null;
    }
  }
}
