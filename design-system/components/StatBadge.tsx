'use client';

import React from 'react';

interface StatBadgeProps {
  label: string;
  value: string | number;
  variant?: 'default' | 'positive' | 'negative' | 'warning' | 'bitcoin';
  icon?: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  default: 'bg-bg-elevated text-text-secondary',
  positive: 'bg-accent-positive-dim text-accent-positive',
  negative: 'bg-accent-negative-dim text-accent-negative',
  warning: 'bg-yellow-500/10 text-yellow-400',
  bitcoin: 'bg-accent-primary-dim text-accent-primary',
};

export default function StatBadge({
  label,
  value,
  variant = 'default',
  icon,
}: StatBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${variantClasses[variant]}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="font-sans">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </span>
  );
}
