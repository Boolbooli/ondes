import { starPath } from '../core/station-art';
import type { Line } from '../core/types';
import { inkStyle } from '../data/lines';

const STAR = starPath(12, 12, 8.4, 'currentColor');

type Size = 'xs' | 'sm' | 'md' | 'lg';

/** A line's roundel, as on métro signage. Decorative: the label belongs to its control. */
export function Roundel({ line, size = 'md' }: { line: Line; size?: Size }) {
  return (
    <span class={`roundel roundel--${size}`} style={inkStyle(line)} aria-hidden="true">
      {line.id === 'fav' ? (
        <svg viewBox="0 0 24 24" class="roundel__star" focusable="false" dangerouslySetInnerHTML={{ __html: STAR }} />
      ) : (
        <span class="roundel__label">{line.roundel}</span>
      )}
    </span>
  );
}
