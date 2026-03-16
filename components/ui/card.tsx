import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'glass' | 'elevated'
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: "bg-[#0A0A0C]/60 border border-white/[0.04] rounded-xl",
    glass: "bg-[#0A0A0C]/50 backdrop-blur-xl border border-white/[0.05] rounded-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]",
    elevated: "bg-[#0A0A0C]/70 backdrop-blur-xl border border-white/[0.06] shadow-xl rounded-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"
  }

  return (
    <div
      ref={ref}
      className={cn(
        "p-3 md:p-6 overflow-hidden transition-all duration-300 ease-out card-glow",
        "hover:bg-[#0E0E10]/70 hover:border-white/[0.08] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        variants[variant],
        className
      )}
      {...props}
    />
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1 md:space-y-1.5 pb-2 md:pb-4", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & {
    variant?: 'default' | 'gradient' | 'mono'
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: "text-lava-dark font-display font-semibold text-base md:text-lg",
    gradient: "gradient-text font-display font-bold text-lg md:text-xl",
    mono: "text-snow font-mono font-semibold text-xs md:text-lg"
  }

  return (
    <h3
      ref={ref}
      className={cn(variants[variant], className)}
      {...props}
    />
  )
})
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-dusty text-xs md:text-sm font-mono", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
