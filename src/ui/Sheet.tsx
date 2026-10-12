import type { ComponentChildren, RefObject } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { animateSpring, project, rubberband } from '../core/spring';
import { reducedMotion } from './motion';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  header: ComponentChildren;
  children: ComponentChildren;
  /** `enamel` keeps the player in the signage colours in both themes. */
  variant?: 'enamel' | 'surface';
  /** `full` takes the screen below the status bar; `auto` fits its content. */
  size?: 'full' | 'auto';
  /** Receives focus on open on devices with a keyboard; the sheet itself otherwise. */
  initialFocus?: RefObject<HTMLElement>;
}

interface Drag {
  id: number;
  startY: number;
  startOffset: number;
  samples: { y: number; t: number }[];
}

/** Share of its travel past which a released sheet closes. */
const CLOSE_AT = 0.4;
const SAMPLE_MS = 100;

const finePointer = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;

/**
 * A bottom sheet that follows the finger. It springs with the release velocity, resists being
 * pulled past the top, and closes when a flick would carry it far enough down.
 */
export function Sheet({
  open,
  onClose,
  label,
  header,
  children,
  variant = 'surface',
  size = 'full',
  initialFocus,
}: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const panel = useRef<HTMLElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const travel = useRef(1);
  const shown = useRef(false);
  const releaseVelocity = useRef(0);
  const stop = useRef<(() => void) | null>(null);
  const drag = useRef<Drag | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  const paint = (value: number) => {
    offset.current = value;
    const element = panel.current;
    if (element) element.style.transform = `translate3d(0, ${value}px, 0)`;
    if (scrim.current) scrim.current.style.opacity = String(Math.min(1, Math.max(0, 1 - value / travel.current)));
  };

  const settle = (to: number, velocity: number, done?: () => void) => {
    stop.current?.();
    stop.current = null;
    if (reducedMotion.peek()) {
      paint(to);
      done?.();
      return;
    }
    stop.current = animateSpring(offset.current, to, velocity, paint, () => {
      stop.current = null;
      done?.();
    });
  };

  useLayoutEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!mounted || !element) return;
    // Distance from the sheet's resting place to just below the screen.
    travel.current = Math.max(1, (element.offsetParent as HTMLElement | null)?.clientHeight ?? innerHeight) - element.offsetTop;
    const velocity = releaseVelocity.current;
    releaseVelocity.current = 0;
    if (open) {
      if (!shown.current) {
        shown.current = true;
        paint(travel.current);
      }
      settle(0, velocity);
    } else {
      settle(travel.current, velocity, () => {
        shown.current = false;
        setMounted(false);
      });
    }
  }, [open, mounted]);

  useEffect(() => () => stop.current?.(), []);

  useEffect(() => {
    if (!open || !mounted) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = finePointer() ? (initialFocus?.current ?? panel.current) : panel.current;
    target?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      close.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
    };
  }, [open, mounted]);

  if (!mounted) return null;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as Element).closest('button, a, input, select, textarea, summary')) return;
    stop.current?.();
    stop.current = null;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      startOffset: offset.current,
      samples: [{ y: event.clientY, t: event.timeStamp }],
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.id) return;
    const raw = current.startOffset + event.clientY - current.startY;
    paint(raw < 0 ? rubberband(raw, travel.current) : raw);
    current.samples.push({ y: event.clientY, t: event.timeStamp });
    while (current.samples.length > 2 && event.timeStamp - (current.samples[0]?.t ?? 0) > SAMPLE_MS) current.samples.shift();
  };

  const onPointerUp = (event: PointerEvent) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.id) return;
    drag.current = null;
    const first = current.samples[0];
    const last = current.samples[current.samples.length - 1];
    const velocity = first && last && last.t > first.t ? ((last.y - first.y) / (last.t - first.t)) * 1000 : 0;
    if (offset.current + project(velocity) > travel.current * CLOSE_AT) {
      releaseVelocity.current = velocity;
      close.current();
    } else {
      settle(0, velocity);
    }
  };

  const onPointerCancel = () => {
    drag.current = null;
    settle(0, 0);
  };

  return (
    <div class="sheet-root">
      <div class="sheet-scrim" ref={scrim} onClick={() => close.current()} />
      <section
        ref={panel}
        class={`sheet sheet--${size} ${variant === 'enamel' ? 'enamel' : 'surface'}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div
          class="sheet__top"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <div class="sheet__grabber" aria-hidden="true" />
          {header}
        </div>
        <div class="sheet__body">{children}</div>
      </section>
    </div>
  );
}

/** Standard sheet header: a title and a close button. */
export function SheetHeader({ title, closeLabel, onClose, icon }: { title: string; closeLabel: string; onClose: () => void; icon: ComponentChildren }) {
  return (
    <div class="sheet__header">
      <h2 class="sheet__title">{title}</h2>
      <button type="button" class="icon-btn" aria-label={closeLabel} onClick={onClose}>
        {icon}
      </button>
    </div>
  );
}
