import { Link } from 'react-router-dom'
import Badge from '../components/shared/Badge'
import Icon, { type IconName } from '../components/shared/Icon'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'

interface WorkstationCard {
  id: string
  number: string
  title: string
  subtitle: string
  path: string
  icon: IconName
  tag: string
  badgeTone: 'accent' | 'success' | 'warning' | 'neutral'
  scaleName: string
  metric: string
}

const WORKSTATIONS: WorkstationCard[] = [
  {
    id: 'ws-1',
    number: '01',
    title: 'Reception',
    subtitle: 'Harvest intake weighing and buffer queue',
    path: '/dashboard/weighing',
    icon: 'scale',
    tag: 'STATION 01',
    badgeTone: 'accent',
    scaleName: 'Floor Scale (150 kg)',
    metric: '1,420 kg · 32 Warings',
  },
  {
    id: 'ws-2',
    number: '02',
    title: 'Sorting',
    subtitle: 'Sizing, washing, and grade weighing',
    path: '/dashboard/grading',
    icon: 'sortir',
    tag: 'STATION 02',
    badgeTone: 'success',
    scaleName: 'Floor Scale (100 kg)',
    metric: '91.4% Yield · 8.6% Loss',
  },
  {
    id: 'ws-3',
    number: '03',
    title: 'Packaging',
    subtitle: 'Retail pouches, cartons, and storage',
    path: '/dashboard/packaging',
    icon: 'package',
    tag: 'STATION 03',
    badgeTone: 'accent',
    scaleName: 'Bench Scale (30 kg)',
    metric: '680 pouches · 14 crates',
  },
]

interface ScaleTcpNode {
  id: string
  stationNum: string
  stationLabel: string
  scaleRole: string
  ip: string
  port: string
  slaveId: string
  capacity: string
  register: string
  status: 'ONLINE' | 'STANDBY' | 'OFFLINE'
}

export default function OperatorDashboardHome() {
  const savedSettings = (() => {
    try {
      const raw = localStorage.getItem('smarthub_scale_settings')
      if (raw) return JSON.parse(raw)
    } catch {
      // fallback
    }
    return null
  })()

  const tcpNodes: ScaleTcpNode[] = [
    {
      id: 'scale-01',
      stationNum: '01',
      stationLabel: 'Reception',
      scaleRole: 'Floor Scale',
      ip: savedSettings?.intake?.ip ?? '192.168.1.100',
      port: savedSettings?.intake?.port ?? '502',
      slaveId: savedSettings?.intake?.slaveId ?? '1',
      capacity: `${savedSettings?.intake?.capacityKg ?? '150'} kg`,
      register: `HR:${savedSettings?.intake?.weightRegister ?? '40001'}`,
      status: 'ONLINE',
    },
    {
      id: 'scale-02',
      stationNum: '02',
      stationLabel: 'Sorting',
      scaleRole: 'Floor Scale',
      ip: savedSettings?.grading?.ip ?? '192.168.1.101',
      port: savedSettings?.grading?.port ?? '502',
      slaveId: savedSettings?.grading?.slaveId ?? '1',
      capacity: `${savedSettings?.grading?.capacityKg ?? '100'} kg`,
      register: `HR:${savedSettings?.grading?.weightRegister ?? '40001'}`,
      status: 'ONLINE',
    },
    {
      id: 'scale-03',
      stationNum: '03',
      stationLabel: 'Packaging',
      scaleRole: 'Bench Scale',
      ip: savedSettings?.packaging?.ip ?? '192.168.1.102',
      port: savedSettings?.packaging?.port ?? '502',
      slaveId: savedSettings?.packaging?.slaveId ?? '1',
      capacity: `${savedSettings?.packaging?.capacityKg ?? '30'} kg`,
      register: `HR:${savedSettings?.packaging?.weightRegister ?? '40001'}`,
      status: 'ONLINE',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workstation Hub"
        subtitle="Select a physical workstation console to operate."
        actions={
          <Badge tone="success" dot live>
            3 Scales Online
          </Badge>
        }
      />

      {/* Hardware Link Banner */}
      <div className="border border-border bg-card p-4 rounded-none shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-border/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-emerald-300 bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
              <Icon name="dashboard" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-foreground uppercase tracking-wide">
                  Hardware Link
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-1.5 py-0.5 font-semibold">
                  Port 502 · Online
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Modbus TCP connections to 3 physical scale transmitters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Bus:</span>
              <span className="font-semibold text-foreground">Modbus TCP</span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Poll Rate:</span>
              <span className="font-semibold text-foreground">250 ms</span>
            </div>
          </div>
        </div>

        {/* 3 Physical Modbus TCP Hardware Node Connections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {tcpNodes.map((node) => (
            <div
              key={node.id}
              className="p-3 bg-muted/20 border border-border/80 flex flex-col justify-between gap-2.5 font-mono text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-background border border-border flex items-center justify-center text-[10px] font-bold text-foreground">
                    {node.stationNum}
                  </span>
                  <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                    {node.stationLabel}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  {node.status}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-foreground font-mono">
                    {node.ip}:{node.port}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Slave ID: {node.slaveId}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{node.scaleRole}</span>
                  <span className="font-semibold text-foreground">Max {node.capacity}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Hold Reg: {node.register}</span>
                <span className="text-emerald-700 font-semibold">Live</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today Gross Intake"
          value="1,420 kg"
          sub="32 Warings"
          icon="scale"
          trend="up"
        />
        <StatCard
          label="Buffer Queue"
          value="14 Warings"
          sub="Awaiting sorting"
          icon="box"
          trend="neutral"
        />
        <StatCard
          label="Yield Efficiency"
          value="91.4%"
          sub="8.6% Shrinkage"
          icon="clipboard"
          trend="up"
        />
        <StatCard
          label="Finished Goods Stock"
          value="1,840 units"
          sub="Ready for dispatch"
          icon="package"
          trend="neutral"
        />
      </div>

      {/* 3 Workstation Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Workstations
            </h2>
            <p className="text-xs text-muted-foreground">
              Select a physical workstation to operate.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            3 Online
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {WORKSTATIONS.map((ws) => (
            <Link
              key={ws.id}
              to={ws.path}
              className="group block border border-border bg-card p-6 rounded-none shadow-xs hover:border-[#229856] hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 border border-border bg-muted/40 group-hover:bg-emerald-50 group-hover:border-emerald-300 text-foreground group-hover:text-emerald-800 flex items-center justify-center font-bold text-lg font-mono transition-colors">
                    {ws.number}
                  </div>
                  <Badge tone={ws.badgeTone}>
                    {ws.tag}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-foreground tracking-tight group-hover:text-[#0E5030] transition-colors">
                    {ws.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {ws.subtitle}
                  </p>
                </div>

                <div className="p-3 bg-muted/20 border border-border/80 text-xs space-y-1.5 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Hardware:</span>
                    <span className="font-semibold text-foreground">{ws.scaleName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Today Run:</span>
                    <span className="font-semibold text-[#0E5030]">{ws.metric}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border mt-4 flex items-center justify-between text-xs font-bold text-[#0E5030]">
                <span>Open Console</span>
                <Icon name="check" size={16} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
