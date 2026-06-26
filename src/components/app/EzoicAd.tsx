// src/components/app/EzoicAd.tsx
"use client";

import { useEffect } from 'react';

interface EzoicAdProps {
  id: number;
  className?: string;
}

export function EzoicAd({ id, className }: EzoicAdProps) {
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const ez = (window as any).ezstandalone;
        if (ez) {
          ez.cmd.push(() => {
            // Check if the script has already defined showAds, then show this placement
            if (typeof ez.showAds === 'function') {
              ez.showAds(id);
            }
          });
        }
      }
    } catch (e) {
      console.warn('[Ezoic] Failed to load ad placeholder:', id, e);
    }
  }, [id]);

  return (
    <div 
      id={`ezoic-pub-ad-placeholder-${id}`} 
      className={`w-full overflow-hidden flex justify-center py-2 ${className || ''}`}
    />
  );
}
