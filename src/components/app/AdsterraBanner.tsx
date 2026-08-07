// src/components/app/AdsterraBanner.tsx
"use client";

import { useEffect, useRef } from 'react';

interface AdsterraBannerProps {
  className?: string;
  adKey?: string;
  width?: number;
  height?: number;
}

export function AdsterraBanner({
  className = "",
  adKey = "ae44c2176e7221d7c525f888176ff295",
  width = 728,
  height = 90,
}: AdsterraBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous contents to prevent duplicates on re-render
    container.innerHTML = "";

    // Create an isolated iframe so atOptions global scope does not conflict
    const iframe = document.createElement("iframe");
    iframe.width = `${width}`;
    iframe.height = `${height}`;
    iframe.style.border = "none";
    iframe.style.overflow = "hidden";
    iframe.scrolling = "no";
    iframe.setAttribute("title", "Advertisement");

    container.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; overflow: hidden; }
            </style>
          </head>
          <body>
            <script type="text/javascript">
              atOptions = {
                'key' : '${adKey}',
                'format' : 'iframe',
                'height' : ${height},
                'width' : ${width},
                'params' : {}
              };
            </script>
            <script type="text/javascript" src="https://www.highperformanceformat.com/${adKey}/invoke.js"></script>
          </body>
        </html>
      `);
      iframeDoc.close();
    }
  }, [adKey, width, height]);

  return (
    <div className={`w-full overflow-hidden flex flex-col items-center justify-center my-4 ${className}`}>
      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold mb-1 opacity-70">
        Sponsored Advertisement
      </span>
      <div 
        ref={containerRef} 
        className="flex justify-center items-center overflow-hidden max-w-full" 
        style={{ minHeight: `${height}px` }} 
      />
    </div>
  );
}
