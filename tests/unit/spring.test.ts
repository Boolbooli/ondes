import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { animateSpring, project, rubberband, springStep } from '../../src/core/spring';

const T0 = 1_000;
const FRAME = 1000 / 60;

/**
 * Drives requestAnimationFrame by hand with a frozen `performance.now()`, like a browser:
 * every callback requested before a frame runs in that frame, with its timestamp.
 */
function frameDriver() {
  const queue = new Map<number, FrameRequestCallback>();
  let ids = 0;
  vi.spyOn(performance, 'now').mockReturnValue(T0);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queue.set(++ids, callback);
    return ids;
  });
  const cancel = vi.fn((id: number) => {
    queue.delete(id);
  });
  vi.stubGlobal('cancelAnimationFrame', cancel);

  let clock = T0;
  const frame = (at = clock + FRAME) => {
    clock = at;
    const batch = [...queue.values()];
    queue.clear();
    for (const callback of batch) callback(at);
  };
  return {
    cancel,
    get pending() {
      return queue.size;
    },
    frame,
    /** Runs 60 fps frames until nothing is requested; returns how many ran. */
    run(limit = 600) {
      let count = 0;
      while (queue.size > 0) {
        if (count === limit) throw new Error(`still animating after ${limit} frames`);
        frame();
        count++;
      }
      return count;
    },
  };
}

const values = (onFrame: Mock<(value: number) => void>) => onFrame.mock.calls.map(([value]) => value);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('project', () => {
  it('is where a flick comes to rest with the default UIKit deceleration', () => {
    expect(project(1000)).toBeCloseTo(499, 6);
    expect(project(-1000)).toBeCloseTo(-499, 6);
    expect(project(0)).toBe(0);
  });

  it('is proportional to the velocity', () => {
    expect(project(3000)).toBeCloseTo(3 * project(1000), 6);
  });

  it('stops sooner with a faster deceleration', () => {
    expect(project(1000, 0.99)).toBeCloseTo(99, 6);
  });
});

describe('rubberband', () => {
  it('follows the UIKit formula', () => {
    expect(rubberband(100, 100)).toBeCloseTo((100 * 100 * 0.55) / (100 + 0.55 * 100), 9);
    expect(rubberband(100, 100, 1)).toBeCloseTo(50, 9);
  });

  it('keeps the direction of the pull', () => {
    expect(rubberband(-100, 100)).toBeCloseTo(-rubberband(100, 100), 9);
    expect(rubberband(0, 100)).toBe(0);
  });

  it('moves at the constant’s rate for small pulls, then ever slower', () => {
    expect(rubberband(0.01, 300)).toBeCloseTo(0.0055, 6);
    const offsets = [10, 50, 100, 400, 2000, 1e6];
    const pulls = offsets.map((offset) => rubberband(offset, 300));
    const gains = offsets.map((offset) => rubberband(offset, 300) / offset);
    expect(pulls).toEqual([...pulls].sort((a, b) => a - b));
    expect(new Set(pulls).size).toBe(pulls.length);
    expect(gains).toEqual([...gains].sort((a, b) => b - a));
    expect(new Set(gains).size).toBe(gains.length);
  });

  it.each([1, 100, 1e4, 1e9])('resists more than the constant and never goes beyond the dimension (offset %d)', (offset) => {
    expect(rubberband(offset, 300)).toBeLessThan(300);
    expect(rubberband(-offset, 300)).toBeGreaterThan(-300);
    expect(rubberband(offset, 300)).toBeLessThan(offset * 0.55);
  });

  it('approaches the dimension for very long pulls', () => {
    expect(rubberband(1e12, 300)).toBeCloseTo(300, 3);
  });

  it('is 0 when there is no room', () => {
    expect(rubberband(50, 0)).toBe(0);
    expect(rubberband(50, -10)).toBe(0);
  });
});

describe('springStep', () => {
  it('accelerates toward the target', () => {
    const [position, velocity] = springStep(0, 0, 100, 1 / 240);
    expect(velocity).toBeCloseTo(175, 9);
    expect(position).toBeCloseTo(175 / 240, 9);
  });

  it('stays put at rest on the target', () => {
    expect(springStep(100, 0, 100, 1 / 60)).toEqual([100, 0]);
  });

  it('damps the velocity', () => {
    const [position, velocity] = springStep(0, 100, 0, 0.01);
    expect(velocity).toBeCloseTo(60, 9);
    expect(position).toBeCloseTo(0.6, 9);
  });

  it('honours stiffness, damping and mass', () => {
    expect(springStep(0, 0, 100, 1 / 240, { stiffness: 840 })[1]).toBeCloseTo(350, 9);
    expect(springStep(0, 0, 100, 1 / 240, { mass: 2 })[1]).toBeCloseTo(87.5, 9);
    expect(springStep(0, 100, 0, 0.01, { damping: 0 })[1]).toBeCloseTo(100, 9);
  });
});

