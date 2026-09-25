export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="border border-border rounded-sm p-12 bg-surface text-center">
      <h2 className="text-2xl font-bold text-text mb-2">{title}</h2>
      <p className="text-text-secondary">This page is under development.</p>
    </div>
  )
}
