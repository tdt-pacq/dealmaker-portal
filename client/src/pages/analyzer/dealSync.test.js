import { describe, expect, it } from 'vitest';
import {
  dealForExport,
  dealSlug,
  decideDealSync,
  isOwnWrite,
  toSavedAtMillis,
} from './dealSync.js';

describe('decideDealSync', () => {
  it('adopts when the shared copy is newer than the base', () => {
    const decision = decideDealSync({
      hasSharedDoc: true,
      baseSavedAt: 1_000,
      sharedSavedAt: 2_000,
      localDirty: false,
    });
    expect(decision).toEqual({ action: 'adopt', reason: 'shared-newer' });
  });

  it('keeps local when the shared copy matches the base', () => {
    const decision = decideDealSync({
      hasSharedDoc: true,
      baseSavedAt: 2_000,
      sharedSavedAt: 2_000,
    });
    expect(decision.action).toBe('keep-local');
    expect(decision.reason).toBe('shared-equal');
  });

  it('shows a conflict when the shared copy is newer and local edits are unsaved', () => {
    const decision = decideDealSync({
      hasSharedDoc: true,
      baseSavedAt: 1_000,
      sharedSavedAt: 2_000,
      localDirty: true,
    });
    expect(decision).toEqual({ action: 'conflict', reason: 'shared-newer-dirty' });
  });

  it('keeps local when there is no shared doc', () => {
    const decision = decideDealSync({
      hasSharedDoc: false,
      baseSavedAt: 1_000,
      sharedSavedAt: null,
    });
    expect(decision).toEqual({ action: 'keep-local', reason: 'no-shared-doc' });
  });

  it('keeps local when the fetch fails', () => {
    const decision = decideDealSync({
      fetchError: true,
      hasSharedDoc: true,
      baseSavedAt: 1_000,
      sharedSavedAt: 9_000,
      localDirty: false,
    });
    expect(decision).toEqual({ action: 'keep-local', reason: 'fetch-error' });
  });

  it('adopts a shared doc when an older draft has no base version', () => {
    const decision = decideDealSync({
      hasSharedDoc: true,
      baseSavedAt: null,
      sharedSavedAt: 2_000,
      localDirty: false,
    });
    expect(decision.action).toBe('adopt');
  });

  it('does not write when someone else saved more recently than the base', () => {
    const decision = decideDealSync({
      intent: 'write',
      hasSharedDoc: true,
      baseSavedAt: 1_000,
      sharedSavedAt: 2_000,
      localDirty: false,
    });
    expect(decision.action).toBe('conflict');
  });

  it('allows a write when the shared copy still matches the base', () => {
    const decision = decideDealSync({
      intent: 'write',
      hasSharedDoc: true,
      baseSavedAt: 2_000,
      sharedSavedAt: 2_000,
    });
    expect(decision).toEqual({ action: 'write', reason: 'shared-equal' });
  });

  it('ignores a snapshot caused by our own pending write', () => {
    const decision = decideDealSync({
      hasSharedDoc: true,
      baseSavedAt: 1_000,
      sharedSavedAt: 2_000,
      hasPendingWrites: true,
      localDirty: true,
    });
    expect(decision).toEqual({ action: 'ignore', reason: 'own-write' });
  });
});

describe('isOwnWrite', () => {
  it('treats a matching writer and base timestamp as our own snapshot', () => {
    expect(isOwnWrite({
      savedBy: 'michael@thedealteam.co',
      currentUser: 'michael@thedealteam.co',
      sharedSavedAt: 2_000,
      baseSavedAt: 2_000,
    })).toBe(true);
  });

  it('treats a newer save by the same user as another device', () => {
    expect(isOwnWrite({
      savedBy: 'michael@thedealteam.co',
      currentUser: 'michael@thedealteam.co',
      sharedSavedAt: 3_000,
      baseSavedAt: 2_000,
    })).toBe(false);
  });

  it('matches the write id from this browser after the server timestamp lands', () => {
    expect(isOwnWrite({
      writeId: 'local-1',
      pendingWriteId: 'local-1',
      savedBy: 'michael@thedealteam.co',
      currentUser: 'michael@thedealteam.co',
      sharedSavedAt: 3_000,
      baseSavedAt: 2_000,
    })).toBe(true);
  });
});

describe('sync fields', () => {
  it('reads Firestore timestamps as millis', () => {
    expect(toSavedAtMillis({ seconds: 2, nanoseconds: 5_000_000 })).toBe(2_005);
    expect(toSavedAtMillis({ toMillis: () => 2_000 })).toBe(2_000);
  });

  it('strips base version and write ids from exports', () => {
    expect(dealForExport({
      dealName: 'Cannon Enterprises',
      _baseSavedAt: 2_000,
      _writeId: 'local-1',
      _savedAt: 2_000,
      _savedBy: 'michael@thedealteam.co',
      _net: 0,
      su: { reAmort: 25 },
    })).toEqual({
      dealName: 'Cannon Enterprises',
      _net: 0,
      su: { reAmort: 25 },
    });
  });

  it('slugifies a deal name the same way the analyzer always has', () => {
    expect(dealSlug('Cannon Enterprises')).toBe('cannon-enterprises');
  });
});
