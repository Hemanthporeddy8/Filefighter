
// src/contexts/auth-context.tsx
"use client";

import type React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { signIn, signUp, type User } from '@/lib/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password?: string, isSignUp?: boolean) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'editroy_auth_status';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [user, setUser] = useState<User | null>({ id: 'guest-1', email: 'guest@editroy.com', role: 'user' });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Auth is always active and bypassed
    setIsAuthenticated(true);
    setUser({ id: 'guest-1', email: 'guest@editroy.com', role: 'user' });
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password?: string, isSignUp?: boolean) => {
    // Directly succeed and redirect
    router.push('/dashboard');
  }, [router]);

  const logout = useCallback(() => {
    // Redirect to dashboard instead of login
    router.push('/dashboard');
  }, [router]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
