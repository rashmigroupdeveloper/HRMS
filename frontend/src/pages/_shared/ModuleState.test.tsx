/**
 * The honesty scaffolding (docs/05 §4.8 — "never fake data").
 *
 * Eleven Phase 2–4 screens depend on these two pieces. What matters is that a
 * screen whose backend does not exist yet says SO — naming the phase, the plan
 * task and the endpoint — instead of rendering plausible-looking numbers. In a
 * payroll system a fabricated figure is indistinguishable from a real one.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { ModuleHeader, PendingModule } from './ModuleState';
import { renderRouted, THEMES, type Theme } from '../../test/render';
import { runAxe } from '../../test/axe';

describe('PendingModule', () => {
  it('names the phase, the task and the endpoint so the gap is traceable', () => {
    renderRouted(
      <PendingModule
        phase="Phase 2"
        task="P2-T04"
        endpoint="/api/payroll/runs"
        description="The compute engine and statutory calculators."
      />,
    );

    expect(screen.getByText(/Awaiting the Phase 2 backend/)).toBeInTheDocument();
    expect(screen.getByText('P2-T04')).toBeInTheDocument();
    expect(screen.getByText('/api/payroll/runs')).toBeInTheDocument();
    expect(screen.getByText(/compute engine/)).toBeInTheDocument();
  });

  it('states plainly that nothing is shown rather than showing invented data', () => {
    renderRouted(<PendingModule phase="Phase 3" task="AST-01" description="Asset registry." />);
    expect(
      screen.getByText(/numbers that were never computed/),
    ).toBeInTheDocument();
  });

  it('renders without an endpoint', () => {
    renderRouted(<PendingModule phase="Phase 4" task="ATS" description="Requisitions." />);
    expect(screen.getByText('Phase 4')).toBeInTheDocument();
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme: Theme) => {
    const { container } = renderRouted(
      <PendingModule
        phase="Phase 2"
        task="P2-T04"
        endpoint="/api/payroll/runs"
        description="The compute engine."
      />,
      theme,
    );
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});

describe('ModuleHeader', () => {
  it('renders a single h1 — one page, one top-level heading', () => {
    renderRouted(
      <ModuleHeader eyebrow="Payroll · M4" title="Payroll console" intro="One run per screen." />,
    );

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Payroll console');
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme: Theme) => {
    const { container } = renderRouted(
      <ModuleHeader eyebrow="Assets · M8" title="Asset registry" intro="What the company owns." />,
      theme,
    );
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});
