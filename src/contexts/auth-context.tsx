
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      const storedAuthStatus = localStorage.getItem(AUTH_STORAGE_KEY);
      if (storedAuthStatus) {
        const authData = JSON.parse(storedAuthStatus);
        if (authData.isAuthenticated) {
          setIsAuthenticated(true);
          setUser(authData.user);
        }
      }
    } catch (error) {
      console.error("Could not access localStorage:", error);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password?: string, isSignUp?: boolean) => {
    try {
      let userData: User;
      if (isSignUp && password) {
          userData = await signUp(email, password);
      } else if (password) {
          userData = await signIn(email, password);
      } else {
          throw new Error("Password required");
      }

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ isAuthenticated: true, user: userData }));
      setIsAuthenticated(true);
      setUser(userData);
      router.push('/dashboard');
    } catch (error) {
      console.error("Auth error:", error);
      throw error;
    }
  }, [router]);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.error("Could not access localStorage:", error);
    }
    setIsAuthenticated(false);
    setUser(null);
    router.push('/login'); // Redirect to login page after logout
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
