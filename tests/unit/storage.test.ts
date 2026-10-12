import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStringArray, load, save } from '../../src/core/storage';

const asNumber = (value: unknown) => (typeof value === 'number' ? value : undefined);
const asStrings = (value: unknown) => (isStringArray(value) ? value : undefined);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('save and load', () => {
  it('round-trip JSON values under a versioned key', () => {
    save('favorites', ['fip', 'kexp']);
    expect(localStorage.getItem('ondes:v1:favorites')).toBe('["fip","kexp"]');
    expect(load('favorites', asStrings, [])).toEqual(['fip', 'kexp']);
  });

  it('overwrite the previous value', () => {
    save('volume', 0.2);
    save('volume', 0.7);
    expect(load('volume', asNumber, 1)).toBe(0.7);
  });

  it('keep falsy values that pass validation', () => {
    save('volume', 0);
    save('muted', false);
    save('last', '');
    expect(load('volume', asNumber, 0.8)).toBe(0);
    expect(load('muted', (v) => (typeof v === 'boolean' ? v : undefined), true)).toBe(false);
    expect(load('last', (v) => (typeof v === 'string' ? v : undefined), 'fip')).toBe('');
  });

  it('forget the value when given undefined, which JSON cannot hold', () => {
    save('sleep', 30);
    save('sleep', undefined);
    expect(localStorage.getItem('ondes:v1:sleep')).toBeNull();
    expect(load('sleep', asNumber, 0)).toBe(0);
  });
});

describe('load falls back', () => {
  it('when nothing is stored', () => {
    expect(load('volume', asNumber, 0.8)).toBe(0.8);
  });

  it('when only an unversioned key exists', () => {
    localStorage.setItem('volume', '0.3');
    expect(load('volume', asNumber, 0.8)).toBe(0.8);
  });

  it('when the stored text is not JSON', () => {
    localStorage.setItem('ondes:v1:volume', '{oops');
    expect(load('volume', asNumber, 0.8)).toBe(0.8);
  });

  it('when the value fails validation, after giving the parser the decoded value', () => {
    save('favorites', { fip: true });
    const parse = vi.fn(asStrings);
    expect(load('favorites', parse, ['kexp'])).toEqual(['kexp']);
    expect(parse).toHaveBeenCalledExactlyOnceWith({ fip: true });
  });

  it('when the parser throws', () => {
    save('volume', 0.3);
    const parse = (): number => {
      throw new TypeError('bad');
    };
    expect(load('volume', parse, 0.8)).toBe(0.8);
  });

  it('when storage access is denied', () => {
    save('volume', 0.3);
    const getItem = vi.fn((_key: string): string | null => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    vi.stubGlobal('localStorage', { getItem });
    expect(load('volume', asNumber, 0.8)).toBe(0.8);
    expect(getItem).toHaveBeenCalledExactlyOnceWith('ondes:v1:volume');
  });

  it('when there is no localStorage at all', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(load('volume', asNumber, 0.8)).toBe(0.8);
  });
});

describe('save never throws', () => {
  it('when the quota is exceeded', () => {
    const setItem = vi.fn((_key: string, _value: string): void => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    vi.stubGlobal('localStorage', { setItem });
    expect(() => save('favorites', ['fip'])).not.toThrow();
    expect(setItem).toHaveBeenCalledExactlyOnceWith('ondes:v1:favorites', '["fip"]');
  });

  it('when there is no localStorage at all', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => save('volume', 0.3)).not.toThrow();
  });

  it('when JSON cannot represent the value, and stores nothing', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() => save('broken', circular)).not.toThrow();
    expect(() => save('big', 10n)).not.toThrow();
    expect(localStorage.getItem('ondes:v1:broken')).toBeNull();
    expect(localStorage.getItem('ondes:v1:big')).toBeNull();
  });
});

describe('isStringArray', () => {
  it.each<[unknown, boolean]>([
    [[], true],
    [['fip', 'kexp'], true],
    [['fip', 1], false],
    [['fip', null], false],
    ['fip', false],
    [null, false],
    [undefined, false],
    [{ 0: 'fip', length: 1 }, false],
  ])('%j → %s', (value, expected) => {
    expect(isStringArray(value)).toBe(expected);
  });
});
