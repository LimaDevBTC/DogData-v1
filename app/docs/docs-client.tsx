'use client'

import { useEffect, useRef } from 'react'
import Script from 'next/script'

export default function DocsClient() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scalar picks up the data-url from the #api-reference element automatically
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200">
      {/* Header */}
      <div className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between bg-[#0a0a0a] sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <a href="/" className="text-xl font-bold text-[#F7931A] hover:opacity-80 no-underline">
            DOG DATA
          </a>
          <span className="text-sm text-neutral-500">API Documentation</span>
          <span className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded ml-2">
            v1.0.0
          </span>
        </div>
        <div className="flex gap-4 text-sm">
          <a href="/" className="text-neutral-400 hover:text-neutral-200 no-underline">
            Dashboard
          </a>
          <a href="/api" className="text-neutral-400 hover:text-neutral-200 no-underline">
            API Index
          </a>
          <a href="/api/agent/capabilities" className="text-neutral-400 hover:text-neutral-200 no-underline">
            Capabilities
          </a>
          <a href="/bots.md" className="text-neutral-400 hover:text-neutral-200 no-underline">
            Bot Guide
          </a>
        </div>
      </div>

      {/* Quick Start */}
      <div className="px-6 py-5 bg-[#111] border-b border-neutral-800">
        <h2 className="text-base font-semibold text-[#F7931A] mb-3">
          Quick Start &mdash; No API key required
        </h2>
        <div className="flex gap-6 flex-wrap text-sm font-mono">
          <div>
            <span className="text-green-500">GET</span>{' '}
            <a href="/api/dog-rune/stats" className="text-blue-400 hover:underline no-underline">
              /api/dog-rune/stats
            </a>{' '}
            <span className="text-neutral-500">&mdash; Token overview</span>
          </div>
          <div>
            <span className="text-green-500">GET</span>{' '}
            <a href="/api/price/kraken" className="text-blue-400 hover:underline no-underline">
              /api/price/kraken
            </a>{' '}
            <span className="text-neutral-500">&mdash; Current price</span>
          </div>
          <div>
            <span className="text-green-500">GET</span>{' '}
            <a href="/api" className="text-blue-400 hover:underline no-underline">
              /api
            </a>{' '}
            <span className="text-neutral-500">&mdash; Discovery index</span>
          </div>
        </div>
        <div className="mt-3 text-sm flex gap-6 flex-wrap">
          <div>
            <span className="text-neutral-500">MCP Server:</span>{' '}
            <code className="text-[#F7931A] bg-neutral-900 px-1.5 py-0.5 rounded text-xs">
              npx mcp-remote https://www.dogdata.xyz/mcp
            </code>
          </div>
          <div>
            <span className="text-neutral-500">SSE Events:</span>{' '}
            <code className="text-[#F7931A] bg-neutral-900 px-1.5 py-0.5 rounded text-xs">
              curl -N /api/events?events=whale_alert
            </code>
          </div>
          <div>
            <span className="text-neutral-500">Get API Key:</span>{' '}
            <code className="text-[#F7931A] bg-neutral-900 px-1.5 py-0.5 rounded text-xs">
              POST /api/keys/generate
            </code>
          </div>
        </div>
      </div>

      {/* Scalar API Reference */}
      <div
        ref={containerRef}
        id="api-reference"
        data-url="/api/openapi.json"
        data-configuration={JSON.stringify({
          theme: 'kepler',
          hideModels: false,
          hideDownloadButton: false,
          showSidebar: true,
          searchHotKey: 'k',
        })}
      />

      <Script
        src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
        strategy="afterInteractive"
      />
    </div>
  )
}
