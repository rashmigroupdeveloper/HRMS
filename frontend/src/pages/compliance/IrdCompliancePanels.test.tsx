/**
 * Stage 5.5 — POSH / grievance / whistleblower component tests.
 *
 * Verifies:
 * - Honest IC status banner (never invent committee members).
 * - Authenticated complaint submission.
 * - Anonymous complaint submission with claim code generation.
 * - Tab switching across POSH, Grievance, and Whistleblower sections.
 * - Axe contrast and accessibility compliance in both light and dark themes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderThemed, THEMES } from '../../test/render';
import { runAxe } from '../../test/axe';
import { apiFetch } from '../../lib/api';
import { IrdCompliancePanels } from './IrdCompliancePanels';

vi.mock('../../lib/api', () => {
  class MockApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  }
  return {
    apiFetch: vi.fn(),
    ApiError: MockApiError,
  };
});

describe('IrdCompliancePanels', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (path === '/api/ird/ic') {
        return Promise.resolve({
          members: [],
          constituted: false,
          banner: 'IC not constituted — awaiting sponsor appointment',
        });
      }
      if (path === '/api/ird/posh/cases') {
        return Promise.resolve({ cases: [] });
      }
      if (path === '/api/ird/grievances/mine') {
        return Promise.resolve({ grievances: [] });
      }
      if (path === '/api/ird/grievances') {
        return Promise.resolve({ grievances: [] });
      }
      if (path === '/api/ird/whistle/reports') {
        return Promise.resolve({ reports: [] });
      }
      return Promise.resolve({});
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders the honest sponsor-awaiting IC banner by default', async () => {
    renderThemed(<IrdCompliancePanels />);

    expect(
      await screen.findByText('IC not constituted — awaiting sponsor appointment'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Zero members seeded — formal appointment of the Internal Committee/i),
    ).toBeInTheDocument();
  });

  it('allows submitting an authenticated POSH complaint', async () => {
    vi.mocked(apiFetch).mockImplementation((path, init) => {
      if (path === '/api/ird/posh/file' && init?.method === 'POST') {
        return Promise.resolve({ id: 101, caseRef: 'POSH-2026-00101' });
      }
      if (path === '/api/ird/ic') {
        return Promise.resolve({
          members: [],
          constituted: false,
          banner: 'IC not constituted — awaiting sponsor appointment',
        });
      }
      return Promise.resolve({ cases: [] });
    });

    renderThemed(<IrdCompliancePanels />);

    const textarea = await screen.findByLabelText(/Incident Description & Specifics/i);
    const submitBtn = screen.getByRole('button', { name: /Submit to Inquiry Intake/i });

    expect(submitBtn).toBeDisabled();

    await userEvent.type(
      textarea,
      'Detailed report of inappropriate conduct during the team review meeting.',
    );
    expect(submitBtn).not.toBeDisabled();

    await userEvent.click(submitBtn);

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/ird/posh/file',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('generates a 64-char claim code for anonymous filings', async () => {
    const claimToken = 'a'.repeat(64);
    vi.mocked(apiFetch).mockImplementation((path, init) => {
      if (path === '/api/ird/posh/file-anonymous' && init?.method === 'POST') {
        return Promise.resolve({ id: 102, caseRef: 'POSH-2026-00102', claimToken });
      }
      if (path === '/api/ird/ic') {
        return Promise.resolve({
          members: [],
          constituted: false,
          banner: 'IC not constituted — awaiting sponsor appointment',
        });
      }
      return Promise.resolve({ cases: [] });
    });

    renderThemed(<IrdCompliancePanels />);

    const anonRadio = await screen.findByLabelText(/Anonymous \(QR Channel\)/i);
    await userEvent.click(anonRadio);

    const textarea = screen.getByLabelText(/Incident Description & Specifics/i);
    await userEvent.type(
      textarea,
      'Anonymous disclosure regarding safety and harassment at plant gate 2.',
    );

    const submitBtn = screen.getByRole('button', { name: /Submit Anonymously/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText('Anonymous Claim Code (Store Safely)')).toBeInTheDocument();
    expect(screen.getByText(claimToken)).toBeInTheDocument();
  });

  it('switches between POSH, Grievance, and Whistleblower tabs', async () => {
    renderThemed(<IrdCompliancePanels />);

    // Click Grievance tab
    const grvTab = await screen.findByRole('tab', { name: /Workplace Grievances/i });
    await userEvent.click(grvTab);
    expect(await screen.findByText('Raise a workplace grievance')).toBeInTheDocument();

    // Click Whistleblower tab
    const whistleTab = screen.getByRole('tab', { name: /Whistleblower Disclosures/i });
    await userEvent.click(whistleTab);
    expect(await screen.findByText('Make a protected disclosure')).toBeInTheDocument();
  });

  it.each(THEMES)('passes axe accessibility checks in theme %s', async (theme) => {
    const { container } = renderThemed(<IrdCompliancePanels />, theme);
    await screen.findByText('IC not constituted — awaiting sponsor appointment');
    await runAxe(container);
  });
});
