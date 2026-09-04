/** Notifications module public API (module pattern — see ../README.md). */
export {
  enqueue,
  enqueueEvent,
  processQueue,
  drainNotifications,
  resolveTransport,
  resetTransport,
  devLogTransport,
  type NotificationTransport,
} from './notifications.service.js';
export { countDeadNotifications } from './notifications.repository.js';
