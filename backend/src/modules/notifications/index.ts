/** Notifications module public API (module pattern — see ../README.md). */
export {
  enqueue,
  enqueueEvent,
  processQueue,
  devLogTransport,
  type NotificationTransport,
} from './notifications.service.js';
