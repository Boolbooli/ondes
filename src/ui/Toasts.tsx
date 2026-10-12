import { useEffect, useRef, useState } from 'preact/hooks';
import {
  acceptImport,
  currentStation,
  dismissImport,
  dismissToast,
  pendingImport,
  sheet,
  t,
  toasts,
  wide,
  type Toast,
} from '../state/store';
import { reducedMotion } from './motion';

const EXIT_MS = 200;

interface Shown {
  toast: Toast;
  leaving: boolean;
}

/** Keeps removed toasts on screen briefly so they can fade out instead of vanishing. */
function useShownToasts(list: readonly Toast[]): Shown[] {
  const [shown, setShown] = useState<Shown[]>(() => list.map((toast) => ({ toast, leaving: false })));
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const ids = new Set(list.map((item) => item.id));
    setShown((previous) => {
      const kept = previous.map((item) => (ids.has(item.toast.id) ? item : { ...item, leaving: true }));
      const known = new Set(previous.map((item) => item.toast.id));
      return [...kept, ...list.filter((item) => !known.has(item.id)).map((toast) => ({ toast, leaving: false }))];
    });
  }, [list]);

  useEffect(() => {
    for (const item of shown) {
      if (!item.leaving || timers.current.has(item.toast.id)) continue;
      const id = item.toast.id;
      timers.current.set(
        id,
        setTimeout(
          () => {
            timers.current.delete(id);
            setShown((previous) => previous.filter((entry) => entry.toast.id !== id));
          },
          reducedMotion.peek() ? 0 : EXIT_MS,
        ),
      );
    }
  }, [shown]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return shown;
}

/** Confirmations and offers, above everything, including open sheets. */
export function Toasts() {
  const dict = t.value;
  const shown = useShownToasts(toasts.value);
  const imports = pendingImport.value;
  const raised = Boolean(currentStation.value) && !wide.value && sheet.value === null;
  return (
    <div class={`toasts${raised ? ' toasts--raised' : ''}`}>
      {imports.length > 0 && (
        <div class="toast enamel toast--offer" role="group" aria-label={dict.sharedLine}>
          <p class="toast__message">{dict.importLine(imports.length)}</p>
          <div class="toast__actions">
            <button type="button" class="toast__btn" onClick={dismissImport}>
              {dict.ignore}
            </button>
            <button type="button" class="toast__btn toast__btn--primary" onClick={acceptImport}>
              {dict.add}
            </button>
          </div>
        </div>
      )}
      <div class="toasts__live" role="status" aria-live="polite">
        {shown.map(({ toast, leaving }) => (
          <div key={toast.id} class={`toast enamel${leaving ? ' is-leaving' : ''}`}>
            <p class="toast__message">{toast.message}</p>
            {toast.action && !leaving && (
              <button
                type="button"
                class="toast__btn toast__btn--primary"
                onClick={() => {
                  dismissToast(toast.id);
                  toast.action?.run();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
