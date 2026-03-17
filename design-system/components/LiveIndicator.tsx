'use client';

import React from 'react';

interface LiveIndicatorProps {
  status?: 'live' | 'updating' | 'stale';
  lastUpdate?: string;
}

const statusConfig = {
  live: {
    dotClass: 'bg-accent-positive',
    animated: true,
    label: 'LIVE',
  },
  updating: {
    dotClass: 'bg-accent-primary',
    animated: true,
    label: 'UPDATING',
  },
  stale: {
    dotClass: 'bg-accent-primary',
    animated: false,
    label: 'STALE',
  },
};

export default function LiveIndicator({
  status = 'live',
  lastUpdate,
}: LiveIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className="inline-flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        {config.animated && (
          <span
            className={`absolute inline-flex h-full w-full animate-pulse-dot rounded-full opacity-75 ${config.dotClass}`}
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${config.dotClass}`}
        />
      </span>
      <span className="font-sans text-xs uppercase tracking-widest text-text-primary">
        {config.label}
      </span>
      {lastUpdate && (
        <span className="text-xs text-text-tertiary">{lastUpdate}</span>
      )}
    </div>
  );
}
