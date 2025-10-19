import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface TrendIndicatorProps {
  value: number
  type?: 'percentage' | 'number'
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TrendIndicator({ 
  value, 
  type = 'percentage', 
  showIcon = true, 
  size = 'md',
  className = "" 
}: TrendIndicatorProps) {
  const isPositive = value > 0
  const isNeutral = value === 0
  
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }
  
  const colorClass = isNeutral 
    ? 'text-gray-400' 
    : isPositive 
      ? 'text-green-400' 
      : 'text-red-400'
  
  const bgClass = isNeutral 
    ? 'bg-gray-500/10' 
    : isPositive 
      ? 'bg-green-500/10' 
      : 'bg-red-500/10'
  
  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown
  
  const formattedValue = type === 'percentage' 
    ? `${isPositive ? '+' : ''}${value.toFixed(1)}%`
    : `${isPositive ? '+' : ''}${value.toLocaleString()}`
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 ${bgClass} font-mono ${sizeClasses[size]} ${colorClass} ${className}`}>
      {showIcon && <Icon className={iconSizes[size]} />}
      <span className="font-semibold">{formattedValue}</span>
    </div>
  )
}

