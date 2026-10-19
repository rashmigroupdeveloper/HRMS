import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAxe as axe } from '../../test/axe';
import { apiFetch } from '../../lib/api';
import { CompliancePage } from './CompliancePage';

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

describe('CompliancePage (Stage 5.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === '/api/compliance/posture') {
        return Promise.resolve({
          companies: [
            {
              companyId: 1,
              companyName: 'Rashmi Metaliks Limited',
              expired: 1,
              expiring: 1,
              valid: 5,
              perpetual: 2,
            },
            {
              companyId: 2,
              companyName: 'Rashmi Cement Limited',
              expired: 0,
              expiring: 0,
              valid: 6,
              perpetual: 2,
            },
          ],
          overdueFilings: 2,
        });
      }

      if (path.startsWith('/api/compliance/registrations')) {
        return Promise.resolve({
          rows: [
            {
              id: 101,
              companyName: 'Rashmi Metaliks Limited',
              locationName: 'Kharagpur Plant',
              kind: 'factory_licence',
              registrationNo: 'FAC-WB-1002',
              validTo: '2026-11-15',
              renewalOwnerEmail: 'compliance@rashmigroup.com',
              expiry: { state: 'expiring', daysRemaining: 27, stage: 30 },
            },
            {
              id: 102,
              companyName: 'Rashmi Metaliks Limited',
              locationName: null,
              kind: 'pf',
              registrationNo: 'WB/CAL/0012345/000',
              validTo: null,
              renewalOwnerEmail: 'compliance@rashmigroup.com',
              expiry: { state: 'perpetual', daysRemaining: null, stage: null },
            },
          ],
        });
      }

      if (path.startsWith('/api/compliance/calendar')) {
        return Promise.resolve({
          rows: [
            {
              id: 201,
              companyName: 'Rashmi Metaliks Limited',
              obligationCode: 'PF_ECR',
              title: 'PF Monthly ECR Remittance',
              periodLabel: 'Sep 2026',
              dueOn: '2026-10-15',
              ownerEmail: 'compliance@rashmigroup.com',
              status: 'overdue',
              daysUntilDue: -4,
              evidenceCount: 0,
            },
            {
              id: 202,
              companyName: 'Rashmi Cement Limited',
              obligationCode: 'ESIC_MONTHLY',
              title: 'ESIC Contribution Remittance',
              periodLabel: 'Sep 2026',
              dueOn: '2026-10-21',
              ownerEmail: 'compliance@rashmigroup.com',
              status: 'due',
              daysUntilDue: 2,
              evidenceCount: 0,
            },
          ],
        });
      }

      if (path === '/api/compliance/calendar/remind') {
        return Promise.resolve({ ok: true, receipt: { notificationId: 9901, recipientUserId: 10 } });
      }

      if (path === '/api/compliance/calendar/file') {
        return Promise.resolve({ ok: true });
      }

      if (path === '/api/compliance/calendar/waive') {
        return Promise.resolve({ ok: true });
      }

      return Promise.resolve({});
    });
  });

  it('renders posture board with metric tiles and entity conformance', async () => {
    render(<CompliancePage />);

    expect(screen.getByRole('heading', { name: /Registrations, Calendar & Concerns/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Posture/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Licences/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Calendar/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Concerns & Redressal/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Rashmi Metaliks Limited')).toBeInTheDocument();
      expect(screen.getByText('Rashmi Cement Limited')).toBeInTheDocument();
      expect(screen.getByText('1 expired')).toBeInTheDocument();
      expect(screen.getByText('1 expiring')).toBeInTheDocument();
      expect(screen.getByText('In order')).toBeInTheDocument();
    });
  });

  it('navigates to Licences tab and displays registrations with validity and alert actions', async () => {
    render(<CompliancePage />);

    fireEvent.click(screen.getByRole('tab', { name: /Licences/i }));

    await waitFor(() => {
      expect(screen.getByText('Factory licence')).toBeInTheDocument();
      expect(screen.getByText('FAC-WB-1002')).toBeInTheDocument();
      expect(screen.getByText('27 d left')).toBeInTheDocument();
      expect(screen.getByText('PF')).toBeInTheDocument();
      expect(screen.getByText('No expiry')).toBeInTheDocument();
    });
  });

  it('navigates to Calendar tab and records filing evidence with challan reference', async () => {
    render(<CompliancePage />);

    fireEvent.click(screen.getByRole('tab', { name: /Calendar/i }));

    await waitFor(() => {
      expect(screen.getByText('PF Monthly ECR Remittance')).toBeInTheDocument();
      expect(screen.getByText('4 d late')).toBeInTheDocument();
      expect(screen.getByText('ESIC Contribution Remittance')).toBeInTheDocument();
      expect(screen.getByText('due in 2 d')).toBeInTheDocument();
    });

    const recordButtons = screen.getAllByRole('button', { name: /Record filing/i });
    const firstRecord = recordButtons[0];
    if (!firstRecord) throw new Error('Expected record button');
    fireEvent.click(firstRecord);

    const refInput = screen.getByLabelText(/Challan \/ acknowledgement reference/i);
    fireEvent.change(refInput, { target: { value: 'CHLN-2026-10-888999' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Evidence/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/compliance/calendar/file',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            itemId: 201,
            reference: 'CHLN-2026-10-888999',
            documentPath: null,
            remark: null,
          }),
        }),
      );
    });
  });

  it('dispatches reminder receipts for due calendar obligations', async () => {
    render(<CompliancePage />);

    fireEvent.click(screen.getByRole('tab', { name: /Calendar/i }));

    await waitFor(() => {
      expect(screen.getByText('PF Monthly ECR Remittance')).toBeInTheDocument();
    });

    const remindButtons = screen.getAllByRole('button', { name: /Remind/i });
    expect(remindButtons.length).toBeGreaterThan(0);
    const firstRemind = remindButtons[0];
    if (!firstRemind) throw new Error('Expected remind button');
    fireEvent.click(firstRemind);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/compliance/calendar/remind',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ itemId: 201 }),
        }),
      );
    });
  });

  it('passes axe accessibility tests in light and dark modes', async () => {
    const { container } = render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('Rashmi Metaliks Limited')).toBeInTheDocument();
    });

    const lightResults = await axe(container);
    expect(lightResults).toHaveNoViolations();

    container.classList.add('dark');
    const darkResults = await axe(container);
    expect(darkResults).toHaveNoViolations();
  });
});
