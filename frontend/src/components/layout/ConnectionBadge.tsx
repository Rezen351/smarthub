import Badge from '../shared/Badge'

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected'

interface ConnectionBadgeProps {
  state: ConnectionState
  label?: string
}

const labels: Record<ConnectionState, string> = {
  connected: 'Running',
  reconnecting: 'Reconnecting',
  disconnected: 'Offline',
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
      className="hide-mobile"
      title={`Server status: ${labels[state]}`}
    >
      {label ?? 'Server'} · {labels[state]}
    </Badge>
  )
}
