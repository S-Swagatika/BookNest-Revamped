import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = { medium: 600, expanded: 1024 } as const;

export type Breakpoint = 'compact' | 'medium' | 'expanded';

export function breakpointForWidth(width: number): Breakpoint {
  if (width >= BREAKPOINTS.expanded) return 'expanded';
  if (width >= BREAKPOINTS.medium) return 'medium';
  return 'compact';
}

/** Number of book columns for a grid, optionally reserving room for a sidebar. */
export function gridColumns(breakpoint: Breakpoint, hasSidebar = false): number {
  if (breakpoint === 'compact') return 2;
  if (breakpoint === 'medium') return 3;
  return hasSidebar ? 3 : 4;
}

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const breakpoint = breakpointForWidth(width);
  return {
    width,
    breakpoint,
    isCompact: breakpoint === 'compact',
    isMedium: breakpoint === 'medium',
    isExpanded: breakpoint === 'expanded',
  };
}
