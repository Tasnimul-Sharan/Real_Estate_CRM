import type { SVGProps } from "react";

const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  leads: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M20 8v6 M17 11h6 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  building: "M4 21V5l10-3v19 M14 9h6v12 M2 21h20 M8 7h2 M8 11h2 M8 15h2 M8 19h2 M17 13h1 M17 17h1",
  plots: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5 M9 3v16 M15 5v16",
  calendar: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M8 14h2 M14 14h2 M8 18h2",
  wallet: "M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6 M20 12h-5v5h5 M17 14.5h.01",
  briefcase: "M8 6V3h8v3 M3 6h18v14H3z M3 11a22 22 0 0 0 18 0 M10 12h4v3h-4z",
  logout: "M9 21H4V3h5 M14 8l5 4-5 4 M8 12h12",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  arrowUp: "M7 17 17 7 M7 7h10v10",
  plus: "M12 5v14 M5 12h14",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  chevron: "m9 5 7 7-7 7",
  check: "m5 12 4 4L19 6",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2",
  close: "m6 6 12 12 M6 18 18 6",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3 M8 12l3 3 5-6",
  home: "m3 10 9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3 M9 7h6 M9 11h6 M9 15h3",
  mail: "M3 5h18v14H3z m0 0 9 8 9-8",
  lock: "M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4",
  refresh: "M20 7v5h-5 M4 17v-5h5 M6 6a8 8 0 0 1 13 2l1 4 M4 12l1 4a8 8 0 0 0 13 2",
} as const;
export type IconName = keyof typeof paths;
export default function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}><path d={paths[name]} /></svg>;
}
