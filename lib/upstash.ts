import { Redis } from '@upstash/redis'

const redisRestUrl = process.env.UPSTASH_KV_REST_API_URL
const redisRestToken = process.env.UPSTASH_KV_REST_API_TOKEN

if (!redisRestUrl || !redisRestToken) {
  throw new Error('UPSTASH_KV_REST_API_URL or UPSTASH_KV_REST_API_TOKEN is not set')
}

export const redisClient = new Redis({
  url: redisRestUrl,
  token: redisRestToken,
})


