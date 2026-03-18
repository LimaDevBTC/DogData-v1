import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status: any = {
    service: "DOG DATA",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  };

  // Scanner state
  try {
    const scannerPath = path.join(process.cwd(), 'data', 'scanner_state.json');
    if (fs.existsSync(scannerPath)) {
      const state = JSON.parse(fs.readFileSync(scannerPath, 'utf-8'));
      status.scanner = {
        last_block: state.last_block || state.block_height,
        last_scan: state.timestamp || state.last_updated,
        status: 'running'
      };
    }
  } catch {}

  // Data freshness
  const dataFiles = [
    { name: 'holders', file: 'dog_holders_by_address.json' },
    { name: 'forensic', file: 'forensic_behavioral_analysis.json' },
    { name: 'airdrop', file: 'airdrop_analytics.json' },
    { name: 'utxo', file: 'dog_utxo_set.json' },
  ];

  status.data = {};
  for (const { name, file } of dataFiles) {
    try {
      const filePath = path.join(process.cwd(), 'data', file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeBytes = stats.size;
        const lastModified = stats.mtime.toISOString();
        const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
        status.data[name] = {
          available: true,
          size_mb: (sizeBytes / (1024 * 1024)).toFixed(1),
          last_modified: lastModified,
          age_hours: parseFloat(ageHours.toFixed(1))
        };
      } else {
        status.data[name] = { available: false };
      }
    } catch {
      status.data[name] = { available: false };
    }
  }

  // Quick holder count from data
  try {
    const holdersPath = path.join(process.cwd(), 'data', 'dog_holders_by_address.json');
    if (fs.existsSync(holdersPath)) {
      const raw = fs.readFileSync(holdersPath, 'utf-8');
      const data = JSON.parse(raw);
      status.stats = {
        total_holders: data.total_holders,
        total_utxos: data.total_utxos,
        data_timestamp: data.timestamp
      };
    }
  } catch {}

  // API endpoints available
  status.endpoints = {
    total: 29,
    categories: ['holders', 'transactions', 'price', 'metrics', 'forensic', 'airdrop', 'bitcoin', 'markets', 'events']
  };

  return NextResponse.json(status, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
