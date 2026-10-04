export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      <p className="mt-2 text-sm text-text-muted">Not built yet.</p>
    </div>
  );
}
