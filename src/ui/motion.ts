import { signal } from '@preact/signals';

/** Follows the system "Reduce motion" setting. */
export const reducedMotion = signal(false);

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.value = query.matches;
  query.addEventListener('change', (event) => {
    reducedMotion.value = event.matches;
  });
}

/** The one authored curve: a long, decelerating arrival. */
export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const TRAVEL_MS = 600;

/**
 * When an element moving along `EASE_OUT` has covered `progress` of its distance, as a fraction
 * of the duration. With y1 = y2 = 1 the curve's y(s) is 1 − (1 − s)³, so it inverts in closed form.
 */
export function easeOutTimeAt(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const s = 1 - Math.cbrt(1 - p);
  const u = 1 - s;
  return 3 * u * u * s * 0.16 + 3 * u * s * s * 0.3 + s * s * s;
}
