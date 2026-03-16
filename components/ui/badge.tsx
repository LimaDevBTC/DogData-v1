import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-lava focus:ring-offset-2 font-mono",
  {
    variants: {
      variant: {
        default: "border-transparent bg-lava/90 text-snow shadow-sm",
        secondary: "border-transparent bg-white/[0.06] text-dusty",
        destructive: "border-transparent bg-red-600 text-snow shadow",
        outline: "text-dusty border-white/[0.08]",
        success: "border-transparent bg-green-600 text-snow shadow",
        warning: "border-transparent bg-yellow-600 text-snow shadow",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
