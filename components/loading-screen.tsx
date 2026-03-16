"use client"

interface LoadingScreenProps {
  message?: string
}

export function LoadingScreen({ message = "Loading DOG data..." }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-lava/[0.04] rounded-full blur-[100px] animate-breathe" />

      <div className="text-center space-y-8 relative z-10">
        {/* Orbital spinner */}
        <div className="flex justify-center">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-2 border-lava/10 rounded-full" />
            <div className="absolute inset-0 border-2 border-transparent border-t-lava rounded-full animate-spin" style={{ animationDuration: '1.2s' }} />
            <div className="absolute inset-2 border border-lava/5 rounded-full" />
            <div className="absolute inset-2 border border-transparent border-b-lava/40 rounded-full animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-lava rounded-full animate-pulse shadow-[0_0_12px_rgba(245,110,15,0.4)]" />
            </div>
            <div className="absolute inset-0 border border-lava/20 rounded-full animate-ping opacity-20" style={{ animationDuration: '2s' }} />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-snow/90 font-display text-lg font-semibold tracking-wide">{message}</h2>
          <div className="flex justify-center space-x-1.5">
            <div className="w-1.5 h-1.5 bg-lava/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-lava/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 bg-lava/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
