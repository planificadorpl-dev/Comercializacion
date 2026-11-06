'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  content?: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'auto';
  align?: 'center' | 'left' | 'right';
  className?: string;
  delay?: number;
}

export function Tooltip({
  content,
  children,
  side = 'auto',
  align = 'center',
  className,
  delay = 50,
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; effectiveSide: 'top' | 'bottom' } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    // Auto-detect if there's enough space above (requires ~55px)
    let effectiveSide: 'top' | 'bottom' = 'top';
    if (side === 'auto') {
      effectiveSide = rect.top < 60 ? 'bottom' : 'top';
    } else {
      effectiveSide = side;
    }

    const y = effectiveSide === 'top' ? rect.top - 6 : rect.bottom + 6;

    let x = rect.left + rect.width / 2;
    if (align === 'right') {
      x = rect.right;
    } else if (align === 'left') {
      x = rect.left;
    }

    // Viewport horizontal bounds clamping
    const padding = 16;
    if (typeof window !== 'undefined') {
      x = Math.max(padding, Math.min(window.innerWidth - padding, x));
    }

    setPos({ x, y, effectiveSide });
  }, [side, align]);

  const show = () => {
    if (!content) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, delay);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsOpen(false);
  };

  // Close or reposition on scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => {
      updatePosition();
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex items-center cursor-help"
      >
        {children}
      </span>

      {mounted && isOpen && pos && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            transform:
              pos.effectiveSide === 'top'
                ? align === 'right'
                  ? 'translate(-100%, -100%)'
                  : align === 'left'
                  ? 'translate(0, -100%)'
                  : 'translate(-50%, -100%)'
                : align === 'right'
                ? 'translate(-100%, 0)'
                : align === 'left'
                ? 'translate(0, 0)'
                : 'translate(-50%, 0)',
          }}
          className={cn(
            'pointer-events-none z-[999999] select-none whitespace-nowrap',
            'bg-neutral-900/95 text-neutral-100 text-[11px] font-sans font-normal leading-tight tracking-normal',
            'px-2.5 py-1.5 rounded-md border border-neutral-800',
            'shadow-[0_4px_16px_rgba(0,0,0,0.25)] backdrop-blur-xs',
            'animate-in fade-in zoom-in-95 duration-100',
            className
          )}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
}

// Compatibility wrappers for existing code
export function TooltipProvider({
  children,
  ...props
}: {
  children: React.ReactNode;
  [key: string]: any;
}) {
  return <>{children}</>;
}

export function TooltipTrigger({
  children,
  asChild,
  ...props
}: {
  children: React.ReactNode;
  asChild?: boolean;
  [key: string]: any;
}) {
  return <span {...props}>{children}</span>;
}

export function TooltipContent({
  children,
  className,
  side,
  align,
  hidden,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  side?: string;
  align?: string;
  hidden?: boolean;
  [key: string]: any;
}) {
  if (hidden) return null;
  return <div className={className} {...props}>{children}</div>;
}
