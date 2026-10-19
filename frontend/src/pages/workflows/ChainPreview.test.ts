import { describe, expect, it } from 'vitest';
import { stepsToTimeline, type ChainPreviewStep } from './ChainPreview';

describe('chain preview strip (SHF-16)', () => {
  it('names the live approver, the SLA, and a vacant skip', () => {
    const steps: ChainPreviewStep[] = [
      {
        step: 1,
        approverSpec: 'reporting_manager',
        slaHours: 48,
        vacant: false,
        userId: 4,
        displayName: 'Priya Sen',
        delegatedFromUserId: null,
        delegatedFromName: null,
      },
      {
        step: 2,
        approverSpec: 'role:hr_ops',
        slaHours: 72,
        vacant: true,
        userId: null,
        displayName: null,
        delegatedFromUserId: null,
        delegatedFromName: null,
      },
    ];
    const timeline = stepsToTimeline(steps);
    expect(timeline[0]?.title).toBe('Priya Sen');
    expect(timeline[0]?.timestamp).toBe('48h SLA');
    expect(timeline[0]?.state).toBe('current');
    expect(timeline[1]?.title).toContain('vacant');
    expect(timeline[1]?.title).toContain('hr ops');
  });

  it('calls out a delegated approver instead of hiding the cutoff', () => {
    const timeline = stepsToTimeline([
      {
        step: 1,
        approverSpec: 'reporting_manager',
        slaHours: 48,
        vacant: false,
        userId: 9,
        displayName: 'Acting Lead',
        delegatedFromUserId: 4,
        delegatedFromName: 'Priya Sen',
      },
    ]);
    expect(timeline[0]?.description).toContain('Priya Sen');
  });
});
