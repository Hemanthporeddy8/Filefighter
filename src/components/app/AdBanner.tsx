// src/components/app/AdBanner.tsx
"use client";

import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  slotId?: string; // Optional custom slot ID
  className?: string;
}

export function AdBanner({ slotId = 'default-dashboard-banner', className }: AdBannerProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If Google AdSense is loaded globally, trigger the ad layout push
    try {
      if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        setHasLoaded(true);
      }
    } catch (e) {
      console.warn('[AdSense] Failed to push ad block:', e);
    }
  }, []);

  // Use the env variable for the Google AdSense client ID (e.g. ca-pub-XXXXXXXXXXXXXXXX)
  const adClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  if (!adClientId) {
    // Elegant theme-friendly placeholder during local testing or before approval
    return (
      <div 
        ref={adRef}
        className={`w-full flex flex-col items-center justify-center py-6 px-4 bg-muted/20 border border-dashed border-border rounded-xl text-center transition-all ${className}`}
        style={{ minHeight: '100px' }}
      >
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Sponsored Advertisement</span>
        <span className="text-xs text-muted-foreground/60 max-w-sm">
          Ad placeholder (Responsive Banner). Configure `NEXT_PUBLIC_ADSENSE_CLIENT_ID` in your environment to load real ads.
        </span>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden flex justify-center py-2 ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minWidth: '250px', maxHeight: '100px' }}
        data-ad-client={adClientId}
        data-ad-slot={slotId}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </div>
  );
}
