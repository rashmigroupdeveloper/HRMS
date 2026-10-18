import { useEffect, useId, useState } from 'react';
import { Camera, FileText, X } from 'lucide-react';
import { cn } from './cn';

/**
 * ReceiptCapture — one-thumb bill photo on phones (`capture="environment"`
 * opens the rear camera), file picker on desktop. Shows a preview so the
 * employee can check the photo is legible before submitting.
 *
 * The file stays in the browser: it is handed to `onChange` for the caller to
 * upload when a document endpoint exists. Never sent anywhere by this control.
 */
export function ReceiptCapture({
  label = 'Bill photo',
  onChange,
  className,
}: {
  label?: string;
  onChange?: (file: File | null) => void;
  className?: string;
}) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file?.type.startsWith('image/')) {
      setUrl(null);
      return undefined;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
    };
  }, [file]);

  const pick = (next: File | null): void => {
    setFile(next);
    onChange?.(next);
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {file === null ? (
        <label
          htmlFor={id}
          className="u-press inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line-strong hover:bg-accent-soft focus-within:ring-2 focus-within:ring-focus"
        >
          <Camera aria-hidden className="size-4" />
          {label}
          <input
            id={id}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              pick(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </label>
      ) : (
        <div className="flex min-w-0 items-center gap-3 rounded-row bg-surface p-1.5 pr-2 ring-1 ring-line">
          {url !== null ? (
            <img src={url} alt={`Preview of ${file.name}`} className="size-11 rounded-[10px] object-cover" />
          ) : (
            <span className="grid size-11 place-items-center rounded-[10px] bg-surface-2">
              <FileText aria-hidden className="size-5 text-ink-muted" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{file.name}</p>
            <p className="text-xs tabular-nums text-ink-muted">{Math.max(1, Math.round(file.size / 1024))} KB</p>
          </div>
          <button
            type="button"
            onClick={() => {
              pick(null);
            }}
            aria-label={`Remove ${file.name}`}
            className="u-tap grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
