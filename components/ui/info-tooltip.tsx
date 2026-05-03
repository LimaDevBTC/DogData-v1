"use client"

import { useState, useRef, useEffect } from "react"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface InfoTooltipProps {
  children: React.ReactNode
  className?: string
  align?: "left" | "center" | "right"
  width?: "narrow" | "wide"
}

/**
 * Hover/tap tooltip that shows methodology or detail text.
 * Uses CSS positioning + state, no Radix dependency.
 * - Hover on desktop, tap on mobile
 * - Closes on outside click and on Escape
 */
export function InfoTooltip({
  children,
  className,
  align = "center",
  width = "wide",
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  const alignClass =
    align === "left"
      ? "left-0"
      : align === "right"
      ? "right-0"
      : "left-1/2 -translate-x-1/2"

  const widthClass = width === "narrow" ? "w-64" : "w-80 md:w-96"

  return (
    <span
      ref={containerRef}
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="More info"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex items-center justify-center text-dusty/60 hover:text-snow transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lava/50 rounded"
      >
        <Info className="w-3.5 h-3.5 md:w-4 md:h-4" />
      </button>

      {open && (
        <span
          role="tooltip"
          className={cn(
            "absolute top-full mt-2 z-50",
            alignClass,
            widthClass,
            "rounded-lg border border-border bg-bg-elevated/95 backdrop-blur-xl shadow-2xl",
            "p-4 text-left"
          )}
        >
          <div className="text-dusty text-xs md:text-sm font-mono leading-relaxed space-y-2">
            {children}
          </div>
        </span>
      )}
    </span>
  )
}
