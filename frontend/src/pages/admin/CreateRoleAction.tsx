import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStepUpAction } from '../../app/useStepUpAction';
import { apiFetch } from '../../lib/api';
import { Button, Drawer, TextField, toast } from '../../ui';

/** CORE-10: new roles start empty; Super Admin delegates authority in the existing matrix. */
export function CreateRoleAction({ onCreated }: { onCreated: () => void }) {
  const stepUp = useStepUpAction();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function create() {
    setBusy(true); setError(null);
    try {
      await stepUp.run(() => apiFetch('/api/rbac/roles', {
        method: 'POST', body: JSON.stringify({ code: code.trim(), name: name.trim() }),
      }), `Create the empty role ${name.trim()}.`);
      setOpen(false); setCode(''); setName(''); onCreated();
      toast.success('Role created', { description: 'Grant its permissions, then assign it to users.' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create the role.'); }
    finally { setBusy(false); }
  }
  return <>
    {stepUp.dialog}
    <Button leadingIcon={<Plus />} onClick={() => { setOpen(true); }}>Create role</Button>
    <Drawer open={open} onClose={() => { if (!busy) setOpen(false); }} title="Create role"
      footer={<Button loading={busy} disabled={!/^[a-z][a-z0-9_]{1,49}$/.test(code.trim()) || name.trim().length < 2} onClick={() => void create()}>Create empty role</Button>}>
      <div className="space-y-4">
        <TextField label="Role code" value={code} onChange={event => { setCode(event.target.value); }} hint="Lowercase letters, digits and underscores; start with a letter." />
        <TextField label="Role name" value={name} onChange={event => { setName(event.target.value); }} />
        <p className="text-sm text-ink-muted">New roles have no permissions. Use the matrix to delegate configuration or operational access explicitly.</p>
        {error && <p role="alert" className="text-sm text-negative-ink">{error}</p>}
      </div>
    </Drawer>
  </>;
}
