import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Images, Upload } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { ImagePickerSkeleton } from '@/components/skeletons/letter-templates/ImagePickerSkeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { orpc } from '@/lib/orpc'
import { cn, errorMessage, formatDoneBy } from '@/lib/utils'
import type { Template } from './labels'
import { type ImagePart, useLetterheadImage } from './useLetterheadImage'

// The letterhead of a letter template: three images cut from the printed letterhead. A letter can only be sent from a
// template with all three. Letter templates: Edit to change. Every image ever uploaded is kept, so one can be picked
// again ("Choose uploaded") - also for a template that is not created yet (then it is saved with the template).

export type ImageIds = Template['imageIds']
type Field = keyof ImageIds

const PARTS: { part: ImagePart; field: Field; label: string; hint: string; height: string }[] = [
  { part: 'HEADER', field: 'header', label: 'Header', hint: 'Top of every page - logo, company name, office, CIN. A wide image, e.g. 2000 × 250 px.', height: 'h-14' },
  { part: 'FOOTER', field: 'footer', label: 'Footer', hint: 'Bottom of every page - e.g. the factory address. A wide, short image.', height: 'h-9' },
  { part: 'SIGNATURE', field: 'signature', label: 'Stamp + signature', hint: "The signatory's signature with the company stamp (white or transparent background).", height: 'h-20' },
]

// `templateId` null = a template not created yet: images can only be picked (`onPick`), uploading comes after creating
export function LetterheadImages({
  templateId,
  imageIds,
  canChange,
  onPick,
}: {
  templateId: number | null
  imageIds: ImageIds
  canChange: boolean
  onPick?: (field: Field, imageId: number) => void
}) {
  const ready = imageIds.header !== null && imageIds.footer !== null && imageIds.signature !== null
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Letterhead</p>
      {!ready && (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-xs">
          {templateId === null
            ? 'Choose images uploaded before, or create the template first and then upload new ones.'
            : 'Offers can be sent with this template once all three images are there.'}
        </p>
      )}
      {PARTS.map((p) => (
        <LetterheadImage key={p.part} templateId={templateId} imageId={imageIds[p.field]} canChange={canChange} onPick={onPick} {...p} />
      ))}
      <p className="text-xs text-muted-foreground">PNG or JPG, up to 2 MB each. Replaced images are kept.</p>
    </div>
  )
}

function LetterheadImage({
  templateId,
  imageId,
  canChange,
  onPick,
  part,
  field,
  label,
  hint,
  height,
}: (typeof PARTS)[number] & { templateId: number | null; imageId: number | null; canChange: boolean; onPick?: (field: Field, imageId: number) => void }) {
  const queryClient = useQueryClient()
  const url = useLetterheadImage(imageId)
  const [choosing, setChoosing] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.letterTemplates.key() })
  const upload = useMutation(orpc.letterTemplates.uploadImage.mutationOptions({ onSuccess: () => void refresh() }))
  const setImage = useMutation(orpc.letterTemplates.setImage.mutationOptions({ onSuccess: () => { setChoosing(false); void refresh() } }))
  const inputId = `template-image-${part}`

  function pick(picked: number) {
    if (templateId === null) {
      onPick?.(field, picked)
      setChoosing(false)
    } else setImage.mutate({ id: templateId, part, imageId: picked })
  }

  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium">{label}</span>
        {canChange && (
          <div className="flex gap-0.5">
            <Button variant="ghost" size="sm" onClick={() => setChoosing(true)}>
              <Images /> Choose
            </Button>
            {templateId !== null && (
              <>
                <input
                  id={inputId}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) upload.mutate({ id: templateId, part, file })
                  }}
                />
                <Button variant="ghost" size="sm" disabled={upload.isPending} render={<label htmlFor={inputId} />} nativeButton={false}>
                  <Upload /> {upload.isPending ? 'Uploading…' : 'Upload'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      <div className={cn('flex items-center justify-center overflow-hidden rounded-xl border border-dashed bg-white p-1', height)} title={hint}>
        {imageId === null ? (
          <span className="text-xs text-muted-foreground">None yet</span>
        ) : url ? (
          <img src={url} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <Skeleton role="status" aria-label={`Loading the ${label.toLowerCase()}`} className="size-full rounded-lg" />
        )}
      </div>
      <FormError error={upload.error} />
      {choosing && (
        <ImagePicker
          part={part}
          label={label}
          currentId={imageId}
          pending={setImage.isPending}
          error={setImage.error}
          onPick={pick}
          onClose={() => setChoosing(false)}
        />
      )}
    </section>
  )
}

// Every image uploaded for this part (any template), newest first, to pick one
function ImagePicker({
  part,
  label,
  currentId,
  pending,
  error,
  onPick,
  onClose,
}: {
  part: ImagePart
  label: string
  currentId: number | null
  pending: boolean
  error: unknown
  onPick: (imageId: number) => void
  onClose: () => void
}) {
  const images = useQuery(orpc.letterTemplates.images.queryOptions({ input: { part } }))
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose a {label.toLowerCase()}</DialogTitle>
          <DialogDescription>Images uploaded before, for any template. Nothing is erased - an image can be used by several templates.</DialogDescription>
        </DialogHeader>
        <FormError error={error} />
        {images.isPending ? (
          <ImagePickerSkeleton label={`Loading the uploaded ${label.toLowerCase()} images`} />
        ) : images.error ? (
          <p className="text-sm text-negative-ink">{errorMessage(images.error)}</p>
        ) : images.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {label.toLowerCase()} uploaded yet.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {images.data.map((image) => (
              <li key={image.id} className={cn('space-y-2 rounded-2xl border p-3', image.id === currentId && 'border-foreground/40 bg-surface-2')}>
                <Thumbnail imageId={image.id} />
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0 text-xs text-muted-foreground">
                    <p className="truncate font-medium text-foreground">{image.fileName}</p>
                    <p>Uploaded {formatDoneBy(image.createdAt, image.uploadedBy)}</p>
                    <p className="truncate">{image.usedBy.length ? `Used by ${image.usedBy.map((t) => t.name).join(', ')}` : 'Not used by any template'}</p>
                  </div>
                  {image.id === currentId ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium">
                      <Check className="size-4" /> In use
                    </span>
                  ) : (
                    <Button size="sm" variant="secondary" className="shrink-0" disabled={pending} onClick={() => onPick(image.id)}>
                      Use this
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Thumbnail({ imageId }: { imageId: number }) {
  const url = useLetterheadImage(imageId)
  return (
    <div className="flex h-20 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-white p-1">
      {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <Skeleton role="status" aria-label="Loading the image" className="size-full rounded-lg" />}
    </div>
  )
}
