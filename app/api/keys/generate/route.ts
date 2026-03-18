import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function generateApiKey(type: 'live' | 'test' = 'live'): string {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return `dog_${type}_${randomBytes}`;
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'name and email are required', status: 400 } },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid email format', status: 400 } },
        { status: 400 }
      );
    }

    // Check if email already has max keys (limit: 5 per email)
    const { count } = await supabase
      .from('api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('owner_email', email)
      .eq('is_active', true);

    if ((count || 0) >= 5) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Maximum 5 active API keys per email', status: 403 } },
        { status: 403 }
      );
    }

    // Generate key
    const apiKey = generateApiKey('live');
    const keyHash = sha256(apiKey);
    const keyPrefix = apiKey.slice(0, 12); // "dog_live_xxx"

    // Store in Supabase
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name,
        owner_email: email,
        tier: 'free',
        permissions: ['read'],
        is_active: true,
        metadata: { created_via: 'api' }
      })
      .select('id, key_prefix, name, tier, permissions, created_at')
      .single();

    if (error) {
      console.error('Failed to create API key:', error);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to create API key', status: 500 } },
        { status: 500 }
      );
    }

    // Return the key (ONLY shown once!)
    return NextResponse.json({
      message: 'API key created successfully. Save this key — it will not be shown again.',
      api_key: apiKey,
      key_info: {
        id: data.id,
        prefix: data.key_prefix,
        name: data.name,
        tier: data.tier,
        permissions: data.permissions,
        created_at: data.created_at,
        rate_limit: '100 requests/hour (free tier)',
      },
      usage: {
        header: `Authorization: Bearer ${apiKey}`,
        example_curl: `curl -H "Authorization: Bearer ${apiKey}" https://www.dogdata.xyz/api/dog-rune/holders?limit=10`,
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error generating API key:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error', status: 500 } },
      { status: 500 }
    );
  }
}
