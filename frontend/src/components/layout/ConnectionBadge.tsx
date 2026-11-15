import { idText } from '@/lib/indonesian'
import Badge from '../shared/Badge'

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected'

interface ConnectionBadgeProps {
  state: ConnectionState
  label?: string
}

const labels: Record<ConnectionState, string> = {
  connected: 'Online',
  reconnecting: 'Checking',
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
      title={idText(`Server status: ${labels[state]}`)}
    >
      {idText(label ?? 'Server')} · {idText(labels[state])}
    </Badge>
  )
}
