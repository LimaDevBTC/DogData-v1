'use client';

import { useState } from 'react';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  timeframes?: string[];
  activeTimeframe?: string;
  onTimeframeChange?: (tf: string) => void;
  loading?: boolean;
  children: React.ReactNode;
  accentColor?: 'bitcoin' | 'data';
}

export default function ChartContainer({
  title,
  subtitle,
  timeframes = ['1H', '1D', '7D', '30D', 'ALL'],
  activeTimeframe,
  onTimeframeChange,
  loading = false,
  children,
  accentColor = 'bitcoin',
}: ChartContainerProps) {
  const [internalActive, setInternalActive] = useState(timeframes[0]);
  const currentTf = activeTimeframe ?? internalActive;

  const handleTimeframeClick = (tf: string) => {
    if (onTimeframeChange) {
      onTimeframeChange(tf);
    } else {
      setInternalActive(tf);
    }
  };

  const borderColor = accentColor === 'bitcoin' ? 'bg-accent-primary' : 'bg-accent-data-dim';

  return (
    <div className="relative rounded-lg bg-bg-surface overflow-hidden">
      {/* Top accent border */}
      <div className={`h-px w-full ${borderColor}`} />

      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4">
        <div>
          <h3 className="font-sans text-lg font-semibold text-text-primary">{title}</h3>
          {subtitle && (
            <p className="font-sans text-sm text-text-secondary mt-0.5">{subtitle}</p>
          )}
        </div>

        {timeframes.length > 0 && (
          <div className="flex items-center gap-1">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => handleTimeframeClick(tf)}
                className={`rounded-md px-3 py-1 text-xs font-sans transition-all ${
                  currentTf === tf
                    ? 'bg-accent-primary-dim text-text-accent'
                    : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="px-5 pb-5 min-h-[256px]">
        {loading ? (
          <div className="h-64 w-full rounded bg-bg-elevated animate-shimmer" />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
