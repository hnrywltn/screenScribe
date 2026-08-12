import type { ComponentType } from "react";

export default function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6">
      <Icon className="w-5 h-5 text-[var(--color-muted)] mb-3" />
      <h3 className="font-medium text-[var(--color-text)]">{title}</h3>
      <p className="mt-1.5 text-sm text-[var(--color-muted)]">{description}</p>
    </div>
  );
}
