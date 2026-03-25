import type { Metadata } from 'next'
import DocsClient from './docs-client'

export const metadata: Metadata = {
  title: 'DOG DATA \u2014 API Documentation',
  description:
    'Interactive API documentation for DOG DATA. 35 REST endpoints, MCP Server, SSE events. ' +
    'Explore holders, transactions, pricing, forensic analysis, and on-chain metrics.',
}

export default function DocsPage() {
  return <DocsClient />
}
