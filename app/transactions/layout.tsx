import { Suspense } from 'react'

export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>
}
