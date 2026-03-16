import { LucideIcon } from "lucide-react"

interface SectionDividerProps {
  title?: string
  icon?: LucideIcon
  badge?: string
  className?: string
}

export function SectionDivider({ title, icon: Icon, badge, className = "" }: SectionDividerProps) {
  if (!title) {
    return (
      <div className={`my-4 md:my-8 ${className}`}>
        <div className="divider-gradient"></div>
      </div>
    )
  }

  return (
    <div className={`my-4 md:my-8 ${className}`}>
      <div className="flex items-center gap-3 md:gap-4">
        {Icon && (
          <div className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-lg bg-lava/[0.07] border border-lava/[0.1]">
            <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-lava/80" />
          </div>
        )}
        <span className="text-[11px] md:text-xs font-semibold font-mono text-dusty uppercase tracking-[0.15em]">
          {title}
        </span>
        {badge && (
          <span className="px-2 py-0.5 text-[10px] font-mono font-medium bg-lava/[0.08] text-lava-light border border-lava/[0.1] rounded-md">
            {badge}
          </span>
        )}
        <div className="flex-1 divider-gradient"></div>
      </div>
    </div>
  )
}
