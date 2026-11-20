import React, { createContext, useContext, useState, useEffect } from 'react';
import { postgresClient, db } from '../services/database';

const AuthContext = createContext({});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (sessionUser: any) => {
    if (!sessionUser) {
      setCurrentUser(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      const profile = await db.getUserProfile(sessionUser.id || sessionUser.email);

      const userFull = {
        ...sessionUser,
        ...(profile || {}),
        role: profile?.role || (profile as any)?.cargo || sessionUser.role || 'Colaborador'
      };

      const rootSystemId = await db.fetchRootAdminSystemId(userFull);
      userFull.system_id = rootSystemId;
      db.setSystemId(rootSystemId);

      setCurrentUser(userFull);
      setUserRole(userFull.role);

      localStorage.setItem('vialivre_system_id', rootSystemId);
      localStorage.setItem('@vialivre_user', JSON.stringify(userFull));
      localStorage.setItem('fluxo_session_user', JSON.stringify(userFull));
    } catch (err: any) {
      console.warn('Erro ao carregar usuário do PostgreSQL. Lendo cache local:', err?.message || err);
      const cached = localStorage.getItem('@vialivre_user') || localStorage.getItem('fluxo_session_user');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const rootSystemId = parsed.system_id || localStorage.getItem('vialivre_system_id') || '44d472ca-9311-45e1-9297-c442e016e1a6';
          parsed.system_id = rootSystemId;
          db.setSystemId(rootSystemId);
          setCurrentUser(parsed);
          setUserRole(parsed.role);
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    postgresClient.auth.getSession().then(({ data: { session } }) => {
      fetchUserData(session?.user ?? null);
    });

    const { data: { subscription } } = postgresClient.auth.onAuthStateChange((_event, session) => {
      fetchUserData(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, loading, refetchUser: () => fetchUserData(currentUser) }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);