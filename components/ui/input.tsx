import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 min-h-[44px] md:min-h-0 w-full bg-white/[0.03] border border-white/[0.06] text-snow placeholder:text-dusty/40 rounded-lg focus:border-lava/30 focus:ring-1 focus:ring-lava/20 px-3 py-2 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 font-mono",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }


