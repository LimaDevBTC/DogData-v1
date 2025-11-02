import { redirect } from 'next/navigation'

// Redirecionar /overview para / (home)
// Mantém compatibilidade com links antigos
export default function OverviewRedirect() {
  redirect('/')
}
