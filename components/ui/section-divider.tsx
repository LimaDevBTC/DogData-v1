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
      <div className={`relative my-8 ${className}`}>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-orange-500/30 to-transparent"></div>
        </div>
      </div>
    )
  }

  // Divider with text and optional icon/badge
  return (
    <div className={`relative my-8 ${className}`}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-orange-500/30 to-transparent"></div>
      </div>
      <div className="relative flex justify-center">
        <div className="flex items-center gap-3 px-6 py-2 bg-black/80 backdrop-blur-sm border border-orange-500/20 font-mono">
          {Icon && <Icon className="w-4 h-4 text-orange-400" />}
          <span className="text-sm font-medium text-orange-400 uppercase tracking-wider">
            {title}
          </span>
          {badge && (
            <span className="px-2 py-0.5 text-xs font-mono bg-orange-500/20 text-orange-300 border border-orange-500/30">
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

