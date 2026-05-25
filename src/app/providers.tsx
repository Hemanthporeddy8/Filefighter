"use client";

import { AuthProvider } from '@/contexts/auth-context';
import { DocumentProvider } from '@/contexts/document-context';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/app/theme-provider";
import { useEffect } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // LAZY: Only load custom dictionaries during browser idle time,
    // not on first paint. Prevents blocking the initial render.
    const load = () => {
      import('@/lib/custom-dictionary-store').then(({ loadAllCustomDictionariesIntoEngine }) => {
        loadAllCustomDictionariesIntoEngine();
      });
    };

    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(load, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    } else {
      // Safari fallback
      const t = setTimeout(load, 2000);
      return () => clearTimeout(t);
    }
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
