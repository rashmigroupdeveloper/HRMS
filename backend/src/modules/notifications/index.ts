/** Notifications module public API (module pattern — see ../README.md). */
export {
  enqueue,
  enqueueEvent,
  processQueue,
  devLogTransport,
  SmtpNotificationTransport,
  createNotificationTransport,
  formatEmailSubject,
  formatEmailText,
  formatEmailHtml,
  type NotificationTransport,
  type SmtpTransportOptions,
} from './notifications.service.js';
