"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface OrbitItem {
  id: string;
  label: string;
  icon: string;
  angle: number;
  color: string;
}

const ORBIT_ITEMS: OrbitItem[] = [
  { id: 'pdf', label: 'PDF', icon: '📄', angle: 0, color: '#ef4444' },
  { id: 'word', label: 'Word', icon: '📝', angle: 51.4, color: '#3b82f6' },
  { id: 'excel', label: 'Excel', icon: '📊', angle: 102.8, color: '#22c55e' },
  { id: 'ppt', label: 'PPT', icon: '📽️', angle: 154.2, color: '#f97316' },
  { id: 'image', label: 'Image', icon: '🖼️', angle: 205.6, color: '#d946ef' },
  { id: 'html', label: 'HTML', icon: '🌐', angle: 257, color: '#06b6d4' },
  { id: 'txt', label: 'TXT', icon: '📃', angle: 308.4, color: '#6b7280' },
];

interface UniversalConverterWheelProps {
  onSelectTool: (toolId: string) => void;
}

export const UniversalConverterWheel: React.FC<UniversalConverterWheelProps> = ({ onSelectTool }) => {
  const [source, setSource] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [message, setMessage] = useState({ title: 'Universal Converter', desc: 'Select source format' });
  
  // Rotation State
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef({ isDragging: false, startAngle: 0, lastAngle: 0, velocity: 0, lastTime: 0 });
  const requestRef = useRef<number>();

  const handleItemClick = (id: string) => {
    if (!source) {
      setSource(id);
      setMessage({ title: 'To Format', desc: `Convert ${id.toUpperCase()} to...` });
    } else {
      if (source === id) {
        reset();
        return;
      }

      setTarget(id);
      setMessage({ title: 'Launching...', desc: `${source.toUpperCase()} ➔ ${id.toUpperCase()}` });
      
      setTimeout(() => {
        onSelectTool(`${source}-to-${id}`);
        reset();
      }, 800);
    }
  };

  const reset = () => {
    setSource(null);
    setTarget(null);
    setMessage({ title: 'Universal Converter', desc: 'Select source format' });
  };

  const isItemEnabled = (id: string) => {
    if (!source) return true;
    return source !== id;
  };

  // --- FRISBEE ROTATION LOGIC (Global Listeners) ---
  const startDrag = (e: React.PointerEvent) => {
    if (!wheelRef.current) return;
    
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    
    dragInfo.current.isDragging = true;
    dragInfo.current.startAngle = angle - rotation;
    dragInfo.current.lastAngle = angle;
    dragInfo.current.lastTime = performance.now();
    dragInfo.current.velocity = 0;
    
    setIsDragging(true);
    setIsSpinning(false);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMove = (e: PointerEvent) => {
      if (!dragInfo.current.isDragging || !wheelRef.current) return;
      
      const rect = wheelRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      const currentTime = performance.now();
      
      const deltaAngle = angle - dragInfo.current.lastAngle;
      const deltaTime = currentTime - dragInfo.current.lastTime;
      
      if (deltaTime > 0) {
        dragInfo.current.velocity = deltaAngle / deltaTime;
      }
      
      setRotation(angle - dragInfo.current.startAngle);
      
      dragInfo.current.lastAngle = angle;
      dragInfo.current.lastTime = currentTime;
    };

    const handleGlobalUp = () => {
      dragInfo.current.isDragging = false;
      setIsDragging(false);
      
      if (Math.abs(dragInfo.current.velocity) > 0.1) {
        setIsSpinning(true);
      }
    };

    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);
    
    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
    };
  }, [isDragging]);

  const animateSpin = useCallback(() => {
    if (!dragInfo.current.isDragging && Math.abs(dragInfo.current.velocity) > 0.01) {
      setRotation(prev => prev + dragInfo.current.velocity * 16);
      dragInfo.current.velocity *= 0.96;
      requestRef.current = requestAnimationFrame(animateSpin);
    } else {
      setIsSpinning(false);
      dragInfo.current.velocity = 0;
    }
  }, []);

  useEffect(() => {
    if (isSpinning) {
      requestRef.current = requestAnimationFrame(animateSpin);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isSpinning, animateSpin]);

  return (
    <div 
      ref={wheelRef}
      className="relative w-[400px] h-[400px] mx-auto flex items-center justify-center mb-12 select-none touch-none"
      onPointerDown={startDrag}
    >
      {/* Central Display */}
      <div 
        className="z-10 text-center p-6 rounded-full bg-background/80 backdrop-blur-md border shadow-xl w-40 h-40 flex flex-col items-center justify-center transition-all duration-500"
        style={{ pointerEvents: 'auto' }}
      >
        <h2 className="text-sm font-bold text-foreground mb-1">{message.title}</h2>
        <p className="text-[10px] text-muted-foreground leading-tight">{message.desc}</p>
        
        {source && (
          <button 
            onClick={(e) => { e.stopPropagation(); reset(); }}
            className="mt-2 text-[8px] uppercase tracking-wider text-primary hover:underline font-bold z-30"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Rotating Orbit Items container */}
      <div 
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {ORBIT_ITEMS.map((item) => {
          const enabled = isItemEnabled(item.id);
          const isActive = source === item.id;
          const isTargetMatch = target === item.id;
          
          return (
            <button
              key={item.id}
              onClick={(e) => {
                if (Math.abs(dragInfo.current.velocity) < 0.2) {
                  e.stopPropagation();
                  enabled && handleItemClick(item.id);
                }
              }}
              disabled={!enabled}
              className={cn(
                "absolute w-16 h-16 bg-card rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 border-2 z-20 pointer-events-auto",
                enabled ? "opacity-100 grayscale-0 hover:border-primary/50 shadow-md hover:scale-110" : "opacity-30 grayscale cursor-not-allowed",
                isActive && "scale-125 z-30 shadow-2xl border-primary bg-primary/20",
                isTargetMatch && "scale-110 bg-primary/10 border-primary"
              )}
              style={{
                borderColor: isActive ? 'hsl(var(--primary))' : item.color,
                transform: `rotate(${item.angle}deg) translate(145px)`,
              }}
            >
              {/* Internal content counter-rotated so it stays upright */}
              <div 
                 className="flex flex-col items-center justify-center"
                 style={{ transform: `rotate(${-item.angle - rotation}deg)` }}
              >
                <span className="text-2xl transition-transform duration-300 group-hover:scale-110 pointer-events-none">{item.icon}</span>
                <span className="text-[9px] font-bold mt-1 text-card-foreground uppercase tracking-tighter pointer-events-none">{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Connection Lines (now part of the rotating set) */}
      <div 
        className="absolute border-2 border-dashed border-muted/20 rounded-full w-[290px] h-[290px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0" 
        style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
      />
    </div>
  );
};
