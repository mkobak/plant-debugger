// Client-side persistence utilities for Plant Debugger
// Uses IndexedDB (no external deps) to persist diagnosis session state across refreshes/tab closes.
// Only explicit Reset clears persisted data.

import {
  PlantImage,
  PlantIdentification,
  DiagnosticQuestion,
  DiagnosticAnswer,
  DiagnosisResult,
} from '@/types';

import { logger } from '@/lib/logger';
const DB_NAME = 'plantDebuggerDB';
const IMAGE_STORE = 'images';
const STATE_STORE = 'state';
const STATE_KEY = 'diagnosis';
export const HISTORY_STORE = 'history';
const REQUIRED_STORES = [IMAGE_STORE, STATE_STORE, HISTORY_STORE];

interface PersistedImageMeta {
  id: string;
  type: string; // MIME type
  compressed?: boolean;
  size: number;
  // We don't store url (objectURL) because we recreate it on restore
}

interface PersistedState {
  // Image ids in order (actual blobs stored separately)
  images: PersistedImageMeta[];
  plantIdentification: PlantIdentification | null;
  questions: DiagnosticQuestion[];
  answers: DiagnosticAnswer[];
  additionalComments: string;
  noPlantMessage: string;
  diagnosisResult: DiagnosisResult | null;
  lastDiagnosisSignature: string | null;
  lastQAImagesSignature: string | null;
}

function openRaw(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('No window'));
      return;
    }
    const request = version
      ? indexedDB.open(DB_NAME, version)
      : indexedDB.open(DB_NAME);
    // A version upgrade blocked by another open connection (other tab, or a
    // concurrent load in this one) would otherwise leave this promise pending
    // forever — reject instead so callers fall back gracefully.
    const timeout = window.setTimeout(() => {
      reject(new Error('IndexedDB open timed out (upgrade blocked?)'));
    }, 4000);
    request.onerror = () => {
      window.clearTimeout(timeout);
      reject(request.error);
    };
    request.onblocked = () => {
      logger.warn(
        '[persistence] DB upgrade blocked by another open connection'
      );
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE);
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      window.clearTimeout(timeout);
      resolve(request.result);
    };
  });
}

/**
 * Opens the DB and guarantees all expected object stores exist. Rather than
 * a hardcoded version, missing stores trigger a one-version bump so the
 * schema self-heals even after an interrupted upgrade left the version
 * incremented without its stores.
 */
export async function openDB(): Promise<IDBDatabase> {
  let db = await openRaw();
  const missing = REQUIRED_STORES.some(
    (store) => !db.objectStoreNames.contains(store)
  );
  if (missing) {
    const nextVersion = db.version + 1;
    db.close();
    db = await openRaw(nextVersion);
  }
  return db;
}

export async function saveDiagnosisState(params: {
  images: PlantImage[];
  plantIdentification: PlantIdentification | null;
  questions: DiagnosticQuestion[];
  answers: DiagnosticAnswer[];
  additionalComments: string;
  noPlantMessage: string;
  diagnosisResult: DiagnosisResult | null;
  lastDiagnosisSignature: string | null;
  lastQAImagesSignature: string | null;
}): Promise<void> {
  if (typeof window === 'undefined') return; // SSR guard
  try {
    const db = await openDB();
    const tx = db.transaction([IMAGE_STORE, STATE_STORE], 'readwrite');
    const imageStore = tx.objectStore(IMAGE_STORE);
    const stateStore = tx.objectStore(STATE_STORE);

    // Persist (upsert) images; remove any deleted ones
    const existingIds = new Set<string>();
    for (const img of params.images) {
      existingIds.add(img.id);
      const file = img.file; // File/Blob
      const record = {
        id: img.id,
        blob: file, // File extends Blob
        type: file.type || 'image/jpeg',
        compressed: img.compressed,
        size: img.size,
      } as any;
      imageStore.put(record);
    }
    // Clean up removed images
    const cursorReq = imageStore.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result as IDBCursorWithValue | null;
      if (cursor) {
        const key = cursor.primaryKey as string;
        if (!existingIds.has(key)) cursor.delete();
        cursor.continue();
      }
    };

    const persistedState: PersistedState = {
      images: params.images.map((i) => ({
        id: i.id,
        type: i.file.type || 'image/jpeg',
        compressed: i.compressed,
        size: i.size,
      })),
      plantIdentification: params.plantIdentification,
      questions: params.questions,
      answers: params.answers,
      additionalComments: params.additionalComments,
      noPlantMessage: params.noPlantMessage,
      diagnosisResult: params.diagnosisResult,
      lastDiagnosisSignature: params.lastDiagnosisSignature,
      lastQAImagesSignature: params.lastQAImagesSignature,
    };
    stateStore.put(persistedState, STATE_KEY);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error || new Error('Transaction failed'));
      tx.onabort = () => rej(tx.error || new Error('Transaction aborted'));
    });
    db.close();
  } catch (e) {
    // Non-fatal
    logger.warn('[persistence] save failed', e);
  }
}

