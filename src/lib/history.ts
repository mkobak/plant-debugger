// Local diagnosis history: completed reports stored in IndexedDB so a
// finished diagnosis isn't lost when a new one is started. Device-local
// only, capped at MAX_HISTORY_ENTRIES (oldest evicted first).

import { DiagnosisResult } from '@/types';
import { openDB, HISTORY_STORE } from './persistence';
import { logger } from '@/lib/logger';

export const MAX_HISTORY_ENTRIES = 12;

export interface HistoryEntry {
  id: string;
  createdAt: number; // epoch ms
  plant: string;
  diagnosisResult: DiagnosisResult;
  /** Small JPEG data URL of the first uploaded image, if available. */
  thumbnail: string | null;
}

/** Pure: given all entries, returns the ids to evict to respect the cap. */
export function entriesToEvict(
  entries: Array<{ id: string; createdAt: number }>,
  max: number = MAX_HISTORY_ENTRIES
): string[] {
  if (entries.length <= max) return [];
  return [...entries]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(max)
    .map((e) => e.id);
}

export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDB();
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    store.put(entry);
    // Evict oldest entries beyond the cap
    const allReq = store.getAll();
    allReq.onsuccess = () => {
      const all = (allReq.result || []) as HistoryEntry[];
      for (const id of entriesToEvict(all)) {
        store.delete(id);
      }
    };
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error || new Error('Transaction failed'));
      tx.onabort = () => rej(tx.error || new Error('Transaction aborted'));
    });
    db.close();
  } catch (e) {
    logger.warn('[history] save failed', e);
  }
}

export async function listHistoryEntries(): Promise<HistoryEntry[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDB();
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const req = tx.objectStore(HISTORY_STORE).getAll();
    const entries: HistoryEntry[] = await new Promise((res, rej) => {
      req.onsuccess = () => res((req.result || []) as HistoryEntry[]);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return entries.sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    logger.warn('[history] list failed', e);
    return [];
  }
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDB();
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.objectStore(HISTORY_STORE).delete(id);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error || new Error('Transaction failed'));
      tx.onabort = () => rej(tx.error || new Error('Transaction aborted'));
    });
    db.close();
  } catch (e) {
    logger.warn('[history] delete failed', e);
  }
}

/** Downscales an image file to a small JPEG data URL for list thumbnails. */
export async function makeThumbnail(
  file: File,
  maxSize = 96
): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = maxSize / Math.max(bitmap.width, bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (e) {
    logger.warn('[history] thumbnail failed', e);
    return null;
  }
}
