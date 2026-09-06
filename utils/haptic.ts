/**
 * Haptic Feedback Utility via Vibration API
 * Provides tactile response for swipe gestures, card transitions, and tab switches on mobile devices.
 */

export type HapticType = 'light' | 'medium' | 'success' | 'warning' | 'swipe' | 'card_snap';

export const triggerHaptic = (type: HapticType | number | number[] = 'light'): void => {
  if (typeof window === 'undefined' || !('navigator' in window) || !('vibrate' in navigator)) {
    return;
  }

  try {
    if (typeof type === 'number' || Array.isArray(type)) {
      navigator.vibrate(type);
      return;
    }

    switch (type) {
      case 'light':
      case 'swipe':
        // Short crisp vibration on tab swipe / gesture
        navigator.vibrate(18);
        break;
      case 'card_snap':
        // Distinct subtle pulse when carousel card snaps into place
        navigator.vibrate([12, 10, 18]);
        break;
      case 'medium':
        navigator.vibrate(35);
        break;
      case 'success':
        // Double tactile tap
        navigator.vibrate([20, 40, 30]);
        break;
      case 'warning':
        navigator.vibrate([30, 50, 40]);
        break;
      default:
        navigator.vibrate(20);
        break;
    }
  } catch (e) {
    // Vibration API may fail silently or be blocked by browser policies
  }
};

export default triggerHaptic;
