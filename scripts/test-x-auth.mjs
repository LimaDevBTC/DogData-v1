/**
 * Test X (Twitter) API credentials from .env.local
 * Run: node scripts/test-x-auth.mjs
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Parse .env.local manually
const envPath = resolve(__dirname, '../.env.local')
const envVars = {}
readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim()
})

const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = envVars

console.log('\n── Credenciais carregadas do .env.local ──')
console.log('X_API_KEY:       ', X_API_KEY      ? `${X_API_KEY.slice(0,6)}...`      : '❌ MISSING')
console.log('X_API_SECRET:    ', X_API_SECRET   ? `${X_API_SECRET.slice(0,6)}...`   : '❌ MISSING')
console.log('X_ACCESS_TOKEN:  ', X_ACCESS_TOKEN  ? `${X_ACCESS_TOKEN.slice(0,10)}...` : '❌ MISSING')
console.log('X_ACCESS_SECRET: ', X_ACCESS_SECRET ? `${X_ACCESS_SECRET.slice(0,6)}...` : '❌ MISSING')

if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
  console.error('\n❌ Faltam credenciais.\n')
  process.exit(1)
}

// Use twitter-api-v2 library
const { TwitterApi } = await import('twitter-api-v2')

const client = new TwitterApi({
  appKey: X_API_KEY,
  appSecret: X_API_SECRET,
  accessToken: X_ACCESS_TOKEN,
  accessSecret: X_ACCESS_SECRET,
})

// Test 1: verify credentials
console.log('\n── Teste 1: verificar credenciais ──')
try {
  const me = await client.v2.me()
  console.log(`✅ Autenticado como: @${me.data.username} (id: ${me.data.id})`)
} catch (e) {
  console.error(`❌ Erro ${e.code}:`, e.data ?? e.message)
  if (e.code === 401) {
    console.error('\n💡 Token inválido. No X Developer Portal:')
    console.error('   1. App → Settings → User authentication settings → Read and Write → Save')
    console.error('   2. Keys and Tokens → Access Token & Secret → Regenerate')
    console.error('   3. Copia os novos valores para .env.local\n')
  }
  process.exit(1)
}

// Test 2: check write permissions with a test tweet
console.log('\n── Teste 2: postar tweet de teste ──')
try {
  const tweet = await client.v2.tweet('🐕 DOG DATA whale alert system — connectivity test. #DOGBTC dogdata.xyz')
  console.log(`✅ Tweet postado! https://x.com/i/web/status/${tweet.data.id}`)
} catch (e) {
  console.error(`❌ Erro ao postar:`, e.data ?? e.message)
  if (e.code === 403) {
    console.error('\n💡 Token só tem Read. Muda para Read+Write e regenera o Access Token.')
  }
}
