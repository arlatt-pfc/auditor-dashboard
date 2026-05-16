type UserProfileChipProps = {
  className?: string;
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
  showEmail?: boolean;
  showRole?: boolean;
};

export function UserProfileChip({
  className = "",
  email,
  fullName,
  role,
  showEmail = true,
  showRole = true,
}: UserProfileChipProps) {
  const displayName = fullName?.trim() || email?.trim() || "Usuario";
  const subtitle = [showRole ? formatRole(role) : null, showEmail ? email?.trim() : null].filter(Boolean).join(" • ");

  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm ${className}`.trim()}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold uppercase tracking-[0.08em] text-white">
        {getInitials(displayName)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
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
