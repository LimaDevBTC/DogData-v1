import { LucideIcon } from "lucide-react"

interface SectionDividerProps {
  title?: string
  icon?: LucideIcon
  badge?: string
  className?: string
}

export function SectionDivider({ title, icon: Icon, badge, className = "" }: SectionDividerProps) {
  if (!title) {
    // Simple divider without text
    return (
      <div className={`relative my-4 md:my-8 ${className}`}>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-lava/30 to-transparent"></div>
        </div>
      </div>
    )
  }

  // Divider with text and optional icon/badge
  return (
    <div className={`relative my-4 md:my-8 ${className}`}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-lava/30 to-transparent"></div>
      </div>
      <div className="relative flex justify-center">
        <div className="flex items-center gap-3 px-6 py-2 bg-void/80 backdrop-blur-sm border border-lava/20 font-mono">
          {Icon && <Icon className="w-4 h-4 text-lava" />}
          <span className="text-sm font-medium font-display text-lava uppercase tracking-wider">
            {title}
          </span>
          {badge && (
            <span className="px-2 py-0.5 text-xs font-mono bg-lava/20 text-lava-light border border-lava/30">
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

