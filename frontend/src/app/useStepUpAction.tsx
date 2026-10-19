/** SEC-04: retain the interrupted action and form; never persist passwords. */
import { useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '../lib/api';
import { ConfirmModal, TextField } from '../ui';
interface Challenge {
  reason: string;
  resolve: () => void;
  reject: (error: Error) => void;
}
export function useStepUpAction() {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const pending = useRef<Challenge | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  useEffect(
    () => () => {
      pending.current?.reject(new Error('Password confirmation closed'));
      pending.current = null;
    },
    [],
  );
  const close = () => {
    if (submitting.current) return;
    pending.current?.reject(new Error('Access change cancelled'));
    pending.current = null;
    setChallenge(null);
    setPassword('');
    setError(undefined);
  };
  const submit = async () => {
    if (submitting.current || !password || !pending.current) return;
    const request = pending.current;
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await apiFetch('/api/auth/step-up', { method: 'POST', body: JSON.stringify({ password }) });
      if (pending.current !== request) return;
      request.resolve();
      pending.current = null;
      setChallenge(null);
      setPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Password verification failed');
      setPassword('');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  async function run<T>(action: () => Promise<T>, reason: string): Promise<T> {
    try {
      return await action();
    } catch (cause) {
      if (!(cause instanceof ApiError) || cause.code !== 'STEP_UP_REQUIRED') throw cause;
    }
    if (pending.current) throw new Error('Finish the current password confirmation first');
    await new Promise<void>((resolve, reject) => {
      const request = { reason, resolve, reject };
      pending.current = request;
      setPassword('');
      setError(undefined);
      setChallenge(request);
    });
    return action();
  }
  const dialog = (
    <ConfirmModal
      open={challenge !== null}
      onClose={close}
      title="Confirm it’s you"
      description={
        <div className="space-y-4">
          <p>{challenge?.reason}</p>
          <TextField
            label="Your password"
            type="password"
            autoComplete="current-password"
            value={password}
            error={error}
            disabled={busy}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void submit();
              }
            }}
          />
        </div>
      }
      confirmLabel="Confirm and continue"
      closeOnConfirm={false}
      confirmDisabled={!password}
      loading={busy}
      onConfirm={() => {
        void submit();
      }}
    />
  );
  return { run, dialog };
}
