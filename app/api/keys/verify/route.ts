import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const keyInfo = await validateApiKey(request);

  if (!keyInfo) {
    return NextResponse.json(
      { valid: false, error: 'Invalid or expired API key' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    valid: true,
    key_info: {
      prefix: keyInfo.key_prefix,
      name: keyInfo.name,
      tier: keyInfo.tier,
      permissions: keyInfo.permissions,
      created_at: keyInfo.created_at,
      expires_at: keyInfo.expires_at,
    },
    rate_limits: {
      free: { requests_per_hour: 100 },
      pro: { requests_per_hour: 5000 },
      enterprise: { requests_per_hour: 50000 },
    }[keyInfo.tier] || { requests_per_hour: 100 }
  });
}
