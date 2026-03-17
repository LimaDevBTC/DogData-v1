'use client';

import { useState } from 'react';

interface HeatmapCellProps {
  value: number;
  max: number;
  label?: string;
  date?: string;
}

function interpolateColor(ratio: number): string {
  // bg-bg-void (#000000) -> accent-data (#E8820E deep orange) -> accent-primary (#F7931A bright orange)
  const colors = [
    { r: 0, g: 0, b: 0 },       // void / 0
    { r: 160, g: 80, b: 0 },    // deep burnt orange / mid
    { r: 247, g: 147, b: 26 },  // primary orange / max
  ];

  const clamped = Math.max(0, Math.min(1, ratio));

  let from: typeof colors[0];
  let to: typeof colors[0];
  let t: number;

  if (clamped <= 0.5) {
    from = colors[0];
    to = colors[1];
    t = clamped * 2;
  } else {
    from = colors[1];
    to = colors[2];
    t = (clamped - 0.5) * 2;
  }

  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);

  return `rgb(${r}, ${g}, ${b})`;
}

export default function HeatmapCell({ value, max, label, date }: HeatmapCellProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const ratio = max > 0 ? value / max : 0;
  const bgColor = interpolateColor(ratio);

  return (
    <div
      className="relative w-4 h-4 rounded-sm cursor-default"
      style={{ backgroundColor: bgColor }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={`${date ? date + ': ' : ''}${label ? label + ' ' : ''}${value}`}
    >
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none">
          <div className="bg-bg-overlay rounded px-2 py-1 text-xs font-mono text-text-primary whitespace-nowrap shadow-md border border-border-subtle">
            {date && <span className="text-text-secondary">{date}: </span>}
            {label && <span className="text-text-secondary">{label} </span>}
            <span className="text-text-accent">{value}</span>
          </div>
        </div>
      )}
    </div>
  );
}
