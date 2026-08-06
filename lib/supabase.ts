import { createClient } from '@supabase/supabase-js'

// Service role first, anon only as a fallback.
//
// Every consumer of this client is a server route (nothing here reaches the
// browser) and several of them WRITE: analytics/track, ads/track. Running those
// writes as `anon` is precisely why the anon role still holds INSERT, UPDATE
// and DELETE on nine tables. Measured on 2026-08-06: with the anon key alone,
// `DELETE /rest/v1/dog_transactions` answered 204, which is enough to take the
// explorer's 469.234 rows with it.
//
// This is the prerequisite for migration 004, which turns RLS on and leaves the
// anon role with nothing. It has to be deployed BEFORE that migration runs, or
// tracking starts failing the moment RLS comes up.
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
