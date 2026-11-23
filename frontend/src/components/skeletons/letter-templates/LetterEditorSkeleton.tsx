import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Columns2,
  FileText,
  Images,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Redo2,
  SeparatorHorizontal,
  Stamp,
  Table,
  Underline,
  Undo2,
  Upload,
} from 'lucide-react'
import { SharedListNote } from '@/components/SharedListNote'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const LINE = ['w-full', 'w-11/12', 'w-full', 'w-4/5', 'w-full', 'w-2/3']
// the letterhead parts as the settings card shows them, with their boxes' heights
const PARTS = [
  { label: 'Header', height: 'h-14' },
  { label: 'Footer', height: 'h-9' },
  { label: 'Stamp + signature', height: 'h-20' },
]
const TOOLS = [[Bold, Italic, Underline], [ListOrdered, List, IndentIncrease, IndentDecrease], [AlignLeft, AlignCenter, AlignRight, AlignJustify]]

// Loading placeholder for a letter template's page (LetterTemplatePage): the title row - the name, its pills and "Last
// changed" as bars, Preview PDF and Save (disabled) - the formatting toolbar (`canChange`, disabled), an A4 sheet at its
// real size (595 x 842 pt, scrolling sideways on a phone like the real paper) with bars for the letterhead and the
// letter, and the settings card beside it with its real labels: Name, Suggested for, the three letterhead parts and
// the "How to edit" help. Bars on the page's own background are a darker tint, or they would not show. `heading`: a
// new template, whose title, kind and empty letterhead are known before anything loads.
export function LetterEditorSkeleton({
  back,
  canChange = true,
  heading,
  label = 'Loading',
}: {
  back?: React.ReactNode
  canChange?: boolean
  heading?: { title: string; kind: string }
  label?: string
}) {
  const tool = 'inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm opacity-40 [&_svg]:size-4'
  const divider = <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {back}
          <div className="flex flex-wrap items-center gap-2.5">
            {heading ? (
              <>
                <h1 className="text-2xl font-light tracking-tight sm:text-3xl">{heading.title}</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-info/15 px-2.5 py-1 text-xs font-medium text-info-ink">
                  <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
                  {heading.kind}
                </span>
              </>
            ) : (
              <>
                <div className="flex h-8 items-center sm:h-9">
                  <Skeleton className="h-6 w-36 rounded-lg bg-foreground/10 sm:h-7" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full bg-foreground/10" />
                <Skeleton className="h-6 w-16 rounded-full bg-foreground/10" />
              </>
            )}
          </div>
          {heading ? (
            <p className="text-xs text-muted-foreground">Letters already sent never change - they are kept as PDFs.</p>
          ) : (
            <div className="text-xs text-muted-foreground">
              Last changed <Skeleton className="inline-block h-3 w-44 max-w-[50%] rounded-full bg-foreground/10 align-middle" />. Letters already sent never
              change.
            </div>
          )}
          <SharedListNote area="LETTER_TEMPLATES" label="Letter templates" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled>
            <FileText /> Preview PDF
          </Button>
          {canChange && (
            <Button variant="gold" disabled>
              {heading ? 'Create template' : 'Save changes'}
            </Button>
          )}
        </div>
      </header>

      <p className="text-xs text-muted-foreground lg:hidden">The letter is shown at its real size - scroll sideways, or edit on a computer.</p>
      <div className="space-y-3">
        {canChange && (
          <div className="flex flex-wrap items-center gap-1 rounded-2xl border bg-card/95 p-1.5 shadow-card">
            <span className="flex h-8 w-[10.5rem] items-center justify-between rounded-lg border border-input px-2.5 text-sm opacity-50">
              Default font <ChevronDown className="size-4 text-muted-foreground" />
            </span>
            <span className="flex h-8 items-center rounded-lg border border-input text-sm opacity-50">
              <span className="w-11 pl-2">10</span>
              <span className="grid w-6 place-items-center text-muted-foreground">
                <ChevronDown className="size-3.5" />
              </span>
            </span>
            {TOOLS.map((group, i) => (
              <span key={i} className="contents">
                {divider}
                {group.map((Icon, j) => (
                  <span key={j} className={tool}>
                    <Icon />
                  </span>
                ))}
              </span>
            ))}
            {divider}
            <span className="flex h-8 w-40 items-center justify-between rounded-lg border border-input px-2.5 text-sm opacity-50">
              + Insert field… <ChevronDown className="size-4 text-muted-foreground" />
            </span>
            {[Table, Stamp, Columns2, SeparatorHorizontal].map((Icon, i) => (
              <span key={i} className={tool}>
                <Icon />
              </span>
            ))}
            {divider}
            <span className={tool}>
              <Undo2 />
            </span>
            <span className={tool}>
              <Redo2 />
            </span>
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
          {/* the paper at its real size: on a narrow screen its own area scrolls sideways */}
          <div className="overflow-x-auto rounded-3xl bg-surface-2 p-3 sm:p-6">
            <div className="relative mx-auto h-[841.89pt] w-[595.28pt] bg-white shadow-float">
              {/* a new template has no letterhead yet: its text starts at the top margin */}
              {!heading && <Skeleton className="absolute top-[18pt] left-[50pt] h-[78pt] w-[495.28pt] rounded-lg" />}
              <div className={cn('space-y-3 px-[50pt]', heading ? 'pt-[50pt]' : 'pt-[118pt]')}>
                {Array.from({ length: 18 }, (_, i) => (
                  <Skeleton key={i} className={cn('h-2.5 rounded-full', LINE[i % LINE.length], (i === 2 || i === 7 || i === 12) && 'mb-6')} />
                ))}
              </div>
              {!heading && <Skeleton className="absolute top-[771.89pt] left-[50pt] h-[34pt] w-[495.28pt] rounded-lg" />}
            </div>
          </div>

          <aside className="space-y-4 rounded-3xl bg-card p-5 shadow-card">
            <div className="space-y-1.5">
              <Label>
                Name<span className="text-negative-ink">*</span>
              </Label>
              <div className="flex h-10 items-center rounded-xl border border-input px-3">
                {!heading && <Skeleton className="h-3.5 w-28 rounded-full" />}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Suggested for</Label>
              <div className="flex h-10 items-center justify-between rounded-xl border border-input px-3">
                {heading ? <span className="text-sm">Any joining type</span> : <Skeleton className="h-3.5 w-32 rounded-full" />}
                <ChevronDown className="size-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-3 border-t pt-4">
              <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Letterhead</p>
              {heading && (
                <p className="rounded-xl bg-gold-soft px-3 py-2 text-xs">Choose images uploaded before, or create the template first and then upload new ones.</p>
              )}
              {PARTS.map((p) => (
                <section key={p.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium">{p.label}</span>
                    {canChange && (
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="sm" disabled>
                          <Images /> Choose
                        </Button>
                        {!heading && (
                          <Button variant="ghost" size="sm" disabled>
                            <Upload /> Upload
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={cn('flex items-center justify-center overflow-hidden rounded-xl border border-dashed bg-white p-1', p.height)}>
                    {heading ? <span className="text-xs text-muted-foreground">None yet</span> : <Skeleton className="size-full rounded-lg" />}
                  </div>
                </section>
              ))}
              <p className="text-xs text-muted-foreground">PNG or JPG, up to 2 MB each. Replaced images are kept.</p>
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
                  Select text, then pick a <strong>font</strong> and <strong>size</strong> - the PDF prints the same. Only the default font can print
                  the ₹ sign.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
