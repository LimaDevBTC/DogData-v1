'use client';

import React from 'react';
import { useCountUp } from '../hooks/useCountUp';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeDirection?: 'up' | 'down';
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  loading?: boolean;
}

const sizeClasses: Record<string, string> = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
  hero: 'text-hero',
};

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded bg-bg-elevated ${className ?? ''}`}
      style={{
        backgroundImage:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
      }}
    />
  );
}

function CountUpValue({
  value,
  size,
}: {
  value: number;
  size: string;
}) {
  const decimals = Number.isInteger(value) ? 0 : 2;
  const { ref, value: displayValue } = useCountUp<HTMLSpanElement>({
    end: value,
    duration: 1200,
    decimals,
  });

  return (
    <span ref={ref as React.RefObject<HTMLSpanElement>} className={`font-mono font-bold ${sizeClasses[size]} text-text-primary`}>
      {displayValue}
    </span>
  );
}

export default function MetricCard({
  label,
  value,
  change,
  changeDirection,
  icon,
  size = 'md',
  loading = false,
}: MetricCardProps) {
  const isHero = size === 'hero';
  const isNumber = typeof value === 'number';

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-bg-surface p-5">
        <ShimmerSkeleton className="mb-3 h-4 w-24" />
        <ShimmerSkeleton className="mb-2 h-8 w-32" />
        <ShimmerSkeleton className="h-4 w-16" />
      </div>
    );
  }

  return (
    <div
      className={`group relative rounded-lg border border-border bg-bg-surface p-5 transition-all duration-200 hover:shadow-bitcoin hover:-translate-y-0.5 ${
        isHero ? 'flex flex-col items-center justify-center text-center' : ''
      }`}
    >
      {/* Hero glow */}
      {isHero && (
        <div
          className="pointer-events-none absolute inset-0 rounded-lg opacity-30"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(247,147,26,0.15) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Header: icon + label */}
      <div className={`mb-2 flex items-center gap-2 ${isHero ? 'justify-center' : ''}`}>
        {icon && <span className="text-text-tertiary">{icon}</span>}
        <span className="font-sans text-sm text-text-secondary">{label}</span>
      </div>

      {/* Value */}
      <div className={`relative ${isHero ? 'my-3' : ''}`}>
        {isNumber ? (
          <CountUpValue value={value} size={size} />
        ) : (
          <span className={`font-mono font-bold ${sizeClasses[size]} text-text-primary`}>
            {value}
          </span>
        )}
      </div>

      {/* Change badge */}
      {change !== undefined && changeDirection && (
        <div className="mt-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono ${
              changeDirection === 'up'
                ? 'bg-accent-positive-dim text-accent-positive'
                : 'bg-accent-negative-dim text-accent-negative'
            }`}
          >
            <span>{changeDirection === 'up' ? '\u2191' : '\u2193'}</span>
            <span>{Math.abs(change).toFixed(2)}%</span>
          </span>
        </div>
      )}
    </div>
  );
}
