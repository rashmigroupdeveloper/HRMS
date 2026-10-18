/**
 * Employee lifecycle (M5, LC-01..07) — docs/05 §4.6.
 *
 * Three boards behind one route: onboarding, probation, separation.
 * Stage 3.1: Onboarding bridge & Probation review boards are fully LIVE.
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, StatusBadge } from '../../ui';
import { useModuleResource } from '../_shared/useModuleResource';
import { OnboardingBoardPage } from './OnboardingBoardPage';
import { ProbationBoardPage } from './ProbationBoardPage';
import { SeparationBoardPage } from './SeparationBoardPage';
import { TransfersPage } from './TransfersPage';

type Board = 'onboarding' | 'probation' | 'transfers' | 'separation';

interface BoardingExit {
  joins: unknown[];
  exits: unknown[];
}

const BOARDS: { code: Board; label: string; task: string }[] = [
  {
    code: 'onboarding',
    label: 'Onboarding',
    task: 'LC-01 / LC-02',
  },
  {
    code: 'probation',
    label: 'Probation',
    task: 'LC-04',
  },
  {
    code: 'transfers',
    label: 'Transfers',
    task: 'LC-05 / Mobility',
  },
  {
    code: 'separation',
    label: 'Separations',
    task: 'LC-06 / PAY-15',
  },
];

export function LifecyclePage() {
  const location = useLocation();
  const initialBoard: Board = location.pathname.includes('/probation')
    ? 'probation'
    : location.pathname.includes('/transfers')
    ? 'transfers'
    : location.pathname.includes('/separation')
    ? 'separation'
    : 'onboarding';

  const [board, setBoard] = useState<Board>(initialBoard);

  // Live 07:00 plant joining/exit register
  const today = new Date().toISOString().slice(0, 10);
  const boarding = useModuleResource<BoardingExit>(
    `/api/lifecycle/boarding-exit?from=${today}&to=${today}`,
  );

  return (
    <div className="space-y-8">
      {/* Top Level Board Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex min-w-0 max-w-full overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none] [&>*]:shrink-0">
          {BOARDS.map((b) => (
            <Button
              key={b.code}
              size="sm"
              variant={board === b.code ? 'primary' : 'ghost'}
              onClick={() => {
                setBoard(b.code);
              }}
            >
              {b.label}
            </Button>
          ))}
        </div>

        {/* Live Daily Joins & Exits Quick Pill */}
        <div className="flex items-center gap-2">
          {boarding.loading ? (
            <StatusBadge tone="neutral">Checking daily register…</StatusBadge>
          ) : boarding.data ? (
            <Link to="/reports/r24-boarding" className="flex items-center gap-2">
              <StatusBadge tone="positive">
                {boarding.data.joins.length} joining today
              </StatusBadge>
              <StatusBadge tone="info">
                {boarding.data.exits.length} exiting today
              </StatusBadge>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Render active board */}
      {board === 'onboarding' && <OnboardingBoardPage />}

      {board === 'probation' && <ProbationBoardPage />}

      {board === 'transfers' && <TransfersPage />}

      {board === 'separation' && <SeparationBoardPage />}
    </div>
  );
}
