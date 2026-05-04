"use client";

import { AuthProvider } from '@/contexts/auth-context';
import { DocumentProvider } from '@/contexts/document-context';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/app/theme-provider";
import { useEffect } from 'react';
import { loadAllCustomDictionariesIntoEngine } from '@/lib/custom-dictionary-store';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    loadAllCustomDictionariesIntoEngine();
  }, []);
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <DocumentProvider>
          {children}
        </DocumentProvider>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
