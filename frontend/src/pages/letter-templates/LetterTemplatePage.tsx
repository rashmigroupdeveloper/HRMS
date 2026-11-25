import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import { ArrowLeft, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router'
import { FormError } from '@/components/FormError'
import { SharedListNote } from '@/components/SharedListNote'
import { Pill } from '@/components/Pill'
import { LetterEditorSkeleton } from '@/components/skeletons/letter-templates/LetterEditorSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useAccess } from '@/hooks/useAccess'
import { client, orpc } from '@/lib/orpc'
import { errorMessage, formatDoneBy } from '@/lib/utils'
import { isLetterKind, JOINING_TYPE, type JoiningType, KIND, type LetterDocument, type LetterKind, type Template, type TemplateRow } from './components/labels'
import { LetterEditor } from './components/LetterEditor'
import { type ImageIds, LetterheadImages } from './components/LetterheadImages'
import { useLetterheadImage } from './components/useLetterheadImage'

// One letter template on its own page: /letter-templates/new?kind=APPOINTMENT_LETTER and /letter-templates/:id.
// The letter is edited on an A4 "paper" with the company's letterhead, like a Word document (LetterEditor); a PDF
// preview shows it with example values. Letter templates: View to read, Edit to change. Leaving with unsaved changes
// asks first.

// A new template starts with a short example letter
const NEW_LETTER: LetterDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { textAlign: 'left' },
      content: [
        { type: 'text', text: 'Dear ' },
        { type: 'field', attrs: { name: 'name' } },
        { type: 'text', text: ',' },
      ],
    },
    { type: 'paragraph', attrs: { textAlign: 'justify' }, content: [{ type: 'text', text: 'Write the letter here.' }] },
    { type: 'letterBlock', attrs: { name: 'signature' } },
  ],
}

type Lists = Pick<TemplateRow, 'placeholders' | 'blocks'>

export function LetterTemplatePage() {
  const { id } = useParams()
  const isNew = id === undefined
  const kindParam = useSearchParams()[0].get('kind')
  const newKind: LetterKind = isLetterKind(kindParam) ? kindParam : 'OFFER_LETTER'
  const template = useQuery({ ...orpc.letterTemplates.get.queryOptions({ input: { id: Number(id) } }), enabled: !isNew })
  // a new template gets the field / block lists of its kind
  const list = useQuery({ ...orpc.letterTemplates.kinds.queryOptions(), enabled: isNew })
  // the editor's toolbar shows only for those who may change templates (as in TemplateForm)
  const canChange = useAccess().coversGroup('LETTER_TEMPLATES')

  const back = (
    <Link to="/manage/letter-templates" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Letter templates
    </Link>
  )
  if ((!isNew && template.isPending) || (isNew && list.isPending)) {
    // a new template's title and kind are known from the address
    const heading = isNew ? { title: `New ${KIND[newKind].toLowerCase()} template`, kind: KIND[newKind] } : undefined
    return <LetterEditorSkeleton back={back} canChange={canChange} heading={heading} label="Loading the letter template" />
  }
  const error = isNew ? list.error : template.error
  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <FormError error={error} />
      </div>
    )
  }
  const lists: Lists = isNew ? (list.data!.find((k) => k.kind === newKind) ?? { placeholders: [], blocks: [] }) : template.data!
  // a fresh form per template (moving from /new to the created one starts again)
  return (
    <TemplateForm
      key={isNew ? `new-${newKind}` : template.data!.id}
      template={isNew ? 'new' : template.data!}
      kind={isNew ? newKind : template.data!.kind}
      lists={lists}
      back={back}
    />
  )
}

