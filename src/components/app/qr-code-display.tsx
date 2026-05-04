// src/components/app/qr-code-display.tsx
"use client";

import { QRCodeCanvas } from 'qrcode.react';
import { cn } from '@/lib/utils';

interface QrCodeDisplayProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  bgColor?: string;
  fgColor?: string;
  className?: string;
  id?: string;
}

export function QrCodeDisplay({
  value,
  size = 150,
  level = 'M',
  bgColor = '#FFFFFF',
  fgColor = '#000000',
  className,
  id,
}: QrCodeDisplayProps) {
  if (!value) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn(
          "bg-muted/50 rounded-md animate-pulse flex items-center justify-center",
          className
        )}
        aria-label="Loading QR Code"
      >
        <svg className="w-1/3 h-1/3 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75h.008v.008h-.008V6.75zM17.25 17.25h.008v.008h-.008v-.008zM4.5 17.25h.008v.008H4.5v-.008zM6.75 6.75h.008v.008h-.008V6.75zM6.75 17.25h.008v.008h-.008V17.25zM9 6.75h.008v.008H9V6.75zM9 17.25h.008v.008H9v-.008zM11.25 6.75h.008v.008h-.008V6.75zM11.25 17.25h.008v.008h-.008V17.25zM13.5 17.25h.008v.008h-.008v-.008zM15.75 6.75h.008v.008h-.008V6.75z" />
        </svg>
      </div>
    );
  }

  return (
    <div id={id} className={cn("p-1 bg-white rounded-md shadow-md", className)}>
      <QRCodeCanvas
        value={value}
        size={size - 8} // Adjust size to account for padding
        bgColor={bgColor}
        fgColor={fgColor}
        level={level}
      />
    </div>
  );
}