export async function loadDiagnosisState(): Promise<{
  images: PlantImage[];
  plantIdentification: PlantIdentification | null;
  questions: DiagnosticQuestion[];
  answers: DiagnosticAnswer[];
  additionalComments: string;
  noPlantMessage: string;
  diagnosisResult: DiagnosisResult | null;
  lastDiagnosisSignature: string | null;
  lastQAImagesSignature: string | null;
} | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await openDB();
    const tx = db.transaction([IMAGE_STORE, STATE_STORE], 'readonly');
    const imageStore = tx.objectStore(IMAGE_STORE);
    const stateStore = tx.objectStore(STATE_STORE);
    const stateReq = stateStore.get(STATE_KEY);
    const stateData: PersistedState = await new Promise((res, rej) => {
      stateReq.onsuccess = () => res(stateReq.result as PersistedState);
      stateReq.onerror = () => rej(stateReq.error);
    });
    if (!stateData) {
      db.close();
      return null;
    }

    // Rebuild images (preserve order as stored in state images array)
    const rebuilt: PlantImage[] = [];
    for (const meta of stateData.images) {
      const imgReq = imageStore.get(meta.id);
      const imageRecord: any = await new Promise((res, rej) => {
        imgReq.onsuccess = () => res(imgReq.result);
        imgReq.onerror = () => rej(imgReq.error);
      });
      if (!imageRecord) continue;
      const blob: Blob = imageRecord.blob;
      // Use a deterministic filename so File isn't empty name
      const file = new File(
        [blob],
        `plant-${meta.id}.${mimeToExt(meta.type)}`,
        {
          type: meta.type,
          lastModified: Date.now(),
        }
      );
      const url = URL.createObjectURL(file);
      rebuilt.push({
        id: meta.id,
        file,
        url,
        compressed: meta.compressed,
        size: meta.size,
      });
    }
    db.close();
    return {
      images: rebuilt,
      plantIdentification: stateData.plantIdentification,
      questions: stateData.questions || [],
      answers: stateData.answers || [],
      additionalComments: stateData.additionalComments || '',
      noPlantMessage: stateData.noPlantMessage || '',
      diagnosisResult: stateData.diagnosisResult || null,
      lastDiagnosisSignature: stateData.lastDiagnosisSignature || null,
      lastQAImagesSignature: stateData.lastQAImagesSignature || null,
    };
  } catch (e) {
    logger.warn('[persistence] load failed', e);
    throw e;
  }
}

export async function clearDiagnosisState(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDB();
    const tx = db.transaction([IMAGE_STORE, STATE_STORE], 'readwrite');
    tx.objectStore(IMAGE_STORE).clear();
    tx.objectStore(STATE_STORE).delete(STATE_KEY);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error || new Error('Transaction failed'));
      tx.onabort = () => rej(tx.error || new Error('Transaction aborted'));
    });
    db.close();
  } catch (e) {
    logger.warn('[persistence] clear failed', e);
  }
}

function mimeToExt(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}
