import * as React from 'react';

export type ScreenBreakpoint = 'mobile' | 'tablet' | 'desktop';

export function useResponsive() {
  const [width, setWidth] = React.useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 1280;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: any = null;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWidth(window.innerWidth);
      }, 50);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1280;
  const isDesktop = width >= 1280;

  const breakpoint: ScreenBreakpoint = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
    breakpoint,
  };
}
