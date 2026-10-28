// Íconos de trazo (24x24). Decorativos por defecto: aria-hidden.
function Svg({ size = 18, strokeWidth = 2, children, ...rest }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconBag = (p) => <Svg {...p}><path d="M6 7h12l-1 13H7z" /><path d="M9 7a3 3 0 0 1 6 0" /></Svg>;
export const IconHome = (p) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></Svg>;
export const IconTag = (p) => <Svg {...p}><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="7.5" r="1.5" /></Svg>;
export const IconChart = (p) => <Svg {...p}><path d="M4 20V11" /><path d="M10 20V5" /><path d="M16 20v-7" /><path d="M21 20H3" /></Svg>;
export const IconShield = (p) => <Svg {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="m9 12 2 2 4-4" /></Svg>;
export const IconLogout = (p) => <Svg {...p}><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></Svg>;
export const IconSearch = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const IconPlus = (p) => <Svg strokeWidth={2.2} {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconMinus = (p) => <Svg strokeWidth={2.4} {...p}><path d="M5 12h14" /></Svg>;
export const IconChevron = (p) => <Svg strokeWidth={2.2} {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const IconBack = (p) => <Svg strokeWidth={2.2} {...p}><path d="m15 6-6 6 6 6" /></Svg>;
export const IconCheck = (p) => <Svg strokeWidth={3} {...p}><path d="m5 12 5 5 9-10" /></Svg>;
export const IconX = (p) => <Svg strokeWidth={2.4} {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconDownload = (p) => <Svg {...p}><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></Svg>;
export const IconRefresh = (p) => <Svg {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></Svg>;
export const IconMail = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>;
export const IconEdit = (p) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></Svg>;
export const IconTrash = (p) => <Svg {...p}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></Svg>;
export const IconArrow = (p) => <Svg strokeWidth={2.2} {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Svg>;
export const IconCloudOff = (p) => (
  <Svg {...p}>
    <path d="M3 3l18 18" />
    <path d="M8.5 8.6A5 5 0 0 0 6 18h11" />
    <path d="M20.4 16.6A4 4 0 0 0 17 10h-.3A6 6 0 0 0 10 6.1" />
  </Svg>
);

// Íconos por categoría de producto (cuando no hay foto)
export const IconBread = (p) => <Svg strokeWidth={1.5} {...p}><path d="M5 11a7 4.5 0 0 1 14 0v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" /><path d="M9 9.5l1 2M13 9.5l1 2" /></Svg>;
export const IconCake = (p) => <Svg strokeWidth={1.5} {...p}><path d="M4 20h16v-7H4z" /><path d="M4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 0" /><path d="M12 13V9" /><path d="M12 6.5a1 1 0 0 1 0-2" /></Svg>;
export const IconCup = (p) => <Svg strokeWidth={1.5} {...p}><path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M8 3v2M11 3v2" /></Svg>;
export const IconSandwich = (p) => <Svg strokeWidth={1.5} {...p}><path d="M3 10 12 4l9 6z" /><path d="M3 14h18" /><path d="M4 18h16" /></Svg>;
export const IconBottle = (p) => <Svg strokeWidth={1.5} {...p}><path d="M10 3h4v3l2 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z" /><path d="M8 13h8" /></Svg>;

export function CategoryIcon({ category, ...rest }) {
  const key = (category || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (key.startsWith('pastel')) return <IconCake {...rest} />;
  if (key.startsWith('cafe')) return <IconCup {...rest} />;
  if (key.startsWith('sandw')) return <IconSandwich {...rest} />;
  if (key.startsWith('bebid')) return <IconBottle {...rest} />;
  return <IconBread {...rest} />;
}

export const IconBell = (p) => (
  <Svg {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Svg>
);
