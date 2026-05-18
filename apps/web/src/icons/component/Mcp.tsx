import type { Ref, SVGProps } from 'react';
import { memo } from 'react';

function SvgMcp({ ref, ...props }: SVGProps<SVGSVGElement> & { ref?: Ref<SVGSVGElement> }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="7 7 166 166"
      width="1em"
      height="1em"
      ref={ref}
      {...props}
    >
      <path
        d="M23.6 85.253L86.202 22.651c8.644-8.644 22.658-8.644 31.301 0 8.644 8.644 8.644 22.658 0 31.301L70.225 101.23"
        stroke="currentColor"
        strokeWidth="11.067"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M70.879 100.578l46.625-46.626c8.644-8.644 22.659-8.644 31.302 0l.326.326c8.644 8.644 8.644 22.658 0 31.301l-56.618 56.619a3.267 3.267 0 000 4.433l11.626 11.626"
        stroke="currentColor"
        strokeWidth="11.067"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M101.853 38.301L55.553 84.601c-8.644 8.644-8.644 22.658 0 31.301 8.644 8.644 22.658 8.644 31.301 0l46.3-46.3"
        stroke="currentColor"
        strokeWidth="11.067"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
SvgMcp.displayName = 'McpIcon';
export default memo(SvgMcp);
