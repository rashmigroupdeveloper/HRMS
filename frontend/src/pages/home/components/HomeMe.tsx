import { Camera } from 'lucide-react'
import { Link } from 'react-router'
import { HomeMeSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { cn, initialsOf } from '@/lib/utils'
import { CornerLink, TILE } from './HomeParts'
import { useMyPhoto } from './useMyPhoto'

// "You" on the self-service home (2026-11-28, Crextio's profile card - crextio-ref/TASTE.md): one's photo filling the
// card and fading into warm brown, the name and job over it, and the code as an outlined pill. Without a photo the
// initials sit on a warm gradient, with a way to send one (the employee's own upload, checked by HR).
export function HomeMe({ name, employeeCode, job, joined }: { name: string; employeeCode: string; job: string; joined: Date | null }) {
  const photo = useMyPhoto(employeeCode)
  if (photo.pending) return <HomeMeSkeleton />
  return (
    <section className={cn(TILE, 'home-me relative isolate min-h-72 p-0 text-white')}>
      {photo.url
        ? <img src={photo.url} alt={`Photo of ${name}`} className="home-me-photo absolute inset-0 -z-10 size-full object-cover object-[center_22%]" />
        : <div aria-hidden className="home-me-blank absolute inset-0 -z-10 grid place-items-center pb-20"><span className="text-[88px] leading-none font-extralight tracking-tight">{initialsOf(name)}</span></div>}
      <div aria-hidden className="home-me-fade absolute inset-0 -z-10" />
      <div className={cn('flex items-start justify-between gap-2 p-4', !photo.url && 'home-me-ink')}>
        {!photo.url
          ? <Link to="/ess/me?tab=documents" className="home-me-glass inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"><Camera aria-hidden className="size-3.5" />Add your photo</Link>
          : photo.waitingForHr ? <span className="home-me-glass inline-flex min-h-8 items-center rounded-full px-3 text-[11px]">Waiting for HR check</span> : <span />}
        <CornerLink to="/ess/me" label="Open my profile" dark />
      </div>
      <div className="mt-auto min-w-0 px-5 pb-5">
        <h2 className="truncate text-[26px] leading-tight">{name}</h2>
        {job && <p className="mt-0.5 truncate text-xs text-white/80">{job}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="text-xs whitespace-nowrap text-white/80">{joined && <>Since {joined.toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short', year: 'numeric' })}{tenureOf(joined)}</>}</span>
          <span className="shrink-0 rounded-full border border-white/55 px-3 py-1 text-xs tabular-nums">{employeeCode}</span>
        </div>
      </div>
    </section>
  )
}

function tenureOf(joined: Date) {
  const now = new Date()
  const months = (now.getUTCFullYear() - joined.getUTCFullYear()) * 12 + now.getUTCMonth() - joined.getUTCMonth() - (now.getUTCDate() < joined.getUTCDate() ? 1 : 0)
  if (months < 1) return ''
  if (months < 12) return ` · ${months} mo`
  return ` · ${Math.floor(months / 12)} yr${months < 24 ? '' : 's'}`
}
