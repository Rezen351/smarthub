import Badge from '../shared/Badge'

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected'

interface ConnectionBadgeProps {
  state: ConnectionState
  label?: string
}

const labels: Record<ConnectionState, string> = {
  connected: 'Terhubung',
  reconnecting: 'Memeriksa',
  disconnected: 'Terputus',
}

/**
 * Server status badge shown in the navbar.
 */
export default function ConnectionBadge({ state, label }: ConnectionBadgeProps) {
  return (
    <Badge
      tone={state === 'connected' ? 'success' : state === 'reconnecting' ? 'warning' : 'neutral'}
      dot
      live={state !== 'disconnected'}
      title={`Status server: ${labels[state]}`}
    >
      {label ?? 'Server'} · {labels[state]}
    </Badge>
  )
}
