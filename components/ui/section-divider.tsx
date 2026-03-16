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
      <div className={`my-3 md:my-6 ${className}`}>
        <div className="w-full h-px bg-snow/[0.06]"></div>
      </div>
    )
  }

  return (
    <div className={`my-3 md:my-6 ${className}`}>
      <div className="flex items-center gap-2 md:gap-3">
        {Icon && <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-lava/80" />}
        <span className="text-[11px] md:text-xs font-medium font-mono text-dusty uppercase tracking-widest">
          {title}
        </span>
        {badge && (
          <span className="px-1.5 py-0.5 text-[10px] font-mono bg-lava/10 text-lava-light rounded-md">
            {badge}
          </span>
        )}
        <div className="flex-1 h-px bg-snow/[0.06]"></div>
      </div>
    </div>
  )
}

