import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-mono",
  {
    variants: {
      variant: {
        default: "border-transparent bg-dog-orange text-white shadow",
        secondary: "border-transparent bg-dog-gray-800 text-dog-gray-300",
        destructive: "border-transparent bg-red-600 text-white shadow",
        outline: "text-dog-gray-300 border-dog-gray-600",
        success: "border-transparent bg-green-600 text-white shadow",
        warning: "border-transparent bg-yellow-600 text-white shadow",
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


