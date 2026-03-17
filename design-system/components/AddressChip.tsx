'use client';

import React, { useState, useCallback } from 'react';

interface AddressChipProps {
  address: string;
  truncate?: 'head' | 'mid' | 'tail';
  copyable?: boolean;
  link?: string;
}

function truncateAddress(address: string, mode: 'head' | 'mid' | 'tail'): string {
  if (address.length <= 12) return address;

  switch (mode) {
    case 'mid':
      return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
    case 'head':
      return `\u2026${address.slice(-8)}`;
    case 'tail':
      return `${address.slice(0, 8)}\u2026`;
  }
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

export default function AddressChip({
  address,
  truncate = 'mid',
  copyable = false,
  link,
}: AddressChipProps) {
  const [copied, setCopied] = useState(false);

  const displayAddress = truncateAddress(address, truncate);

  const handleCopy = useCallback(async () => {
    if (!copyable) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [address, copyable]);

  const chipClasses =
    'inline-flex items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 py-1 font-mono text-sm text-text-primary transition-all duration-150 hover:border-border-focus hover:shadow-[0_0_8px_rgba(247,147,26,0.15)]';

  const content = (
    <>
      <span title={address}>{displayAddress}</span>
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center text-text-tertiary transition-colors hover:text-text-accent"
          aria-label="Copy address"
        >
          {copied ? (
            <span className="flex items-center gap-1 text-accent-positive">
              <CheckIcon />
              <span className="text-xs">Copied!</span>
            </span>
          ) : (
            <CopyIcon />
          )}
        </button>
      )}
    </>
  );

  if (link) {
    return (
      <a
        href={link}
        className={chipClasses}
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    );
  }

  return (
    <span className={chipClasses} role={copyable ? 'button' : undefined} onClick={copyable ? handleCopy : undefined}>
      {content}
    </span>
  );
}
