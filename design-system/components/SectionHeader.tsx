'use client';

import React from 'react';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-2">
            <span className="font-sans text-xs uppercase tracking-widest text-text-accent">
              {eyebrow}
            </span>
            <div
              className="mt-1.5 h-px w-10"
              style={{
                background: 'linear-gradient(90deg, #F7931A, #F7931A80)',
              }}
            />
          </div>
        )}
        <h2 className="font-display text-2xl font-bold text-text-primary">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 font-sans text-base text-text-secondary">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
