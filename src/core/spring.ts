/**
 * Small physics helpers for sheets, after the UIKit model: a damped spring that
 * carries the finger's velocity, momentum projection, and rubber-banding past limits.
 */

export interface SpringOptions {
  stiffness?: number;
  damping?: number;
  mass?: number;
}

/** Where a flick would come to rest (px), given its velocity in px/s. */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Resistance past an edge: grows ever slower, never beyond `dimension`. */
export function rubberband(offset: number, dimension: number, constant = 0.55): number {
  if (dimension <= 0) return 0;
  const sign = Math.sign(offset);
  const distance = Math.abs(offset);
  return (sign * (distance * dimension * constant)) / (dimension + constant * distance);
}

/** One semi-implicit Euler step; returns the new position and velocity. */
export function springStep(
  position: number,
  velocity: number,
  target: number,
  dt: number,
  { stiffness = 420, damping = 40, mass = 1 }: SpringOptions = {},
): [number, number] {
  const force = -stiffness * (position - target) - damping * velocity;
  const nextVelocity = velocity + (force / mass) * dt;
  return [position + nextVelocity * dt, nextVelocity];
}

/** Runs a spring on the animation clock. Returns a cancel function. */
export function animateSpring(
  from: number,
  to: number,
  velocity: number,
  onFrame: (value: number) => void,
  onDone: () => void,
  options?: SpringOptions,
): () => void {
  let position = from;
  let speed = velocity;
  let last = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    let elapsed = Math.min(0.064, (now - last) / 1000);
    last = now;
    while (elapsed > 0) {
      const dt = Math.min(elapsed, 1 / 240);
      [position, speed] = springStep(position, speed, to, dt, options);
      elapsed -= dt;
    }
    if (Math.abs(position - to) < 0.4 && Math.abs(speed) < 8) {
      onFrame(to);
      onDone();
      return;
    }
    onFrame(position);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
