export default function PricingCard({
  title,
  price,
  period,
  description,
}: {
  title: string;
  price: string;
  period: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6 text-center">
      <h3 className="font-medium text-[var(--color-text)]">{title}</h3>
      <p className="mt-3 text-3xl font-semibold text-[var(--color-text)]">
        {price}
        <span className="text-sm font-normal text-[var(--color-muted)]"> {period}</span>
      </p>
      <p className="mt-3 text-sm text-[var(--color-muted)]">{description}</p>
    </div>
  );
}