describe('animateSpring', () => {
  it('settles exactly on the target within a second, then calls onDone once', () => {
    const driver = frameDriver();
    const onFrame = vi.fn<(value: number) => void>();
    const onDone = vi.fn();
    animateSpring(0, 100, 0, onFrame, onDone);
    expect(onFrame).not.toHaveBeenCalled();

    const frames = driver.run();
    expect(frames).toBeLessThan(60);
    expect(onDone).toHaveBeenCalledOnce();
    expect(onFrame).toHaveBeenLastCalledWith(100);
    expect(onFrame).toHaveBeenCalledTimes(frames);
    expect(onFrame.mock.invocationCallOrder.at(-1)).toBeLessThan(onDone.mock.invocationCallOrder[0] ?? 0);
  });

  it('from rest, stays between start and target (within the settling tolerance)', () => {
    const driver = frameDriver();
    const onFrame = vi.fn<(value: number) => void>();
    animateSpring(0, 100, 0, onFrame, () => {});
    driver.run();
    const seen = values(onFrame);
    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[0]).toBeLessThan(100);
    for (const value of seen) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(100.4);
    }
  });

  it('works downward too', () => {
    const driver = frameDriver();
    const onFrame = vi.fn<(value: number) => void>();
    animateSpring(300, -20, 0, onFrame, () => {});
    driver.run();
    expect(values(onFrame)[0]).toBeLessThan(300);
    expect(onFrame).toHaveBeenLastCalledWith(-20);
  });

  it('carries the finger’s velocity', () => {
    const driver = frameDriver();
    const still = vi.fn<(value: number) => void>();
    const flung = vi.fn<(value: number) => void>();
    const away = vi.fn<(value: number) => void>();
    animateSpring(0, 100, 0, still, () => {});
    animateSpring(0, 100, 3000, flung, () => {});
    animateSpring(0, 100, -3000, away, () => {});
    driver.frame();
    expect(flung.mock.calls[0]?.[0]).toBeGreaterThan(still.mock.calls[0]?.[0] ?? Infinity);
    expect(away.mock.calls[0]?.[0]).toBeLessThan(0);
  });

  it('advances at most 64 ms of physics after a long stall', () => {
    const driver = frameDriver();
    const stalled = vi.fn<(value: number) => void>();
    const cancelStalled = animateSpring(0, 100, 0, stalled, () => {});
    driver.frame(T0 + 5_000);
    cancelStalled();

    const smooth = vi.fn<(value: number) => void>();
    animateSpring(0, 100, 0, smooth, () => {});
    driver.frame(T0 + 5_000 + 64);

    expect(stalled.mock.calls[0]?.[0]).toBeLessThan(99.6);
    expect(stalled.mock.calls[0]?.[0]).toBe(smooth.mock.calls[0]?.[0]);
  });

  it('honours the spring options', () => {
    const driver = frameDriver();
    const soft = vi.fn<(value: number) => void>();
    const stiff = vi.fn<(value: number) => void>();
    animateSpring(0, 100, 0, soft, () => {});
    animateSpring(0, 100, 0, stiff, () => {}, { stiffness: 2000, damping: 90 });
    driver.frame();
    expect(stiff.mock.calls[0]?.[0]).toBeGreaterThan(soft.mock.calls[0]?.[0] ?? Infinity);
  });

  it('finishes on the first frame when already at rest on the target', () => {
    const driver = frameDriver();
    const onFrame = vi.fn<(value: number) => void>();
    const onDone = vi.fn();
    animateSpring(42, 42, 0, onFrame, onDone);
    expect(driver.run()).toBe(1);
    expect(onFrame.mock.calls).toEqual([[42]]);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('stops when cancelled and never calls onDone', () => {
    const driver = frameDriver();
    const onFrame = vi.fn<(value: number) => void>();
    const onDone = vi.fn();
    const cancel = animateSpring(0, 100, 0, onFrame, onDone);
    driver.frame();
    driver.frame();
    cancel();
    expect(driver.cancel).toHaveBeenCalledOnce();
    expect(driver.pending).toBe(0);
    expect(driver.run()).toBe(0);
    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('can be cancelled before its first frame', () => {
    const driver = frameDriver();
    const onFrame = vi.fn<(value: number) => void>();
    animateSpring(0, 100, 0, onFrame, () => {})();
    expect(driver.run()).toBe(0);
    expect(onFrame).not.toHaveBeenCalled();
  });
});
