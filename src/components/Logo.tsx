/** MeLife işareti: tamamlanmaya yaklaşan bir halka + tik */
export default function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="ml-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2a27" />
          <stop offset="1" stopColor="#151514" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#ml-g)" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="rgba(143,208,169,.22)" strokeWidth="5" />
      <path d="M32 15 A17 17 0 1 1 15.8 37" fill="none" stroke="#8fd0a9" strokeWidth="5" strokeLinecap="round" />
      <path d="M24.5 32.5 l5.5 5.5 l10-11" fill="none" stroke="#f1ede5" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
