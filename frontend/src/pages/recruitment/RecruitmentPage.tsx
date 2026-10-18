/**
 * Recruitment / ATS absorption (Phase 4).
 *
 * The in-house ATS already runs hiring and is the design authority for this
 * product. Phase 4 absorbs it rather than rebuilding it. Until then this
 * screen explains that promise and invents no pipeline.
 */
import { GitMerge, Handshake, Users2 } from 'lucide-react';
import { Card, DarkCard, PageHeader } from '../../ui';
import { PendingModule } from '../_shared/ModuleState';
import { useModuleResource } from '../_shared/useModuleResource';

interface Requisition {
  id: number;
  title: string;
}

const ALREADY_TRUE = [
  {
    icon: Handshake,
    title: 'Offers already become joiners',
    body: 'The ATS joined list already feeds onboarding every night, with the offer details attached.',
  },
  {
    icon: GitMerge,
    title: 'Hiring reports already read across',
    body: 'Offer and recruitment reports already pull from the ATS, so HR is not waiting on a rebuild to see the numbers.',
  },
  {
    icon: Users2,
    title: 'Contract workers stay a later conversation',
    body: 'That workstream needs its own requirements with HR and plant ops before anything is built.',
  },
];

export function RecruitmentPage() {
  const requisitions = useModuleResource<Requisition[]>('/api/recruitment/requisitions');

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recruitment"
        title="Hiring"
        description="Hiring already happens in the in-house ATS. This space will bring requisitions, interviews and offers into the same platform — when that work is scheduled."
      />

      <DarkCard padded={false} className="p-8 md:p-10">
        <p className="text-sm font-medium text-hero-muted">
          What you will do here
        </p>
        <h2 className="mt-4 max-w-xl text-4xl font-light tracking-tight text-hero-ink">
          Hiring is on its way to HRMS.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-hero-muted">
          You will run requisitions, interviews and offers here once hiring moves into HRMS. Until
          then, keep using the current hiring system.
        </p>
      </DarkCard>

      <div className="grid gap-4 sm:grid-cols-3">
        {ALREADY_TRUE.map((item) => (
          <Card key={item.title}>
            <item.icon className="size-5 text-ink-subtle" />
            <p className="mt-3 text-sm font-semibold text-ink">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">{item.body}</p>
          </Card>
        ))}
      </div>

      {requisitions.pending || requisitions.data === null ? (
        <PendingModule
          phase="Phase 4"
          task="ATS absorption"
          description="Requisitions, interviews and offers will appear here once hiring moves into HRMS."
        />
      ) : null}
    </div>
  );
}
