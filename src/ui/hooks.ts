import type { RefObject } from 'preact';
import { useEffect, useState } from 'preact/hooks';

type Listener = (visible: boolean) => void;

const listeners = new WeakMap<Element, Listener>();
let observer: IntersectionObserver | undefined;

function observe(element: Element, listener: Listener): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    listener(true);
    return () => {};
  }
  // One observer for every stop. Pages scrolled out sideways are clipped, so only the line
  // on screen (and the next one while swiping) counts as visible.
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting);
    },
    { rootMargin: '160px 0px' },
  );
  listeners.set(element, listener);
  observer.observe(element);
  return () => {
    observer?.unobserve(element);
    listeners.delete(element);
  };
}

/** Whether the element is on screen or about to be. */
export function useVisible(ref: RefObject<Element>): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    return element ? observe(element, setVisible) : undefined;
  }, [ref]);
  return visible;
}
