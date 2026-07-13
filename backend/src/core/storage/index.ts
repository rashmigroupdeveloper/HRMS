/** Storage public API — the document registry. The adapter itself stays
 *  internal: consumers store/read documents, never raw objects. */
export type { StorageAdapter } from './storage.js';
export { createDocument, readDocument, type CreateDocumentInput } from './documents.js';
