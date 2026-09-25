export function parseInterview(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

export function interviewHasContent(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return Object.values(data).some((value) => {
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    return value != null && value !== '';
  });
}

/**
 * Keep filled server fields when a local draft is blank.
 * A draft left by an empty form must not replace an interview that is already saved.
 * Filled draft values still win, so unsaved typing is not dropped.
 */
export function mergeInterview(server, draft) {
  const base = server && typeof server === 'object' && !Array.isArray(server) ? { ...server } : {};
  if (!draft || typeof draft !== 'object' || Array.isArray(draft) || !interviewHasContent(draft)) {
    return base;
  }
  if (!interviewHasContent(base)) return { ...draft };
  const merged = { ...base };
  for (const [key, value] of Object.entries(draft)) {
    if (typeof value === 'string') {
      if (value.trim() !== '') merged[key] = value;
    } else if (Array.isArray(value)) {
      if (value.length) merged[key] = value;
    } else if (value != null && value !== '') {
      merged[key] = value;
    }
  }
  return merged;
}
