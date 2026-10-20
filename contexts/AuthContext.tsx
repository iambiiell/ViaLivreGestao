// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, db } from '../services/database';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (sessionUser) => {
    if (!sessionUser) {
      setCurrentUser(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      // 1. Busca os dados atualizados direto do Supabase
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .or(`id.eq.${sessionUser.id},email.eq.${sessionUser.email}`)
        .maybeSingle();

      if (error) throw error;

      const userFull = {
        ...sessionUser,
        ...profile,
        role: profile?.role || profile?.cargo || 'Colaborador'
      };

      // Identificação do Administrador Raiz: busca o system_id associado ao administrador raiz na tabela users
      const rootSystemId = await db.fetchRootAdminSystemId(userFull);
      userFull.system_id = rootSystemId;
      db.setSystemId(rootSystemId);

      setCurrentUser(userFull);
      setUserRole(userFull.role);

      // Salva no localStorage e contexto global para sincronização entre dispositivos
      localStorage.setItem('vialivre_system_id', rootSystemId);
      localStorage.setItem('@vialivre_user', JSON.stringify(userFull));
      localStorage.setItem('fluxo_session_user', JSON.stringify(userFull));
    } catch (err: any) {
      console.warn('Erro ao carregar do Supabase. Lendo cache local:', err?.message || err);
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
    // Busca a sessão ao abrir a página em qualquer aparelho
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserData(session?.user ?? null);
    });

    // Detecta logins/logouts automáticos
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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