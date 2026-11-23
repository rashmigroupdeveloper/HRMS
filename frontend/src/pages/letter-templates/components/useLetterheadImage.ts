import { useQuery } from '@tanstack/react-query'
import { client, orpc } from '@/lib/orpc'
import { fileToDataUrl } from '@/lib/utils'

export type ImagePart = 'HEADER' | 'FOOTER' | 'SIGNATURE'

// One uploaded letterhead image as a data: URL - null while loading or when there is none (imageId null).
// An image never changes (a new upload is a new image), so it is fetched once.
export function useLetterheadImage(imageId: number | null) {
  const input = { imageId: imageId ?? 0 }
  const image = useQuery({
    queryKey: [...orpc.letterTemplates.image.queryKey({ input }), 'data-url'],
    queryFn: async () => fileToDataUrl(await client.letterTemplates.image(input)),
    enabled: imageId !== null,
    staleTime: Infinity,
  })
  return imageId !== null ? (image.data ?? null) : null
}
