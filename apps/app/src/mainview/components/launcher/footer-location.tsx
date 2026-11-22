import type { LucideIcon } from "lucide-react";

interface FooterLocationProps {
  icon: LucideIcon;
  label: string;
}

export function FooterLocation({ icon: Icon, label }: FooterLocationProps) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 type-meta">
      <Icon aria-hidden className="size-3.5 shrink-0 opacity-80" />
      <span className="truncate">{label}</span>
    </span>
  );
}
