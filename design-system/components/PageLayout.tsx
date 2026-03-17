'use client';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  showGlow?: boolean;
}

export default function PageLayout({
  children,
  className = '',
  showGlow = true,
}: PageLayoutProps) {
  return (
    <div className={`bg-bg-base min-h-screen relative ${className}`}>
      {showGlow && (
        <div
          className="absolute top-0 left-0 w-full h-[600px] bg-glow-bitcoin pointer-events-none z-0"
          aria-hidden="true"
        />
      )}

      <div className="relative z-10 max-w-[1280px] mx-auto px-6 md:px-12 lg:px-16 pt-24">
        {children}
      </div>
    </div>
  );
}