function TemplateForm({ template, kind, lists, back }: { template: Template | 'new'; kind: LetterKind; lists: Lists; back: React.ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  // templates are shared by every company: Edit for all companies (B13)
  const canChange = useAccess().coversGroup('LETTER_TEMPLATES')
  const isNew = template === 'new'
  // what is saved - anything different is an unsaved change (the letter: the editor's own form of it, set when ready)
  const [start, setStart] = useState(() => ({ name: isNew ? '' : template.name, joiningType: isNew ? '' : (template.joiningType ?? '') }))
  const [startDoc, setStartDoc] = useState<string | null>(null)
  const [values, setValues] = useState(start)
  const [doc, setDoc] = useState<JSONContent>(() => (isNew ? NEW_LETTER : template.body) as JSONContent)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saved, setSaved] = useState(false)
  // after creating: the new template's id - the page moves there (that is not "leaving with unsaved changes")
  const [createdId, setCreatedId] = useState<number | null>(null)
  // a new template: the letterhead images picked from the ones uploaded before (saved with the template)
  const [picked, setPicked] = useState<ImageIds>({ header: null, footer: null, signature: null })
  const imageIds = isNew ? picked : template.imageIds
  const dirty =
    values.name !== start.name ||
    values.joiningType !== start.joiningType ||
    (startDoc !== null && JSON.stringify(doc) !== startDoc) ||
    (isNew && Object.values(picked).some((id) => id !== null))

  // the template's letterhead on the paper (a new template: the images picked for it)
  const headerImage = useLetterheadImage(imageIds.header)
  const footerImage = useLetterheadImage(imageIds.footer)
  const signatureImage = useLetterheadImage(imageIds.signature)
  // for the API: only the picked ones
  const pickedIds = Object.fromEntries(Object.entries(picked).filter(([, id]) => id !== null)) as { header?: number; footer?: number; signature?: number }

  // leaving the page (link, back button) with unsaved changes asks first; so does closing the tab
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => createdId === null && dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (createdId !== null) void navigate(`/manage/letter-templates/${createdId}`, { replace: true })
  }, [createdId, navigate])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.letterTemplates.key() })
  const create = useMutation(
    orpc.letterTemplates.create.mutationOptions({
      onSuccess: (created) => {
        void refresh()
        setCreatedId(created.id)
      },
    }),
  )
  const update = useMutation(
    orpc.letterTemplates.update.mutationOptions({
      onSuccess: (updated) => {
        // what was saved is the new starting point
        const now = { name: updated.name, joiningType: updated.joiningType ?? '' }
        setStart(now)
        setValues(now)
        setStartDoc(JSON.stringify(doc))
        setSaved(true)
        void refresh()
      },
    }),
  )
  const pending = create.isPending || update.isPending

  function save() {
    const joiningType = (values.joiningType || null) as JoiningType | null
    const body = doc as LetterDocument
    setSaved(false)
    if (isNew) create.mutate({ kind, name: values.name, body, imageIds: pickedIds, ...(joiningType && { joiningType }) })
    else update.mutate({ id: template.id, name: values.name, body, joiningType })
  }

  async function preview() {
    setPreviewError(null)
    setPreviewing(true)
    try {
      const blob = await client.letterTemplates.preview({
        kind,
        body: doc as LetterDocument,
        ...(isNew ? { imageIds: pickedIds } : { id: template.id }),
      })
      window.open(URL.createObjectURL(blob), '_blank', 'noopener')
    } catch (error) {
      setPreviewError(errorMessage(error))
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* one compact row: where you are + the two actions */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {back}
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-light tracking-tight sm:text-3xl">
              {isNew ? `New ${KIND[kind].toLowerCase()} template` : values.name || template.name}
            </h1>
            <Pill tone="info">{KIND[kind]}</Pill>
            {!isNew && <Pill tone={template.isActive ? 'positive' : 'neutral'}>{template.isActive ? 'Active' : 'Retired'}</Pill>}
            {!canChange && <Pill tone="neutral">View only</Pill>}
          </div>
          <p className="text-xs text-muted-foreground">
            {isNew
              ? 'Letters already sent never change - they are kept as PDFs.'
              : `Last changed ${formatDoneBy(template.updatedAt, template.updatedBy)}. Letters already sent never change.`}
          </p>
          <SharedListNote area="LETTER_TEMPLATES" label="Letter templates" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={previewing} onClick={() => void preview()}>
            <FileText /> {previewing ? 'Writing…' : 'Preview PDF'}
          </Button>
          {canChange && (
            <Button variant="gold" disabled={pending || !dirty || !values.name.trim()} onClick={save}>
              {pending ? 'Saving…' : isNew ? 'Create template' : 'Save changes'}
            </Button>
          )}
        </div>
      </header>

      {blocker.state === 'blocked' && (
        <div
          role="alertdialog"
          aria-label="Discard changes"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gold-soft px-5 py-3"
        >
          <p className="text-sm font-medium">You have unsaved changes. Leave this page and discard them?</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => blocker.reset()}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed()}>
              Discard
            </Button>
          </div>
        </div>
      )}
      {saved && !dirty && (
        <p className="rounded-2xl bg-positive/10 px-4 py-2 text-sm text-positive-ink">Saved. Letters written from now on use this wording.</p>
      )}
      <FormError error={create.error ?? update.error} />
      {previewError && (
        <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-negative-ink">
          {previewError}
        </p>
      )}

      {/* the pages are A4 at their real size: on a narrow screen their own area scrolls sideways (LetterEditor) */}
      <p className="text-xs text-muted-foreground lg:hidden">The letter is shown at its real size - scroll sideways, or edit on a computer.</p>
      <LetterEditor
        initial={doc}
        editable={canChange}
        placeholders={lists.placeholders}
        blocks={lists.blocks}
        onChange={setDoc}
        onReady={(ready) => {
          setDoc(ready)
          setStartDoc(JSON.stringify(ready))
        }}
        letterhead={{ header: imageIds.header !== null, footer: imageIds.footer !== null }}
        header={headerImage}
        footer={footerImage}
        signature={signatureImage}
        // the template's settings, level with the paper (stays in view, below the toolbar, while scrolling the letter)
        aside={
          <aside className="space-y-4 rounded-3xl bg-card p-5 shadow-card lg:sticky lg:top-[8.5rem]">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">
                Name<span className="text-negative-ink">*</span>
              </Label>
              <Input
                id="tpl-name"
                className="h-10 rounded-xl"
                value={values.name}
                disabled={!canChange}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-type">
                Suggested for
              </Label>
              <NativeSelect
                id="tpl-type"
                className="w-full [&_select]:h-10 [&_select]:rounded-xl"
                value={values.joiningType}
                disabled={!canChange}
                onChange={(e) => setValues((v) => ({ ...v, joiningType: e.target.value }))}
              >
                <NativeSelectOption value="">Any joining type</NativeSelectOption>
                {Object.entries(JOINING_TYPE).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    Suggested for {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="border-t pt-4">
              <LetterheadImages
                templateId={isNew ? null : template.id}
                imageIds={imageIds}
                canChange={canChange}
                onPick={(field, imageId) => setPicked((current) => ({ ...current, [field]: imageId }))}
              />
            </div>
            {canChange && (
              <div className="space-y-1.5 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
                <p className="font-semibold tracking-[0.08em] uppercase">How to edit</p>
                <p>Type on the page like in Word.</p>
                <p>
                  Blue tags such as <span className="letter-field">Full name</span> are filled in for each person - add them with{' '}
                  <strong>+ Insert field</strong>.
                </p>
                <p>
                  <strong>Numbered points</strong> for 1, 2, 3; the indent button makes sub-points 4.1, 4.2.
                </p>
                <p>
                  Select text, then pick a <strong>font</strong> and <strong>size</strong> - the PDF prints the same. Only the default font
                  can print the ₹ sign.
                </p>
              </div>
            )}
          </aside>
        }
      />
    </div>
  )
}
