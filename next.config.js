/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        './data/forensic_airdrop_data.json',
        './data/dog_data/**',
        './data/backup_ord_data/**',
        './data/airdrop_recipients_complete.json',
        './data/airdrop_final.json',
        './data/airdrop_dog_only.json',
        './data/airdrop_recipients_exact.json',
        './data/merlin_*.json',
        './data/wallet_analysis_*.json',
        './data/dog_transactions/**',
        './mcp-server/**',
        './sdk/**',
      ],
    },
  },
}

module.exports = nextConfig