/** LC-01: review the actual submitted application before confirming joining. */
import { useEffect } from 'react';
import { Button, Skeleton } from '../../ui';
import { useDashboardResource } from '../home/useDashboardResource';
interface Application {
  candidateId: number;
  submittedAt: string;
  profile: {
    presentAddress: string;
    permanentAddress: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelation: string;
    bloodGroup: string | null;
    panProvided: boolean;
    aadhaarProvided: boolean;
    uanProvided: boolean;
    bankDetailsProvided: boolean;
  };
}
export function OnboardingApplicationReview({
  candidateId,
  onReady,
}: {
  candidateId: number;
  onReady: (ready: boolean) => void;
}) {
  const resource = useDashboardResource<Application>(
    `/api/lifecycle/candidates/${String(candidateId)}/application`,
  );
  const application = resource.data?.candidateId === candidateId ? resource.data : null;
  const ready = Boolean(application && !resource.error && !resource.loading);
  useEffect(() => {
    onReady(ready);
    return () => {
      onReady(false);
    };
  }, [ready, onReady]);
  if (resource.error)
    return (
      <div role="alert" className="space-y-2">
        <p className="text-sm text-negative-ink">Application could not be loaded: {resource.error}</p>
        <Button variant="secondary" onClick={resource.reload}>
          Retry application
        </Button>
      </div>
    );
  if (!ready || !application)
    return (
      <div role="status" aria-label="Loading submitted application">
        <Skeleton className="h-20 w-full" />
      </div>
    );
  const profile = application.profile;
  const details: [string, string][] = [
    ['Present address', profile.presentAddress],
    ['Permanent address', profile.permanentAddress],
    ['Emergency contact', `${profile.emergencyContactName} · ${profile.emergencyContactRelation}`],
    ['Emergency phone', profile.emergencyContactPhone],
    ['Blood group', profile.bloodGroup ?? 'Not supplied'],
  ];
  const supplied: [string, boolean][] = [
    ['PAN', profile.panProvided],
    ['Aadhaar', profile.aadhaarProvided],
    ['UAN', profile.uanProvided],
    ['Bank details', profile.bankDetailsProvided],
  ];
  return (
    <section aria-label="Submitted application" className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">Submitted application</h3>
      <dl className="space-y-2 text-sm">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="text-ink-muted">{label}</dt>
            <dd className="break-words text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-muted">
        Statutory IDs and bank values are protected. The indicators below show whether details were
        supplied; they do not prove verification.
      </p>
      <ul className="space-y-1 text-sm text-ink">
        {supplied.map(([label, provided]) => (
          <li key={label}>
            {label}: {provided ? 'Supplied' : 'Not supplied'}
          </li>
        ))}
      </ul>
    </section>
  );
}
