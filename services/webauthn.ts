import { User } from '../types';
import { db } from './database';

const WEBAUTHN_STORAGE_KEY = 'vialivre_biometric_credentials';
const WEBAUTHN_LAST_USER_KEY = 'vialivre_last_biometric_user';

export interface StoredBiometricCredential {
  credentialId: string;
  userId: string;
  userEmail?: string;
  userLogin?: string;
  userName: string;
  createdAt: string;
}

// Convert ArrayBuffer to Base64URL string
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Convert Base64URL string to ArrayBuffer
export function base64UrlToBuffer(base64Url: string): ArrayBuffer {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate random challenge buffer
function generateRandomChallenge(): Uint8Array {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  return challenge;
}

export const webAuthnService = {
  /**
   * Check if WebAuthn and Platform Authenticator (Biometrics: Touch ID, Face ID, Fingerprint) are available
   */
  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      return false;
    }
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return available;
      }
      return true;
    } catch (e) {
      console.warn('WebAuthn availability check failed:', e);
      return false;
    }
  },

  /**
   * Get all registered biometric credentials on this device
   */
  getStoredCredentials(): StoredBiometricCredential[] {
    try {
      const raw = localStorage.getItem(WEBAUTHN_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  },

  /**
   * Get the last biometrically logged-in user or active account
   */
  getLastBiometricUser(): StoredBiometricCredential | null {
    try {
      const raw = localStorage.getItem(WEBAUTHN_LAST_USER_KEY);
      if (!raw) {
        const list = this.getStoredCredentials();
        return list.length > 0 ? list[list.length - 1] : null;
      }
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  /**
   * Check if a specific user already has registered biometrics on this device
   */
  hasBiometricsForUser(userIdOrLogin: string): boolean {
    const list = this.getStoredCredentials();
    return list.some(
      c => c.userId === userIdOrLogin || c.userLogin === userIdOrLogin || c.userEmail === userIdOrLogin
    );
  },

  /**
   * Register biometric credential for a user (Face ID / Fingerprint)
   */
  async registerBiometrics(user: User): Promise<{ success: boolean; message: string }> {
    try {
      const isSupported = await this.isAvailable();
      if (!isSupported) {
        return { 
          success: false, 
          message: 'Autenticação biométrica não suportada neste dispositivo/navegador.' 
        };
      }

      const challenge = generateRandomChallenge();
      const userIdBuffer = new TextEncoder().encode(user.id || user.login_acesso || 'vialivre_user');

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'ViaLivre Gestão de Frotas',
          id: window.location.hostname || 'localhost',
        },
        user: {
          id: userIdBuffer,
          name: user.login_acesso || user.email || user.name || 'usuario',
          displayName: user.full_name || user.name || 'Usuário ViaLivre',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Built-in biometrics (Face ID, Touch ID, Android Biometrics)
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      };

      const credential = (await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      })) as PublicKeyCredential | null;

      if (!credential) {
        return { success: false, message: 'Falha ao registrar biometria.' };
      }

      const credentialId = bufferToBase64Url(credential.rawId);
      const storedItem: StoredBiometricCredential = {
        credentialId,
        userId: user.id,
        userEmail: user.email,
        userLogin: user.login_acesso,
        userName: user.full_name || user.name || 'Usuário',
        createdAt: new Date().toISOString(),
      };

      const existing = this.getStoredCredentials().filter(c => c.userId !== user.id);
      existing.push(storedItem);

      localStorage.setItem(WEBAUTHN_STORAGE_KEY, JSON.stringify(existing));
      localStorage.setItem(WEBAUTHN_LAST_USER_KEY, JSON.stringify(storedItem));

      return {
        success: true,
        message: 'Biometria cadastrada com sucesso para este dispositivo!',
      };
    } catch (error: any) {
      console.error('Erro ao registrar WebAuthn:', error);
      if (error.name === 'NotAllowedError') {
        return { success: false, message: 'Registro biométrico cancelado ou não autorizado pelo usuário.' };
      }
      return { success: false, message: error.message || 'Erro ao comunicar com o leitor biométrico.' };
    }
  },

  /**
   * Authenticate with Biometrics (Touch ID / Face ID / Fingerprint)
   */
  async authenticateWithBiometrics(): Promise<{ success: boolean; user?: User; message: string }> {
    try {
      const isSupported = await this.isAvailable();
      if (!isSupported) {
        return { 
          success: false, 
          message: 'Biometria não disponível neste dispositivo.' 
        };
      }

      const storedList = this.getStoredCredentials();
      if (storedList.length === 0) {
        return { 
          success: false, 
          message: 'Nenhuma credencial biométrica cadastrada neste dispositivo. Faça login com senha primeiro para ativar.' 
        };
      }

      const challenge = generateRandomChallenge();
      const allowCredentials: PublicKeyCredentialDescriptor[] = storedList.map(c => ({
        id: base64UrlToBuffer(c.credentialId),
        type: 'public-key',
        transports: ['internal'],
      }));

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname || 'localhost',
      };

      const assertion = (await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      })) as PublicKeyCredential | null;

      if (!assertion) {
        return { success: false, message: 'Autenticação biométrica cancelada.' };
      }

      const assertionId = bufferToBase64Url(assertion.rawId);
      const matchedCredential = storedList.find(c => c.credentialId === assertionId) || storedList[0];

      if (!matchedCredential) {
        return { success: false, message: 'Credencial biométrica não reconhecida.' };
      }

      // Fetch user profile from database
      const users = await db.getAllUsers();
      const userProfile = users.find(u => 
        u.id === matchedCredential.userId || 
        u.login_acesso === matchedCredential.userLogin || 
        (matchedCredential.userEmail && u.email === matchedCredential.userEmail)
      );

      if (!userProfile) {
        return { 
          success: false, 
          message: 'Perfil de usuário associado à biometria não encontrado no sistema.' 
        };
      }

      // Update last used biometric
      localStorage.setItem(WEBAUTHN_LAST_USER_KEY, JSON.stringify(matchedCredential));

      const masterEmails = ['consorcio.imperial.ltda@gmail.com', 'suporte@vialivre.com.br'];
      const isMaster = masterEmails.includes(userProfile.email) || userProfile.login_acesso === 'master';
      
      const fullUser: User = {
        ...userProfile,
        is_full_admin: isMaster || userProfile.is_full_admin || userProfile.activation_key?.includes('VITALICIO') || false
      };

      return {
        success: true,
        user: fullUser,
        message: `Autenticado com sucesso via biometria como ${fullUser.full_name || fullUser.name}!`,
      };
    } catch (error: any) {
      console.error('Erro na autenticação biométrica WebAuthn:', error);
      if (error.name === 'NotAllowedError') {
        return { success: false, message: 'Leitura biométrica cancelada ou não reconhecida.' };
      }
      return { success: false, message: error.message || 'Falha na validação biométrica.' };
    }
  },

  /**
   * Remove biometric credentials
   */
  clearBiometrics(): void {
    localStorage.removeItem(WEBAUTHN_STORAGE_KEY);
    localStorage.removeItem(WEBAUTHN_LAST_USER_KEY);
  }
};
