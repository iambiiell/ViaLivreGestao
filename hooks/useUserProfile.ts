import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../types';
import { db, postgresClient, isPostgresConfigured, isNetworkError } from '../services/database';

export interface UseUserProfileReturn {
  user: User | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  loadUserProfile: (userIdOrEmail?: string) => Promise<User | null>;
  updateUserProfile: (updatedFields: Partial<User>) => Promise<User | null>;
  refreshProfileFromCloud: () => Promise<User | null>;
}

/**
 * Hook de Perfil / Contexto de Usuário sincronizado com Aiven PostgreSQL (/api/db/users) e SSE.
 */
export function useUserProfile(initialUser: User | null = null): UseUserProfileReturn {
  const [user, setUser] = useState<User | null>(() => {
    if (initialUser) return initialUser;
    try {
      const saved = localStorage.getItem('fluxo_session_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const activeUserIdRef = useRef<string | null>(user?.id || null);

  useEffect(() => {
    if (initialUser && initialUser.id !== user?.id) {
      setUser(initialUser);
      activeUserIdRef.current = initialUser.id;
    }
  }, [initialUser]);

  const fetchDirectFromDatabase = useCallback(async (identifier?: string): Promise<User | null> => {
    if (!isPostgresConfigured) return null;

    try {
      let authEmail: string | undefined;
      let authId: string | undefined;
      try {
        const { data: authData } = await postgresClient.auth.getUser();
        if (authData?.user) {
          authEmail = authData.user.email;
          authId = authData.user.id;
        }
      } catch {}

      const targetId = identifier || authId || activeUserIdRef.current || user?.id;
      const targetEmail = authEmail || user?.email;
      const targetLogin = user?.login_acesso;

      let query = postgresClient.from('users').select('*');

      if (targetId) {
        query = query.eq('id', targetId);
      } else if (targetEmail) {
        query = query.eq('email', targetEmail);
      } else if (targetLogin) {
        query = query.eq('login_acesso', targetLogin);
      } else {
        return null;
      }

      const { data, error: dbError } = await query.maybeSingle();

      if (dbError) {
        if (!isNetworkError(dbError)) {
          console.error('[USER_PROFILE] Erro ao consultar tabela users no PostgreSQL:', dbError);
        }
        return null;
      }

      if (data) {
        const cloudUser = data as User;
        setUser(cloudUser);
        activeUserIdRef.current = cloudUser.id;
        localStorage.setItem('fluxo_session_user', JSON.stringify(cloudUser));
        return cloudUser;
      }

      return null;
    } catch (err: any) {
      console.warn('[USER_PROFILE] Falha na consulta direta da tabela users:', err?.message || err);
      return null;
    }
  }, [user?.id, user?.email, user?.login_acesso]);

  const loadUserProfile = useCallback(async (userIdOrEmail?: string): Promise<User | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const cloudUser = await fetchDirectFromDatabase(userIdOrEmail);
      if (cloudUser) return cloudUser;

      const localCached = localStorage.getItem('fluxo_session_user');
      if (localCached) {
        const parsed = JSON.parse(localCached) as User;
        setUser(parsed);
        activeUserIdRef.current = parsed.id;
        return parsed;
      }

      return null;
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar perfil');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchDirectFromDatabase]);

  const updateUserProfile = useCallback(async (updatedFields: Partial<User>): Promise<User | null> => {
    setIsSaving(true);
    setError(null);

    const currentUserData =
      user || (localStorage.getItem('fluxo_session_user') ? JSON.parse(localStorage.getItem('fluxo_session_user')!) : null);
    if (!currentUserData && !updatedFields.id) {
      setIsSaving(false);
      setError('Usuário não autenticado para atualização.');
      return null;
    }

    const mergedUser: User = {
      ...(currentUserData || {}),
      ...updatedFields,
      id: updatedFields.id || currentUserData?.id || crypto.randomUUID()
    };

    try {
      const saved = await db.update<User>('users', mergedUser);
      const finalUser = saved || mergedUser;

      setUser(finalUser);
      activeUserIdRef.current = finalUser.id;
      localStorage.setItem('fluxo_session_user', JSON.stringify(finalUser));

      window.dispatchEvent(new CustomEvent('vialivre-user-updated', { detail: finalUser }));
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      return finalUser;
    } catch (err: any) {
      console.error('[USER_PROFILE] Erro ao salvar dados do perfil no PostgreSQL:', err);
      setError(err.message || 'Erro ao sincronizar dados do perfil.');
      setUser(mergedUser);
      localStorage.setItem('fluxo_session_user', JSON.stringify(mergedUser));
      return mergedUser;
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const refreshProfileFromCloud = useCallback(async (): Promise<User | null> => {
    return await fetchDirectFromDatabase();
  }, [fetchDirectFromDatabase]);

  useEffect(() => {
    if (!user?.id || !isPostgresConfigured) return;

    const sub = db.subscribeTable('users', (payload) => {
      if (payload.eventType === 'UPDATE' && payload.new && payload.new.id === user.id) {
        const freshUser = payload.new as User;
        setUser(freshUser);
        localStorage.setItem('fluxo_session_user', JSON.stringify(freshUser));
        window.dispatchEvent(new CustomEvent('vialivre-user-updated', { detail: freshUser }));
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    if (navigator.onLine && (user?.id || user?.email)) {
      fetchDirectFromDatabase();
    }
  }, []);

  return {
    user,
    isLoading,
    isSaving,
    error,
    loadUserProfile,
    updateUserProfile,
    refreshProfileFromCloud
  };
}
