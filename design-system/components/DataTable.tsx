'use client';

import { useState, useCallback, useMemo } from 'react';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, any>[];
  sortable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  highlight?: number;
  emptyMessage?: string;
  loading?: boolean;
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: '#FFD700',
    2: '#C0C0C0',
    3: '#CD7F32',
  };
  const color = colors[rank];
  if (!color) return <span>{rank}</span>;
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
      style={{ backgroundColor: color, color: '#000' }}
    >
      {rank}
    </span>
  );
}

export default function DataTable({
  columns,
  data,
  sortable = false,
  pagination = false,
  pageSize = 10,
  highlight,
  emptyMessage = 'No data available',
  loading = false,
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(0);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleSort = useCallback(
    (key: string) => {
      if (!sortable) return;
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortable, sortKey],
  );

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = pagination ? Math.ceil(sortedData.length / pageSize) : 1;
  const pageData = pagination
    ? sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : sortedData;

  const handleCopyAddress = useCallback(async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 1500);
    } catch {}
  }, []);

  const alignClass = (align?: string) => {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`sticky top-0 bg-bg-base/90 backdrop-blur-xl px-4 py-3 font-sans text-xs uppercase tracking-wider text-text-tertiary border-b border-border-subtle font-medium ${alignClass(col.align)}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border-subtle">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 rounded bg-bg-elevated animate-shimmer" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`sticky top-0 bg-bg-base/90 backdrop-blur-xl px-4 py-3 font-sans text-xs uppercase tracking-wider text-text-tertiary border-b border-border-subtle font-medium ${alignClass(col.align)}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
          <svg
            className="w-10 h-10 mb-3 opacity-40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 11.625l2.25-2.25M12 11.625l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
          <p className="font-sans text-sm">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`sticky top-0 bg-bg-base/90 backdrop-blur-xl px-4 py-3 font-sans text-xs uppercase tracking-wider text-text-tertiary border-b border-border-subtle font-medium select-none ${alignClass(col.align)} ${sortable ? 'cursor-pointer hover:text-text-secondary transition-colors' : ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortable && sortKey === col.key && (
                      <svg
                        className={`w-3 h-3 transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, rowIdx) => {
              const globalIdx = pagination ? currentPage * pageSize + rowIdx : rowIdx;
              return (
                <tr
                  key={rowIdx}
                  className={`border-b border-border-subtle hover:bg-bg-elevated transition-colors ${highlight != null && globalIdx === highlight ? 'bg-bg-elevated' : ''}`}
                >
                  {columns.map((col) => {
                    const value = row[col.key];
                    let content: React.ReactNode = value;

                    if (col.key === 'rank' && typeof value === 'number' && value <= 3) {
                      content = <RankBadge rank={value} />;
                    } else if (col.key === 'address' && typeof value === 'string') {
                      content = (
                        <button
                          onClick={() => handleCopyAddress(value)}
                          className="font-mono text-text-data hover:text-text-accent transition-colors cursor-pointer"
                          title={copiedAddress === value ? 'Copied!' : 'Click to copy'}
                        >
                          {truncateAddress(value)}
                        </button>
                      );
                    }

                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-sm text-text-primary ${alignClass(col.align)} ${col.mono ? 'font-mono' : 'font-sans'}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1 text-xs font-sans text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === currentPage ? 'bg-accent-primary w-4' : 'bg-bg-elevated hover:bg-border'}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-3 py-1 text-xs font-sans text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
