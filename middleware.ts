import { NextResponse, type NextRequest } from "next/server"

// ═══════════════════════════════════════════════════════════════════════════
// DogCity landing A/B — the site entrance alternates between the two landings.
//
// /donate keeps serving the page that is live today. On alternating hours the
// same URL is transparently rewritten to /landing, the scrollytelling v2 build,
// so both landings stay in rotation without either being taken down.
//
// Hourly (not per-request) on purpose: a visitor who refreshes, or who follows
// a link back, sees the same page for the whole hour. Per-request randomness
// would make the site look broken on a reload and would poison any read of
// which landing actually converts. Switch ROTATION to "random" below if a
// coin-flip per visit is wanted instead.
//
// Fail-safe by construction: anything unexpected falls through to the page that
// is live today. This route carries real donation addresses — the worst case
// here must be "no rotation", never a 500.
//
// Cache-Control is forced off on this one path because the CDN would otherwise
// pin whichever variant it cached first and the rotation would never be seen.
// Both branches set it, so neither variant can be frozen in.
// ═══════════════════════════════════════════════════════════════════════════

const ROTATION: "hourly" | "random" = "hourly"
const NO_STORE = "no-store, must-revalidate"

function showsNewLanding(): boolean {
  if (ROTATION === "random") return Math.random() < 0.5
  return new Date().getUTCHours() % 2 === 1
}

export function middleware(req: NextRequest) {
  try {
    if (!showsNewLanding()) {
      const res = NextResponse.next()
      res.headers.set("Cache-Control", NO_STORE)
      res.headers.set("x-dogcity-variant", "donate-v1")
      return res
    }

    const url = req.nextUrl.clone()
    url.pathname = "/landing"
    const res = NextResponse.rewrite(url)
    res.headers.set("Cache-Control", NO_STORE)
    res.headers.set("x-dogcity-variant", "landing-v2")
    return res
  } catch {
    return NextResponse.next()
  }
}

// Scoped to the single entrance route: every other path skips middleware
// entirely, so the blast radius of this file is one URL.
export const config = { matcher: "/donate" }
