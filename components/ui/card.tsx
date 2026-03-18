import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'glass' | 'elevated'
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: "bg-bg-surface/60 border border-border-subtle rounded-xl",
    glass: "bg-bg-surface/50 backdrop-blur-xl border border-border-subtle rounded-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]",
    elevated: "bg-bg-surface/70 backdrop-blur-xl border border-border shadow-xl rounded-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"
  }

  return (
    <div
      ref={ref}
      className={cn(
        "p-3 md:p-6 overflow-hidden transition-all duration-300 ease-out card-glow",
        "hover:bg-bg-elevated/70 hover:border-border hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.04)]",
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
    default: "text-text-accent font-display font-semibold text-base md:text-lg",
    gradient: "gradient-text font-display font-bold text-lg md:text-xl",
    mono: "text-text-primary font-mono font-semibold text-xs md:text-lg"
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
    className={cn("text-text-secondary text-xs md:text-sm font-mono", className)}
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
