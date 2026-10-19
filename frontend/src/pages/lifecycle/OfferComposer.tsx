/**
 * SOW 3.1: draft an offer or letter of intent. The CTC must equal the breakup.
 * Approval creates the pre-join candidate.
 */
import { useState } from 'react';
import { FileSignature } from 'lucide-react';
import { Button, Drawer, TextField, toast } from '../../ui';
import { apiFetch } from '../../lib/api';
import { todayISOIST } from '../../lib/date';

export function OfferComposer() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<'offer' | 'loi'>('offer');
  const [fullName, setFullName] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [positionTitle, setPositionTitle] = useState('');
  const [offeredCtc, setOfferedCtc] = useState('');
  const [basic, setBasic] = useState('');
  const [hra, setHra] = useState('');
  const [proposedDoj, setProposedDoj] = useState(todayISOIST());
  const [offerDate, setOfferDate] = useState(todayISOIST());

  const submit = async () => {
    const ctc = Number(offeredCtc);
    const basicAnnual = Number(basic);
    const hraAnnual = Number(hra);
    if (!fullName.trim() || !personalEmail.trim() || mobile.trim().length < 8 || !positionTitle.trim()) {
      toast.error('Name, email, mobile and role are required');
      return;
    }
    if (!(ctc > 0) || Math.abs(basicAnnual + hraAnnual - ctc) > 0.5) {
      toast.error('Annual CTC must equal basic plus HRA');
      return;
    }
    setBusy(true);
    try {
      const result = await apiFetch<{ requestId: number; letter: string }>('/api/lifecycle/offers', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          fullName: fullName.trim(),
          personalEmail: personalEmail.trim(),
          mobile: mobile.trim(),
          positionTitle: positionTitle.trim(),
          offeredCtc: ctc,
          breakupAnnual: [
            { code: 'BASIC', annualRupees: basicAnnual },
            { code: 'HRA', annualRupees: hraAnnual },
          ],
          proposedDoj,
          offerDate,
        }),
      });
      toast.success(kind === 'loi' ? 'Letter of intent sent for approval' : 'Offer sent for approval', {
        description: `Request ${String(result.requestId)}. The pre-join record opens after the chain approves.`,
      });
      setOpen(false);
    } catch (cause) {
      toast.error('Could not send the offer', { description: cause instanceof Error ? cause.message : 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" leadingIcon={<FileSignature className="h-4 w-4" />} onClick={() => { setOpen(true); }}>
        Offer / LOI
      </Button>
      <Drawer
        open={open}
        onClose={() => { setOpen(false); }}
        title={kind === 'loi' ? 'Letter of intent' : 'Offer letter'}
        subtitle="The breakup must add up to the annual CTC. Plant head, HR head, then CEO approve it."
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant={kind === 'offer' ? 'primary' : 'ghost'} onClick={() => { setKind('offer'); }}>Offer</Button>
            <Button size="sm" variant={kind === 'loi' ? 'primary' : 'ghost'} onClick={() => { setKind('loi'); }}>Letter of intent</Button>
          </div>
          <TextField label="Full name" value={fullName} onChange={(event) => { setFullName(event.target.value); }} />
          <TextField label="Personal email" value={personalEmail} onChange={(event) => { setPersonalEmail(event.target.value); }} />
          <TextField label="Mobile" value={mobile} onChange={(event) => { setMobile(event.target.value); }} />
          <TextField label="Role" value={positionTitle} onChange={(event) => { setPositionTitle(event.target.value); }} />
          <TextField label="Annual CTC (₹)" value={offeredCtc} onChange={(event) => { setOfferedCtc(event.target.value); }} />
          <TextField label="Basic, annual (₹)" value={basic} onChange={(event) => { setBasic(event.target.value); }} />
          <TextField label="HRA, annual (₹)" value={hra} onChange={(event) => { setHra(event.target.value); }} />
          <TextField label="Offer date" value={offerDate} onChange={(event) => { setOfferDate(event.target.value); }} />
          <TextField label="Proposed joining" value={proposedDoj} onChange={(event) => { setProposedDoj(event.target.value); }} />
          <Button variant="primary" disabled={busy} onClick={() => { void submit(); }}>{busy ? 'Sending…' : 'Send for approval'}</Button>
        </div>
      </Drawer>
    </>
  );
}
