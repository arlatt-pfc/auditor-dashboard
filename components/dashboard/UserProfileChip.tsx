type UserProfileChipProps = {
  className?: string;
  email?: string | null;
  fullName?: string | null;
  interactive?: boolean;
  role?: string | null;
  showEmail?: boolean;
  showRole?: boolean;
};

export function UserProfileChip({
  className = "",
  email,
  fullName,
  interactive = false,
  role,
  showEmail = true,
  showRole = true,
}: UserProfileChipProps) {
  const displayName = fullName?.trim() || email?.trim() || "Usuario";
  const subtitle = [showRole ? formatRole(role) : null, showEmail ? email?.trim() : null].filter(Boolean).join(" • ");
  const rootClassName = `rounded-2xl border border-slate-200 bg-white/95 shadow-sm ${className}`.trim();
  const content = (
    <>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold uppercase tracking-[0.08em] text-white">
        {getInitials(displayName)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </>
  );

  if (!interactive) {
    return <div className={`flex items-center gap-3 px-4 py-3 ${rootClassName}`}>{content}</div>;
  }

  return (
    <details className={`group relative ${rootClassName}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden focus:outline-none">
        {content}
        <span aria-hidden="true" className="shrink-0 text-slate-400 transition group-open:rotate-180">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
        </span>
      </summary>
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-full min-w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
          {subtitle ? <p className="mt-1 truncate text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
            type="submit"
          >
            <span>Cerrar sesion</span>
            <span aria-hidden="true" className="text-slate-400">↗</span>
          </button>
        </form>
      </div>
    </details>
  );
}

function getInitials(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length > 1) {
    return `${words[0]?.[0] ?? ""}${words[words.length - 1]?.[0] ?? ""}`.toUpperCase();
  }

  const compactValue = value.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "") ?? "";
  return compactValue.slice(0, 2).toUpperCase() || "US";
}

function formatRole(role?: string | null) {
  if (!role) {
    return null;
  }

  return role
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}
