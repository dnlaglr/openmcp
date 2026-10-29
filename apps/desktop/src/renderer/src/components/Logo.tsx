import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="15 16 68 68" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
      <g strokeWidth={6} strokeLinecap="round">
        <path d="M36.5 45.4 L 39.8 43.1 C 49 36.5, 52 28, 65 28" />
        <path d="M36 50 H 65" />
        <path d="M36.5 54.6 L 39.8 56.9 C 49 63.5, 52 72, 65 72" />
      </g>
      <circle cx={30} cy={50} r={12} fill="currentColor" stroke="none" />
      <g strokeWidth={5.5} strokeOpacity={0.5}>
        <circle cx={74} cy={28} r={6.5} />
        <circle cx={74} cy={50} r={6.5} />
        <circle cx={74} cy={72} r={6.5} />
      </g>
    </svg>
  );
}
