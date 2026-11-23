import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile as copyOnDisk, mkdir, readFile, rm, rmdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { DetectedFileType } from '#shared/utils/file-type'
import { today } from '#shared/utils/dates'
import { env } from '../config/env.js'

// File storage for uploaded and generated files (documents, offer letters, letterhead images). Files live on the
// server's disk under STORAGE_DIR; they are never served directly - only through the API, after its access checks.
// Moving to cloud storage (S3 / Azure) later means changing only this file (see BACKLOG.md).
//
// Names are readable without the database (CLAUDE.md section 3, "Stored files"):
//   <area>/<owner>/<what>/<date>_<random>.<ext>
//   e.g. employees/RML035384/AADHAAR_COPY/2026-11-13_7f3a9c21.pdf
// Keys are built only here, from cleaned parts - never from raw request values - so no path tricks are possible.

const root = resolve(env.STORAGE_DIR)

// Where a file belongs: the kind of record (`area`, e.g. "candidates"), the record's lasting business key (`owner`,
// one folder per part, e.g. ["RML", "RML/OFFER/2026/0001"]) and what the file is (`what`, e.g. "AADHAAR_COPY").
export type FilePlace = { area: string; owner: string[]; what: string }

const EXTENSION: Record<DetectedFileType, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }

// Folders of letters, digits, "_" and "-", and a file name with one extension. Older keys ("<folder>/<uuid>") match
// too, so files stored before the readable names can still be read (and renamed by scripts/rename-stored-files.ts).
const KEY_PATTERN = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*(\.[a-z0-9]+)?$/
const OLD_KEY_PATTERN = /^[a-z0-9-]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// One folder name from a business value: anything but letters, digits, "_" and "-" becomes "-", at most 60 characters
function folderName(value: string): string {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '')
  return cleaned || 'unnamed'
}

// The owner part for a record known by id + name: (183, "Neha Das") -> "183-neha-das"
export function namedOwner(id: number, name: string): string {
  return folderName(`${id}-${name}`.toLowerCase())
}

function folderOf({ area, owner, what }: FilePlace): string {
  return [area, ...owner, what].map(folderName).join('/')
}

// "2026-11-13_7f3a9c21.pdf" - the day it was stored (server's local date) and a random part, so two never clash
function newFileName(storedOn: Date, type: DetectedFileType): string {
  // India's calendar day
  const day = today(storedOn).toISOString().slice(0, 10)
  return `${day}_${randomBytes(4).toString('hex')}.${EXTENSION[type]}`
}

function pathOf(storageKey: string): string {
  if (!KEY_PATTERN.test(storageKey)) throw new Error(`Invalid storage key: ${storageKey}`)
  return join(root, storageKey)
}

async function writeNew(storageKey: string, bytes: Uint8Array) {
  const path = pathOf(storageKey)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes, { flag: 'wx' })
}

// Saves the bytes as a new file in `place` and returns its key. `type` is the detected file type (never the
// uploaded name - that is kept in the database).
export async function saveFile(place: FilePlace, type: DetectedFileType, bytes: Uint8Array): Promise<string> {
  const storageKey = `${folderOf(place)}/${newFileName(new Date(), type)}`
  await writeNew(storageKey, bytes)
  return storageKey
}

// Copies a stored file to another owner's folder and returns the new key; the original stays until the caller
// deletes it (after its database change is saved). Keeps the file name (the day it was first stored).
// A file with an older key ("<folder>/<uuid>") gets a readable name: `type` and the day it was stored (default: the
// file's last change on disk).
export async function copyFile(fromKey: string, place: FilePlace, older?: { type: DetectedFileType; storedOn?: Date }): Promise<string> {
  const from = pathOf(fromKey)
  let name = fromKey.split('/').pop()!
  if (isOldKey(fromKey)) {
    if (!older) throw new Error(`The type of ${fromKey} is needed to give it a readable name`)
    name = newFileName(older.storedOn ?? (await stat(from)).mtime, older.type)
  }
  const storageKey = `${folderOf(place)}/${name}`
  const to = pathOf(storageKey)
  await mkdir(dirname(to), { recursive: true })
  await copyOnDisk(from, to, constants.COPYFILE_EXCL)
  return storageKey
}

// A key from before the readable names ("candidates/<uuid>")
export function isOldKey(storageKey: string): boolean {
  return OLD_KEY_PATTERN.test(storageKey)
}

export function readStoredFile(storageKey: string): Promise<Buffer> {
  return readFile(pathOf(storageKey))
}

// Deleting a file that is already gone is not an error. Folders left empty (e.g. a candidate's, once the files moved
// to the employee) are removed too, up to the area folder.
export async function deleteFile(storageKey: string): Promise<void> {
  const path = pathOf(storageKey)
  await rm(path, { force: true })
  const parts = storageKey.split('/')
  for (let depth = parts.length - 1; depth > 1; depth--) {
    try {
      await rmdir(join(root, ...parts.slice(0, depth)))
    } catch {
      return // not empty (or already gone)
    }
  }
}
