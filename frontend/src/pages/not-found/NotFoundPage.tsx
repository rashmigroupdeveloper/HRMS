import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="mx-auto mt-10 max-w-md rounded-3xl bg-card p-6 text-center shadow-card sm:mt-16">
      <p className="text-sm text-muted-foreground">Error 404</p>
      <h1 className="mt-1 text-3xl font-light tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">The page you are looking for does not exist, or the link is old.</p>
      <div className="mt-5 flex justify-center gap-2">
        <Button variant="secondary" onClick={() => void navigate(-1)}>
          Go back
        </Button>
        <Button nativeButton={false} render={<Link to="/" />}>
          Go home
        </Button>
      </div>
    </div>
  )
}
