import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'glass' | 'elevated'
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: "bg-surface/50 border border-elevated/50",
    glass: "glass bg-snow/5 backdrop-blur-lg border border-snow/10",
    elevated: "bg-surface/80 border border-elevated/50 shadow-xl"
  }

  return (
    <div
      ref={ref}
      className={cn(
        "p-4 md:p-6 transition-all duration-300 hover:bg-snow/[0.02] hover:border-snow/20",
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
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
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
    default: "text-snow font-display font-semibold text-base md:text-lg",
    gradient: "gradient-text font-display font-bold text-lg md:text-xl",
    mono: "text-snow font-mono font-semibold text-sm md:text-lg"
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
