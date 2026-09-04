/**
 * The transport contract, in its own file so the concrete transports and the
 * service can both depend on it without depending on each other.
 *
 * `SmtpTransport` importing the interface from `notifications.service.ts`, which
 * in turn constructs an `SmtpTransport`, made a cycle — caught by
 * dependency-cruiser's `no-circular` rule (docs/14 §5). The rule is right: a
 * cycle here would mean the service and its transports could not be reasoned
 * about, or tested, apart.
 */
import type { NotificationRow } from './notifications.repository.js';

export interface NotificationTransport {
  send(notification: NotificationRow): Promise<void>;
}
