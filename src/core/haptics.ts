let switchLabel: HTMLLabelElement | undefined;

const isAppleTouch = (): boolean =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);

/**
 * A light tap of haptic feedback. Safari on iOS 18+ plays the system haptic when a
 * `<input type="checkbox" switch>` toggles, so a hidden one is flipped; elsewhere
 * the Vibration API is used where it exists.
 */
export function haptic(): void {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(8);
    return;
  }
  if (!isAppleTouch()) return;
  if (!switchLabel) {
    switchLabel = document.createElement('label');
    switchLabel.setAttribute('aria-hidden', 'true');
    switchLabel.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.tabIndex = -1;
    input.setAttribute('switch', '');
    switchLabel.append(input);
    document.body.append(switchLabel);
  }
  switchLabel.click();
}
