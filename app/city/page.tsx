import { redirect } from 'next/navigation'

// /city has given way to /dogcity.
//
// This route used to serve the first DogCity page (the "coming soon" teaser).
// The landing lives at /dogcity now, so anything still pointing here — most
// importantly the DogCity item in the shared header, which cannot be edited
// from this repo because components/header.tsx is held back with
// `git update-index --skip-worktree` — lands on the current page instead of
// the first version.
//
// Deliberately a temporary (307) redirect rather than a permanent (308): a 308
// is cached hard by browsers and would be painful to walk back if /city is ever
// wanted for something else. Nothing about this needs to be permanent to work.
//
// Note this only affects /city itself. The local-only WIP routes underneath it
// (/city/explore, /city/luna — both gitignored) keep resolving normally.
export default function CityPage() {
  redirect('/dogcity')
}
