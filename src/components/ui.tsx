/* Form ve düzen için küçük, tekrar kullanılabilir parçalar (MeDebit'ten uyarlandı) */

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-text-muted mt-1.5">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`segmented-item ${value === o.value ? 'active text-accent' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SectionHeader({ icon, title, subtitle, action }: {
  icon?: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h3 className="section-title">{icon}{title}</h3>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }: {
  eyebrow?: React.ReactNode; title: string; subtitle?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="text-sm text-text-muted mt-1">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ pct, color, height = 8 }: { pct: number; color: string; height?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden bg-surface-el" style={{ height }}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(Math.min(pct, 100), 0)}%`, background: color }} />
    </div>
  );
}

export function EmptyHint({ icon, text, action }: { icon?: React.ReactNode; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-10 px-6 rounded-3xl border border-dashed border-border text-text-muted">
      {icon && <div className="w-12 h-12 rounded-2xl bg-surface-el flex items-center justify-center">{icon}</div>}
      <p className="text-sm max-w-xs leading-relaxed">{text}</p>
      {action}
    </div>
  );
}

/** Dairesel ilerleme halkası */
export function Ring({ pct, size = 72, stroke = 8, color = 'var(--accent-base)', children }: {
  pct: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-el)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 min-h-0 min-w-0 rounded-full transition-colors shrink-0 ${checked ? 'bg-accent' : 'bg-surface-hover'}`}
    >
      <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}
