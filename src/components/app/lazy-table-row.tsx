"use client";

import { useEffect, useRef, useState } from 'react';
import { TableRow } from '@/components/ui/table';

interface LazyTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
  placeholderHeight?: string;
  colSpan?: number;
  'data-state'?: string;
}

/**
 * LazyTableRow
 * 
 * Performance utility component that virtualizes table rows using IntersectionObserver.
 * Only renders the heavy cellular DOM children when the row is close to entering the viewport.
 * If the row is out of view, renders a lightweight empty skeleton row matching the exact height
 * to prevent page reflows/layout shifts.
 */
export function LazyTableRow({
  children,
  placeholderHeight = '65px', // Matches standard dashboard row height with padding
  colSpan = 10,
  ...props
}: LazyTableRowProps) {
  const ref = useRef<HTMLTableRowElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only run IntersectionObserver on the client side
    if (typeof window === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '200px 0px', // Speculatively pre-render when row is within 200px vertical range
      }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  if (!isVisible) {
    return (
      <TableRow
        ref={ref}
        style={{ height: placeholderHeight }}
        className={props.className}
        data-state={props['data-state']}
      >
        <td colSpan={colSpan} style={{ height: placeholderHeight }} className="p-0">
          <div className="w-full h-full bg-muted/10 animate-pulse" style={{ height: placeholderHeight }} />
        </td>
      </TableRow>
    );
  }

  return (
    <TableRow ref={ref} {...props}>
      {children}
    </TableRow>
  );
}
