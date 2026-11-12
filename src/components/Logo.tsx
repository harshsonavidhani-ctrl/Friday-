export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" rx="22" fill="#121a4b" />
      <path d="M18 24h12v40h10v12H18z" fill="#fbb424" />
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M56 24h12l16 52H72l-3-10H55l-3 10H40zM62 40l4 16h-8z"
      />
    </svg>
  );
}

export function Logo({ name, tagline, light }: { name: string; tagline?: string; light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="size-9 shrink-0 rounded-[10px] ring-1 ring-white/15" />
      <span className="leading-tight">
        <span className={`block text-[15px] font-extrabold tracking-tight ${light ? "text-white" : "text-brand-950"}`}>
          {name}
        </span>
        {tagline && (
          <span className={`block text-[11px] font-medium ${light ? "text-gold-300" : "text-gold-700"}`}>
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
