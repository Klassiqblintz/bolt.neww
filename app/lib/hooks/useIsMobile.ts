import { useEffect, useState } from 'react';

/**
 * Returns `true` when the viewport is narrower than the given breakpoint.
 *
 * Used to switch the workbench between the side by side desktop layout and the
 * stacked layout used on phones and tablets.
 */
export function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

    const update = () => setIsMobile(query.matches);

    update();

    query.addEventListener('change', update);

    return () => query.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}
