// src/contexts/integration-context.tsx
"use client";

import type React from 'react';
import { createContext, useContext, useState } from 'react';

interface IntegrationContextType {
  isWhatsAppEnabled: boolean;
  setIsWhatsAppEnabled: (enabled: boolean) => void;
  isGmailEnabled: boolean;
  setIsGmailEnabled: (enabled: boolean) => void;
}

const IntegrationContext = createContext<IntegrationContextType | undefined>(undefined);

export function IntegrationProvider({ children }: { children: React.ReactNode }) {
  const [isWhatsAppEnabled, setIsWhatsAppEnabled] = useState(false);
  const [isGmailEnabled, setIsGmailEnabled] = useState(false);

  const value = {
    isWhatsAppEnabled,
    setIsWhatsAppEnabled,
    isGmailEnabled,
    setIsGmailEnabled,
  };

  return (
    <IntegrationContext.Provider value={value}>
      {children}
    </IntegrationContext.Provider>
  );
}

export function useIntegration() {
  const context = useContext(IntegrationContext);
  if (context === undefined) {
    throw new Error('useIntegration must be used within an IntegrationProvider');
  }
  return context;
}
