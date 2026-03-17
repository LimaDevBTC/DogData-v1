'use client';

import { useState } from 'react';

interface NavLink {
  label: string;
  href: string;
  active?: boolean;
}

interface NavBarProps {
  logo?: React.ReactNode;
  links?: NavLink[];
  actions?: React.ReactNode;
}

export default function NavBar({ logo, links = [], actions }: NavBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="fixed top-0 left-0 w-full h-16 z-50 bg-bg-base/80 backdrop-blur-xl border-b border-border-subtle">
        <div className="max-w-[1280px] mx-auto h-full px-6 md:px-12 lg:px-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            {logo || (
              <span className="font-display text-xl">
                <span className="text-text-accent">$</span>
                <span className="text-text-primary">DOG</span>
              </span>
            )}
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`font-sans text-sm transition-colors ${
                  link.active
                    ? 'text-text-primary border-b border-accent-primary pb-0.5'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop actions + mobile hamburger */}
          <div className="flex items-center gap-4">
            {actions && <div className="hidden md:flex items-center">{actions}</div>}

            {/* Hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-bg-void/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer */}
          <div className="absolute top-0 right-0 h-full w-72 bg-bg-surface border-l border-border-subtle flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between h-16 px-6 border-b border-border-subtle">
              <span className="font-display text-lg">
                <span className="text-text-accent">$</span>
                <span className="text-text-primary">DOG</span>
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer links */}
            <div className="flex flex-col py-4">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`px-6 py-3 font-sans text-sm transition-colors ${
                    link.active
                      ? 'text-text-primary bg-bg-elevated border-l-2 border-accent-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                  }`}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Drawer actions */}
            {actions && <div className="mt-auto px-6 py-4 border-t border-border-subtle">{actions}</div>}
          </div>
        </div>
      )}
    </>
  );
}
