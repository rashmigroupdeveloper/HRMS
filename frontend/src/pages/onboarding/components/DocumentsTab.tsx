import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { DocumentsTableSkeleton } from '@/components/skeletons/onboarding/DocumentsTableSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { errorMessage, formatDoneBy } from '@/lib/utils'
import { SectionTitle } from '@/components/FormFields'
import { type Candidate, type CandidateDocument, DOCUMENT_TYPE, VERIFICATION, VERIFICATION_TONE } from './labels'
import { MovedToEmployee } from './MovedToEmployee'
import { PrintFormsCard } from './PrintForms'
import { Pill } from '@/components/Pill'
import { ReasonDialog } from './ReasonDialog'

type DocumentType = CandidateDocument['type']

// Checked here before uploading: the API refuses requests over 6 MB without reading them, so the browser would
// only see a closed connection instead of a clear message. The API checks the real file type again.
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png']

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

export function DocumentsTab({ candidate }: { candidate: Candidate }) {
  const queryClient = useQueryClient()
  const documents = useQuery(orpc.candidates.documents.list.queryOptions({ input: { candidateId: candidate.id } }))
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.candidates.key() })
  // Changes only before joining, and only with edit access to onboarding
  const canChange = useAccess().can('ONBOARDING', 'WRITE')
  const editable = candidate.status === 'ACCEPTED' && canChange

  const [type, setType] = useState<DocumentType | ''>('')
  const [file, setFile] = useState<File | null>(null)
  const [fileProblem, setFileProblem] = useState<string | null>(null)
  // Changing the key gives a fresh (empty) file input after an upload
  const [inputKey, setInputKey] = useState(0)
  const [rejecting, setRejecting] = useState<CandidateDocument | null>(null)
  const [deleting, setDeleting] = useState<CandidateDocument | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const upload = useMutation(
    orpc.candidates.documents.upload.mutationOptions({
      onSuccess: () => {
        setFile(null)
        setInputKey((k) => k + 1)
        void refresh()
      },
    }),
  )
  const review = useMutation(orpc.candidates.documents.review.mutationOptions({ onSuccess: () => { setRejecting(null); void refresh() } }))
  // Deleting never erases: the document moves to "Deleted" (with who, when and why) and can be restored
  const remove = useMutation(orpc.candidates.documents.delete.mutationOptions({ onSuccess: () => { setDeleting(null); void refresh() } }))
  const restore = useMutation(orpc.candidates.documents.restore.mutationOptions({ onSuccess: () => void refresh() }))
  const current = documents.data?.filter((d) => !d.isDeleted) ?? []
  const deleted = documents.data?.filter((d) => d.isDeleted) ?? []

  function pickFile(picked: File | undefined) {
    setFileProblem(null)
    setFile(null)
    if (!picked) return
    if (picked.size > MAX_BYTES) return setFileProblem('The file must be 5 MB or smaller.')
    if (!ALLOWED.includes(picked.type)) return setFileProblem('Only PDF, JPG or PNG files can be uploaded.')
    setFile(picked)
  }

  async function download(doc: CandidateDocument) {
    setDownloadError(null)
    try {
      const blob = await client.candidates.documents.download({ id: doc.id })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      setDownloadError(errorMessage(error))
    }
  }

  if (candidate.employee) return <MovedToEmployee what="documents" employeeCode={candidate.employee.employeeCode} />

  return (
    <div className="space-y-4">
      <PrintFormsCard candidate={candidate} />
      {editable && (
        <section className="space-y-4 rounded-3xl bg-card p-5 shadow-card">
          <SectionTitle title="Upload a document" description="PDF, JPG or PNG up to 5 MB. Several files of one type are fine (e.g. Aadhaar front and back)." />
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <NativeSelect className="w-full [&_select]:h-10 [&_select]:rounded-xl" value={type} onChange={(e) => setType(e.target.value as DocumentType | '')}>
              <NativeSelectOption value="">Document type…</NativeSelectOption>
              {Object.entries(DOCUMENT_TYPE).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Input key={inputKey} type="file" accept=".pdf,.jpg,.jpeg,.png" className="h-10 rounded-xl" onChange={(e) => pickFile(e.target.files?.[0])} />
            <Button disabled={!type || !file || upload.isPending} onClick={() => type && file && upload.mutate({ candidateId: candidate.id, type, file })}>
              <Upload /> {upload.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
          {fileProblem && <p className="text-sm text-negative-ink">{fileProblem}</p>}
          <FormError error={upload.error} />
        </section>
      )}

      <section className="space-y-3 rounded-3xl bg-card p-5 shadow-card">
        <SectionTitle title="Documents" description={editable ? 'Check each one against the original, then verify or reject it.' : canChange ? 'History - nothing can change now.' : 'View only.'} />
        <FormError error={review.error ?? restore.error} />
        {downloadError && <p className="text-sm text-negative-ink">{downloadError}</p>}
        {documents.isPending ? (
          <DocumentsTableSkeleton label="Loading the documents" />
        ) : documents.error ? (
          <p className="text-sm text-negative-ink">{errorMessage(documents.error)}</p>
        ) : current.length === 0 ? (
          <p className="text-sm text-muted-foreground">{deleted.length ? 'No documents - only deleted ones (below).' : 'No documents yet.'}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded / reviewed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {current.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{DOCUMENT_TYPE[doc.type]}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {doc.fileName} · {kb(doc.sizeBytes)}
                  </TableCell>
                  <TableCell>
                    <Pill tone={VERIFICATION_TONE[doc.verificationStatus]}>{VERIFICATION[doc.verificationStatus]}</Pill>
                    {doc.rejectionReason && <p className="mt-1 text-xs text-negative-ink">{doc.rejectionReason}</p>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDoneBy(doc.createdAt, doc.uploadedBy)}
                    {doc.reviewedAt && <span className="block">Reviewed {formatDoneBy(doc.reviewedAt, doc.reviewedBy)}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => void download(doc)}>
                        <Download /> View
                      </Button>
                      {editable && doc.verificationStatus !== 'VERIFIED' && (
                        <Button variant="secondary" size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: doc.id, status: 'VERIFIED' })}>
                          Verify
                        </Button>
                      )}
                      {editable && doc.verificationStatus !== 'REJECTED' && (
                        <Button variant="ghost" size="sm" onClick={() => setRejecting(doc)}>
                          Reject
                        </Button>
                      )}
                      {editable && doc.verificationStatus !== 'VERIFIED' && (
                        <Button variant="ghost" size="sm" aria-label="Delete" onClick={() => setDeleting(doc)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {deleted.length > 0 && (
        <section className="space-y-3 rounded-3xl bg-card p-5 shadow-card">
          <SectionTitle title="Deleted" description="Kept with who deleted them and why - they do not count for joining. Restore one if it was deleted by mistake." />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Deleted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deleted.map((doc) => (
                <TableRow key={doc.id} className="text-muted-foreground">
                  <TableCell className="font-medium">{DOCUMENT_TYPE[doc.type]}</TableCell>
                  <TableCell className="max-w-48 truncate">
                    {doc.fileName} · {kb(doc.sizeBytes)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDoneBy(doc.deletedAt, doc.deletedBy)}
                    {doc.deleteReason && <span className="block text-negative-ink">{doc.deleteReason}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => void download(doc)}>
                        <Download /> View
                      </Button>
                      {editable && (
                        <Button variant="secondary" size="sm" disabled={restore.isPending} onClick={() => restore.mutate({ id: doc.id })}>
                          <RotateCcw /> Restore
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      <ReasonDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete document"
        description={deleting ? `${DOCUMENT_TYPE[deleting.type]} - ${deleting.fileName}. It is not erased: it moves to "Deleted" and can be restored.` : ''}
        reasonLabel="Why is it deleted"
        confirmLabel="Delete"
        reasonRequired
        destructive
        pending={remove.isPending}
        error={remove.error}
        onConfirm={(reason) => deleting && remove.mutate({ id: deleting.id, reason: reason ?? '' })}
      />

      <ReasonDialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
        title="Reject document"
        description={
          rejecting
            ? `${DOCUMENT_TYPE[rejecting.type]} - ${rejecting.fileName}. The candidate will need to give a new one` +
              (rejecting.uploadedBy?.employeeCode === null &&
              candidate.joiningFormOpenedAt &&
              candidate.personalEmail &&
              !(documents.data ?? []).some(
                (d) => d.type === rejecting.type && d.id !== rejecting.id && !d.isDeleted && d.verificationStatus !== 'REJECTED' && d.createdAt >= rejecting.createdAt,
              )
                ? ' - they are e-mailed this reason.'
                : '.')
            : ''
        }
        reasonLabel="What is wrong with it"
        confirmLabel="Reject"
        reasonRequired
        destructive
        pending={review.isPending}
        error={review.error}
        onConfirm={(reason) => rejecting && review.mutate({ id: rejecting.id, status: 'REJECTED', rejectionReason: reason })}
      />
    </div>
  )
}
