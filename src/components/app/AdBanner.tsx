// src/components/app/AdBanner.tsx
"use client";

import { AdsterraBanner } from './AdsterraBanner';

interface AdBannerProps {
  slotId?: string;
  className?: string;
  adKey?: string;
  width?: number;
  height?: number;
}

export function AdBanner({ className, adKey, width, height }: AdBannerProps) {
  return (
    <AdsterraBanner 
      className={className} 
      adKey={adKey || "ae44c2176e7221d7c525f888176ff295"} 
      width={width || 728} 
      height={height || 90} 
    />
  );
}

