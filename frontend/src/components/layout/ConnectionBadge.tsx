import Badge from '../shared/Badge'

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected'

interface ConnectionBadgeProps {
  state: ConnectionState
  label?: string
}

const labels: Record<ConnectionState, string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  disconnected: 'Disconnected',
}

/**
 * Scale / MQTT connection badge shown in the navbar (laporan.pdf §9.8).
 */
export default function ConnectionBadge({ state, label }: ConnectionBadgeProps) {
  return (
    <Badge
      tone={state === 'connected' ? 'success' : state === 'reconnecting' ? 'warning' : 'neutral'}
      dot
      live={state !== 'disconnected'}
      className="hide-mobile"
      title={`Scale connection: ${labels[state]}`}
    >
      {label ?? 'Scale'} · {labels[state]}
    </Badge>
  )
}
