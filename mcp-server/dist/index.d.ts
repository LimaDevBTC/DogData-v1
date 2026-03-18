#!/usr/bin/env node
/**
 * DOG DATA MCP Server — Entry Point
 *
 * Usage:
 *   STDIO (default):  npx tsx index.ts
 *   HTTP:             npx tsx index.ts --http
 *
 * Environment variables:
 *   UPSTASH_KV_REST_API_URL    — Upstash Redis URL for transaction data
 *   UPSTASH_KV_REST_API_TOKEN  — Upstash Redis token
 *   SUPABASE_URL               — Supabase project URL (optional)
 *   SUPABASE_ANON_KEY          — Supabase anonymous key (optional)
 *   MCP_HTTP_PORT              — HTTP transport port (default: 3002)
 */
export {};
