const PREFIX = 'ondes:v1:';

/** Reads a stored value, falling back when it is missing, unreadable or fails validation. */
export function load<T>(key: string, parse: (value: unknown) => T | undefined, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return parse(JSON.parse(raw)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    // JSON has no `undefined`: storing nothing is the faithful record of it.
    if (value === undefined) globalThis.localStorage?.removeItem(PREFIX + key);
    else globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Private mode or quota: the app keeps working for this session.
  }
}

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
