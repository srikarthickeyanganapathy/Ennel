import { useCallback, useRef } from 'react';

/**
 * Spec §14 duplicate-submit prevention. A disabled button only takes effect after the next
 * render, so a fast double tap could still submit twice; this lock is set synchronously and
 * held until validation and the request have finished.
 */
export function useSubmitLock(): (task: () => Promise<unknown>) => void {
  const isLocked = useRef(false);
  return useCallback((task) => {
    if (isLocked.current) return;
    isLocked.current = true;
    task()
      // Failures are shown through the mutation's error state.
      .catch(() => undefined)
      .finally(() => {
        isLocked.current = false;
      });
  }, []);
}
