// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/database';

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

      setCurrentUser(userFull);
      setUserRole(userFull.role);

      // Salva no localStorage apenas como backup offline
      localStorage.setItem('@vialivre_user', JSON.stringify(userFull));
    } catch (err) {
      console.warn('Erro ao carregar do Supabase. Lendo cache local:', err.message);
      const cached = localStorage.getItem('@vialivre_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        setCurrentUser(parsed);
        setUserRole(parsed.role);
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