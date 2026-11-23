import { Bookmark, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/FormDialog'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

// Saved views of the directory (old HRMS): a name for a search + filters, to open again with one click. The filters
// live in the page address, so a view is that address; views are kept in this browser only (a convenience - the list
// itself never depends on them).

type View = { name: string; query: string }
const KEY = 'employees.savedViews'

function load(): View[] {
  try {
    const views = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(views) ? views.filter((v): v is View => typeof v?.name === 'string' && typeof v?.query === 'string') : []
  } catch {
    return []
  }
}
function store(views: View[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(views))
  } catch {
    // private window / storage blocked: the views just are not kept
  }
}

export function SavedViews({ current, onOpen }: { current: URLSearchParams; onOpen: (query: string) => void }) {
  const [open, setOpen] = useState(false)
  const [views, setViews] = useState(load)
  const [name, setName] = useState('')
  // the page number is not part of a view, nor the People page's tab
  const query = (() => {
    const q = new URLSearchParams(current)
    q.delete('page')
    q.delete('view')
    return q.toString()
  })()
  const save = (next: View[]) => {
    setViews(next)
    store(next)
  }

  return (
    <>
      <Button variant="secondary" className="h-10 rounded-full px-4" onClick={() => setOpen(true)}>
        <Bookmark /> Views
      </Button>
      {open && (
        // a name typed but not saved asks before closing
        <FormDialog onOpenChange={(o) => !o && setOpen(false)} dirty={!!name.trim()} className="rounded-3xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Saved views</DialogTitle>
              <DialogDescription>A search and filters you use often, saved under a name. Kept in this browser.</DialogDescription>
            </DialogHeader>
            {views.length ? (
              <ul className="divide-y divide-border/70 rounded-2xl border border-border">
                {views.map((view) => (
                  <li key={view.name} className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                      onClick={() => {
                        onOpen(view.query)
                        setOpen(false)
                      }}
                    >
                      {view.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${view.name}`}
                      className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                      onClick={() => save(views.filter((v) => v.name !== view.name))}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl bg-surface-2/60 px-4 py-3 text-sm text-muted-foreground">No saved views yet.</p>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const trimmed = name.trim()
                if (!trimmed) return
                save([...views.filter((v) => v.name !== trimmed), { name: trimmed, query }])
                setName('')
              }}
            >
              <Input aria-label="Name of the view" placeholder="Save the current list as…" value={name} onChange={(e) => setName(e.target.value)} />
              <Button type="submit" variant="gold" disabled={!name.trim() || !query}>
                Save
              </Button>
            </form>
            {!query && <p className="-mt-2 text-xs text-muted-foreground">Search or filter the list first - then save it as a view.</p>}
        </FormDialog>
      )}
    </>
  )
}
