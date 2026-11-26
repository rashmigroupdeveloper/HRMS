import { Skeleton } from '@/components/ui/skeleton'

export function PayrollPeriodSkeleton() {
  return <div role="status" aria-label="Loading attendance period"><Skeleton className="h-5 w-52" /></div>
}
