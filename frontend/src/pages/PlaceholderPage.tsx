/**
 * Coming-soon / phase-deferred surface — keeps deep links valid (docs/05 §7)
 * without inventing unfinished product UI.
 */
import { EmptyState } from '../ui';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({
  title,
  description = 'This screen ships with a later plan stage. Navigation and deep links are already wired.',
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light tracking-tight text-ink">{title}</h1>
      </div>
      <EmptyState icon={<Construction />} title={title} description={description} />
    </div>
  );
}
