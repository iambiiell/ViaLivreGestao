import { useEffect } from 'react';

// Reference counter so multiple stacked modals or sequential popups work seamlessly
let activeLocksCount = 0;
let originalOverflow = '';
let originalPaddingRight = '';

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      if (activeLocksCount === 0) {
        originalOverflow = document.body.style.overflow;
        originalPaddingRight = document.body.style.paddingRight;

        // Prevent layout shift from scrollbar disappearing
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollBarWidth > 0) {
          document.body.style.paddingRight = `${scrollBarWidth}px`;
        }

        document.body.style.overflow = 'hidden';
        document.documentElement.classList.add('modal-open-locked');
      }
      activeLocksCount++;
    }

    return () => {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        activeLocksCount = Math.max(0, activeLocksCount - 1);
        if (activeLocksCount === 0) {
          document.body.style.overflow = originalOverflow;
          document.body.style.paddingRight = originalPaddingRight;
          document.documentElement.classList.remove('modal-open-locked');
        }
      }
    };
  }, [isLocked]);
}

export default useBodyScrollLock;
