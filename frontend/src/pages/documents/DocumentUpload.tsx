/** DOC-02: preserve an upload draft until the server confirms it. */
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { fileToBase64 } from '../../lib/files';
import { Button, Card, CardHeader, DatePicker, Select, toast } from '../../ui';
import type { DocType } from './documents.types';
interface Props {
  catalog: DocType[];
  maxBytes: number | null;
  employeeCode: string;
  managed: boolean;
  onUploaded: () => Promise<void>;
}
export function DocumentUpload({ catalog, maxBytes, employeeCode, managed, onUploaded }: Props) {
  const [documentType, setDocumentType] = useState(catalog[0]?.code ?? '');
  const [expiresOn, setExpiresOn] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const endpoint = managed ? '/api/documents' : '/api/documents/mine';
  const selected = catalog.find((type) => type.code === documentType);
  const upload = async () => {
    if (!file || !selected || maxBytes === null) {
      setFormError('Choose a document type and a file.');
      return;
    }
    if (managed && !employeeCode) {
      setFormError('Choose an employee code and apply the filter first.');
      return;
    }
    if (file.size > maxBytes) {
      setFormError(
        `Use a file no larger than ${(maxBytes / 1_000_000).toLocaleString('en-IN')} MB.`,
      );
      return;
    }
    if (selected.typicallyExpires && !expiresOn) {
      setFormError('Enter the document expiry date.');
      return;
    }
    setBusy(true);
    setFormError(undefined);
    try {
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          documentType,
          fileName: file.name,
          mime: file.type,
          content: await fileToBase64(file),
          expiresOn: expiresOn || null,
          ...(managed ? { employeeCode } : {}),
        }),
      });
      if (!mounted.current) return;
      setFile(null);
      setExpiresOn('');
      if (fileInput.current) fileInput.current.value = '';
      toast.success('Document uploaded', {
        description: managed ? `Employee ${employeeCode}` : 'Your employee record',
      });
      await onUploaded();
    } catch (cause) {
      if (!mounted.current) return;
      setFormError(
        cause instanceof Error
          ? cause.message
          : 'Upload failed. Your file selection has been kept.',
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader
        title="Upload a document"
        subtitle={
          maxBytes === null
            ? 'Loading upload limits…'
            : `PDF, PNG or JPEG, up to ${(maxBytes / 1_000_000).toLocaleString('en-IN')} MB. Identity documents have additional access restrictions.`
        }
      />
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void upload();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Document type"
            value={documentType}
            options={catalog.map((type) => ({ value: type.code, label: type.name }))}
            disabled={busy || !catalog.length}
            onChange={(value) => {
              setDocumentType(value);
              setExpiresOn('');
            }}
            required
          />
          {selected?.typicallyExpires && (
            <DatePicker label="Expires on" value={expiresOn || null} onChange={setExpiresOn} />
          )}
          <label className="space-y-2 text-sm text-ink">
            <span className="block font-medium">File</span>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              disabled={busy}
              className="block w-full rounded-row bg-surface-2 p-3 focus-visible:outline-2 focus-visible:outline-focus"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setFormError(undefined);
              }}
            />
          </label>
        </div>
        {formError && (
          <p role="alert" className="text-sm text-negative-ink">
            {formError}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={busy}
          disabled={!file || maxBytes === null || !documentType}
        >
          Upload
        </Button>
      </form>
    </Card>
  );
}
