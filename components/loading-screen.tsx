"use client"

interface LoadingScreenProps {
  message?: string
}

export function LoadingScreen({ message = "Loading DOG data..." }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="text-center space-y-6">
        {/* Logo/Icon */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Spinning circle */}
            <div className="w-16 h-16 border-4 border-lava/30 border-t-lava rounded-full animate-spin"></div>
            {/* Pulsing background */}
            <div className="absolute inset-0 w-16 h-16 bg-lava/10 rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Loading text */}
        <div className="space-y-2">
          <h2 className="text-snow font-display text-xl font-bold">{message}</h2>
          <div className="flex justify-center space-x-1">
            <div className="w-2 h-2 bg-lava rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-lava rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-lava rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}

