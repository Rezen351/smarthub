export default function Logo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <img src="/logo.svg" alt="ENYX-Smart Hub" className={className} />
  )
}
