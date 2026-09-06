import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../types';
import { supabase, isSupabaseConfigured, cleanPayload, isNetworkError } from '../services/database';

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
 * Hook de Perfil / Contexto de Usuário com Sincronização Cloud-First
 * Garante que:
 * 1. Ao autenticar ou abrir o perfil, consulte diretamente a tabela 'users' no Supabase via email/ID.
 * 2. Ao salvar/editar o perfil, faça um upsert/update direto na tabela 'users' do Supabase antes do cache local.
 * 3. Os dados da nuvem sempre têm prioridade sobre o fallback do localStorage.
 * 4. Escuta atualizações Realtime do Postgres para sincronização imediata entre múltiplos dispositivos.
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

  // Consulta direta à tabela 'users' no Supabase
  const fetchDirectFromSupabase = useCallback(async (identifier?: string): Promise<User | null> => {
    if (!isSupabaseConfigured) {
      console.warn('[USER_PROFILE] Supabase não configurado. Utilizando armazenamento local.');
      return null;
    }

    try {
      // 1. Identifica se há sessão ativa no Supabase Auth
      let authEmail: string | undefined;
      let authId: string | undefined;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          authEmail = authData.user.email;
          authId = authData.user.id;
        }
      } catch (authErr) {
        // Sessão do auth pode ser nula em login customizado por login_acesso
      }

      const targetId = identifier || authId || activeUserIdRef.current || user?.id;
      const targetEmail = authEmail || user?.email;
      const targetLogin = user?.login_acesso;

      let query = supabase.from('users').select('*');

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
          console.error('[USER_PROFILE] Erro ao consultar tabela users no Supabase:', dbError);
        }
        return null;
      }

      if (data) {
        const cloudUser = data as User;
        // Atualiza estado local e cache com os dados prioritários da nuvem
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

  // Carrega perfil ao autenticar ou mudar de dispositivo
  const loadUserProfile = useCallback(async (userIdOrEmail?: string): Promise<User | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const cloudUser = await fetchDirectFromSupabase(userIdOrEmail);
      if (cloudUser) {
        return cloudUser;
      }

      // Fallback para localStorage caso offline
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
  }, [fetchDirectFromSupabase]);

  // Atualização / Upsert direto na tabela 'users' do Supabase
  const updateUserProfile = useCallback(async (updatedFields: Partial<User>): Promise<User | null> => {
    setIsSaving(true);
    setError(null);

    const currentUserData = user || (localStorage.getItem('fluxo_session_user') ? JSON.parse(localStorage.getItem('fluxo_session_user')!) : null);
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
      const cleanData = cleanPayload('users', mergedUser, true);

      // 1. Executa upsert direto na tabela 'users' do Supabase
      if (isSupabaseConfigured) {
        const { data, error: upsertError } = await supabase
          .from('users')
          .upsert(cleanData)
          .select()
          .single();

        if (upsertError) {
          if (isNetworkError(upsertError)) {
            console.warn('[USER_PROFILE] Dispositivo offline. Salvando localmente para posterior sincronização.');
          } else {
            throw upsertError;
          }
        } else if (data) {
          const syncedUser = data as User;
          setUser(syncedUser);
          activeUserIdRef.current = syncedUser.id;
          localStorage.setItem('fluxo_session_user', JSON.stringify(syncedUser));
          
          // Dispara eventos para atualizar todo o sistema e outras abas
          window.dispatchEvent(new CustomEvent('vialivre-user-updated', { detail: syncedUser }));
          window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
          return syncedUser;
        }
      }

      // Fallback / Suporte Offline
      setUser(mergedUser);
      activeUserIdRef.current = mergedUser.id;
      localStorage.setItem('fluxo_session_user', JSON.stringify(mergedUser));
      window.dispatchEvent(new CustomEvent('vialivre-user-updated', { detail: mergedUser }));
      window.dispatchEvent(new CustomEvent('vialivre-refresh-data'));
      return mergedUser;
    } catch (err: any) {
      console.error('[USER_PROFILE] Erro ao salvar dados do perfil no Supabase:', err);
      setError(err.message || 'Erro ao sincronizar dados do perfil na nuvem.');
      // Mantém integridade local
      setUser(mergedUser);
      localStorage.setItem('fluxo_session_user', JSON.stringify(mergedUser));
      return mergedUser;
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const refreshProfileFromCloud = useCallback(async (): Promise<User | null> => {
    return await fetchDirectFromSupabase();
  }, [fetchDirectFromSupabase]);

  // Escuta de mudanças Realtime no Supabase para o usuário atual
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`user_profile_sync_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user.id}` },
        (payload: any) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const freshUser = payload.new as User;
            setUser(freshUser);
            localStorage.setItem('fluxo_session_user', JSON.stringify(freshUser));
            window.dispatchEvent(new CustomEvent('vialivre-user-updated', { detail: freshUser }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Sincronização inicial ao montar se houver conexão
  useEffect(() => {
    if (navigator.onLine && (user?.id || user?.email)) {
      fetchDirectFromSupabase();
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
