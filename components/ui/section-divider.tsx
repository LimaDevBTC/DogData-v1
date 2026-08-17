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
        {/* O chip usava accent-primary, que e o laranja #F7931A do sistema
            aposentado. Seis paginas montam este divisor, entao ele era o
            segundo maior difusor daquela cor no site. Agora e lava, quadrado. */}
        {Icon && (
          <div className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 bg-lava/[0.08] border border-lava/25">
            <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-lava" />
          </div>
        )}
        <span className="text-[11px] md:text-xs font-semibold font-mono text-mist uppercase tracking-[0.15em]">
          {title}
        </span>
        {badge && (
          <span className="px-2 py-0.5 text-[10px] font-mono font-medium bg-lava/[0.08] text-lava border border-lava/25">
            {badge}
          </span>
        )}
        <div className="flex-1 divider-gradient"></div>
      </div>
    </div>
  )
}
