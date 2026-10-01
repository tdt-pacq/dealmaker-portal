/**
 * Pure sync decisions for the QSI Market Price Analyzer.
 * The shared Firestore doc is the copy other advisors see. Local drafts
 * remember which shared version they were based on (_baseSavedAt, millis).
 */

export function dealSlug(name) {
  return String(name || '').trim().replace(/[^a-z0-9]/gi, '-').toLowerCase();
}

export function toSavedAtMillis(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    if (/^\d+$/.test(value)) {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      try {
        const t = value.toMillis();
        return typeof t === 'number' && Number.isFinite(t) ? t : null;
      } catch {
        return null;
      }
    }
    if (typeof value.seconds === 'number') {
      const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
      return value.seconds * 1000 + Math.floor(nanos / 1e6);
    }
  }
  return null;
}

const SYNC_FIELDS = ['_baseSavedAt', '_writeId', '_savedAt', '_savedBy', '_savedByName', 'id'];

/** Drop sync bookkeeping so it is not stored on the shared doc or in an export. */
export function stripDealMeta(data) {
  if (!data || typeof data !== 'object') return {};
  const next = { ...data };
  for (const key of SYNC_FIELDS) delete next[key];
  return next;
}

export function dealForExport(state) {
  return stripDealMeta(state);
}

export function savedByLabel(data) {
  if (!data || typeof data !== 'object') return 'someone else';
  const name = String(data._savedByName || '').trim();
  if (name) return name;
  const email = String(data._savedBy || '').trim();
  if (email) return email;
  return 'someone else';
}

export function formatSavedAt(value) {
  const ms = toSavedAtMillis(value);
  if (ms == null) return 'an unknown time';
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

/**
 * True when a snapshot is the echo of a write this browser just made.
 * Same-user saves from another device are not own writes: a newer timestamp
 * with a different write id is a remote update.
 */
export function isOwnWrite({
  hasPendingWrites = false,
  writeId = '',
  pendingWriteId = '',
  savedBy = '',
  currentUser = '',
  sharedSavedAt = null,
  baseSavedAt = null,
} = {}) {
  if (hasPendingWrites) return true;
  if (writeId && pendingWriteId && writeId === pendingWriteId) return true;
  const shared = toSavedAtMillis(sharedSavedAt);
  const base = toSavedAtMillis(baseSavedAt);
  if (currentUser && savedBy && savedBy === currentUser && shared != null && base != null && shared === base) {
    return true;
  }
  return false;
}

/**
 * Decide how local state should meet the shared deal.
 *
 * intent 'sync' (startup and live snapshots):
 *   - fetch error or no shared doc → keep local
 *   - own write → ignore
 *   - shared newer than base, local clean → adopt
 *   - shared newer than base, local dirty → conflict
 *   - shared equal or older → keep local
 *
 * intent 'write' (autosave and Save Deal):
 *   - fetch error → keep local (do not write)
 *   - no shared doc, or shared not newer → write
 *   - shared newer than base → conflict (do not write)
 */
export function decideDealSync({
  fetchError = false,
  hasSharedDoc = false,
  baseSavedAt = null,
  sharedSavedAt = null,
  localDirty = false,
  hasPendingWrites = false,
  ownWrite = false,
  intent = 'sync',
} = {}) {
  if (fetchError) return { action: 'keep-local', reason: 'fetch-error' };

  if (intent !== 'write' && (hasPendingWrites || ownWrite)) {
    return { action: 'ignore', reason: 'own-write' };
  }

  if (!hasSharedDoc) {
    return intent === 'write'
      ? { action: 'write', reason: 'no-shared-doc' }
      : { action: 'keep-local', reason: 'no-shared-doc' };
  }

  const shared = toSavedAtMillis(sharedSavedAt);
  const base = toSavedAtMillis(baseSavedAt);

  if (shared == null) {
    return intent === 'write'
      ? { action: 'write', reason: 'shared-untimed' }
      : { action: 'keep-local', reason: 'shared-untimed' };
  }

  const sharedIsNewer = base == null || shared > base;
  if (!sharedIsNewer) {
    const reason = shared === base ? 'shared-equal' : 'shared-older';
    return intent === 'write'
      ? { action: 'write', reason }
      : { action: 'keep-local', reason };
  }

  if (intent === 'write' || localDirty) {
    return { action: 'conflict', reason: localDirty ? 'shared-newer-dirty' : 'shared-newer' };
  }

  return { action: 'adopt', reason: 'shared-newer' };
}
