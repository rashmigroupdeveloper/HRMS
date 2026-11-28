import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { orpc } from '@/lib/orpc'

// One's own photo (the PHOTO document - joining form page 1) as an image address for the home's portrait card. The
// verified copy wins; without one, one's own copy still waiting for HR, so the employee sees what they sent. A PDF
// photo cannot be drawn, so it counts as none.
export function useMyPhoto(employeeCode: string | undefined) {
  const docs = useQuery({ ...orpc.employees.documents.list.queryOptions({ input: { employeeCode: employeeCode ?? '' } }), enabled: !!employeeCode })
  const photos = (docs.data ?? []).filter((d) => d.type === 'PHOTO' && !d.isDeleted && d.verificationStatus !== 'REJECTED' && d.mimeType.startsWith('image/'))
  const photo = photos.filter((d) => d.verificationStatus === 'VERIFIED').at(-1) ?? photos.at(-1) ?? null
  const file = useQuery({ ...orpc.employees.documents.download.queryOptions({ input: { id: photo?.id ?? 0 } }), enabled: !!photo, staleTime: Infinity })
  const url = useMemo(() => (file.data ? URL.createObjectURL(file.data) : null), [file.data])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return {
    url,
    waitingForHr: photo?.verificationStatus === 'PENDING',
    pending: !!employeeCode && (docs.isPending || (!!photo && file.isPending)),
  }
}
