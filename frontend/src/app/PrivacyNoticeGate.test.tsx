/**
 * Privacy notice gate — blocking acknowledgement (PRV-01).
 * 404 from notice-status must leave the app usable (backend may not be wired yet).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrivacyNoticeGate } from './PrivacyNoticeGate';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('PrivacyNoticeGate', () => {
  it('renders nothing when notice-status returns 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          text: () => Promise.resolve('{"message":"Not found"}'),
        }),
      ),
    );

    const { container } = render(<PrivacyNoticeGate />);
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('blocks until the notice is acknowledged', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/privacy/notice-status') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              required: true,
              notice: {
                id: 7,
                version: 2,
                title: 'How we use your data',
                body: 'We process employment data under the DPDP Act.',
              },
            }),
        });
      }
      if (path === '/api/privacy/notice/ack' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('{}'),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<PrivacyNoticeGate />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How we use your data' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'I acknowledge' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/privacy/notice/ack',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('stays silent when acknowledgement is not required', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ required: false }),
        }),
      ),
    );

    const { container } = render(<PrivacyNoticeGate />);
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
