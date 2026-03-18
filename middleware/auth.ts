import { NextRequest } from 'next/server';
import { redisClient } from '@/lib/upstash';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export interface ApiKeyInfo {
  id: string;
  key_prefix: string;
  name: string;
  owner_email: string;
  tier: 'free' | 'pro' | 'enterprise';
  permissions: string[];
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function validateApiKey(req: NextRequest): Promise<ApiKeyInfo | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer dog_')) return null;

  const key = authHeader.slice(7); // Remove "Bearer "
  const keyHash = sha256(key);

  // Check Redis cache first
  try {
    const cached = await redisClient.get(`apikey:${keyHash}`);
    if (cached) {
      // Touch last_used_at in background (non-blocking)
      redisClient.set(`apikey:${keyHash}:last_used`, Date.now()).catch(() => {});
      return typeof cached === 'string' ? JSON.parse(cached) : cached as ApiKeyInfo;
    }
  } catch {}

  // Fallback to Supabase
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null;
    }

    const keyInfo: ApiKeyInfo = {
      id: data.id,
      key_prefix: data.key_prefix,
      name: data.name,
      owner_email: data.owner_email,
      tier: data.tier,
      permissions: data.permissions || ['read'],
      is_active: data.is_active,
      created_at: data.created_at,
      expires_at: data.expires_at,
      last_used_at: data.last_used_at,
    };

    // Cache in Redis for 5 minutes
    await redisClient.set(`apikey:${keyHash}`, JSON.stringify(keyInfo), { ex: 300 }).catch(() => {});

    // Update last_used_at in Supabase (non-blocking)
    void supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);

    return keyInfo;
  } catch {
    return null;
  }
}

// Get tier from request - returns 'public' if no key, or the key's tier
export async function getRequestTier(req: NextRequest): Promise<{ tier: 'public' | 'free' | 'pro' | 'enterprise'; keyInfo: ApiKeyInfo | null }> {
  const keyInfo = await validateApiKey(req);
  if (!keyInfo) return { tier: 'public', keyInfo: null };
  return { tier: keyInfo.tier, keyInfo };
}
