import { breakpointForWidth, gridColumns } from '@/theme/breakpoints';

describe('breakpoints', () => {
  it.each([
    [320, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [768, 'medium'],
    [1023, 'medium'],
    [1024, 'expanded'],
    [1920, 'expanded'],
  ])('maps a %ipx-wide window to %s', (width, expected) => {
    expect(breakpointForWidth(width)).toBe(expected);
  });

  it('uses 2, 3 and 4 grid columns for phone, tablet and desktop', () => {
    expect(gridColumns('compact')).toBe(2);
    expect(gridColumns('medium')).toBe(3);
    expect(gridColumns('expanded')).toBe(4);
  });

  it('drops to 3 columns on desktop when a filter sidebar takes space', () => {
    expect(gridColumns('expanded', true)).toBe(3);
  });
});
