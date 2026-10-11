/**
 * Labels — print queue for pallet, grade and pouch labels.
 * Feedback follows laporan.pdf §9.8: "Printing…" then success or timeout.
 */
import { useState } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Input, Select } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { useToast } from '../components/feedback/Toast'

type LabelType = 'grade' | 'pallet' | 'packaging'

type LabelJob = {
  id: string
  code: string
  type: LabelType
  standard: string
  status: 'PENDING' | 'PRINTED'
  created: string
}

const TYPE_META: Record<LabelType, { label: string; standard: string; prefix: string }> = {
  grade: { label: 'Grade Pallet (GRD-...)', standard: 'QR code', prefix: 'GRD' },
  pallet: { label: 'Intake Pallet (PLT-...)', standard: 'QR code', prefix: 'PLT' },
  packaging: { label: 'Packaging Master Unit (ITF-14)', standard: 'ITF-14', prefix: 'PKG' },
}

const nextSeq = (jobs: LabelJob[], prefix: string) => {
  const existing = jobs.filter((job) => job.code.startsWith(`${prefix}-`)).length
  return String(existing + 1).padStart(4, '0')
}

export default function LabelsPage() {
  const toast = useToast()
  const [form, setForm] = useState({ code: '', type: 'grade' as LabelType })
  const [jobs, setJobs] = useState<LabelJob[]>([
    { id: '1', code: 'GRD-PLT-20261010-0001-A', type: 'grade', standard: 'QR code', status: 'PRINTED', created: '10:25' },
    { id: '2', code: 'GRD-PLT-20261010-0001-B', type: 'grade', standard: 'QR code', status: 'PRINTED', created: '10:30' },
    { id: '3', code: 'PLT-20261010-0001', type: 'pallet', standard: 'QR code', status: 'PRINTED', created: '10:15' },
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const meta = TYPE_META[form.type]
    const code = form.code.trim() || `${meta.prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${nextSeq(jobs, meta.prefix)}`
    setJobs([
      {
        id: String(Date.now()),
        code,
        type: form.type,
        standard: meta.standard,
        status: 'PENDING',
        created: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      },
      ...jobs,
    ])
    setForm({ code: '', type: form.type })
    toast.info('Label queued for printing.')
  }

  const handlePrint = (job: LabelJob) => {
    toast.warning(`Printing ${job.code}…`)
    window.setTimeout(() => {
      setJobs((current) => current.map((item) => (item.id === job.id ? { ...item, status: 'PRINTED' } : item)))
      toast.success(`Label ${job.code} printed.`)
    }, 1000)
  };

  const columns: Column<LabelJob>[] = [
    { key: 'code', label: 'Code', priority: true, render: (row) => <span className="mono cell-strong">{row.code}</span> },
    { key: 'type', label: 'Type', priority: true, render: (row) => <span className="t-small">{TYPE_META[row.type].label}</span> },
    { key: 'standard', label: 'Standard', render: (row) => <Badge tone="neutral">{row.standard}</Badge> },
    { key: 'created', label: 'Queued', render: (row) => <span className="mono t-small cell-secondary">{row.created}</span> },
    {
      key: 'status',
      label: 'Status',
      priority: true,
      render: (row) => (
        <Badge tone={row.status === 'PRINTED' ? 'success' : 'warning'} dot>
          {row.status === 'PRINTED' ? 'Printed' : 'Queued'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Print',
      align: 'right',
      render: (row) =>
        row.status === 'PENDING' ? (
          <Button size="sm" variant="primary" icon="print" onClick={() => handlePrint(row)}>
            Print
          </Button>
        ) : (
          <span className="t-caption text-text-light">Done</span>
        ),
    },
  ]

  const pending = jobs.filter((job) => job.status === 'PENDING')

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Labels"
        subtitle="Queue and print pallet, grade and packaging master labels."
        actions={<Badge tone={pending.length ? 'warning' : 'success'} dot>{pending.length} in queue</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        <Card title="Queue a label" subtitle="The code is generated when left empty.">
          <form className="stack-md" onSubmit={handleSubmit}>
            <Field label="Existing code (optional)" htmlFor="label-code" hint="Pouch, pallet, grade or packaging code.">
              <Input
                id="label-code"
                mono
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="PCH-PLT-20260914-0001-003"
              />
            </Field>

            <Field label="Label type" htmlFor="label-type" required>
              <Select
                id="label-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as LabelType })}
              >
                {(Object.keys(TYPE_META) as LabelType[]).map((key) => (
                  <option key={key} value={key}>
                    {TYPE_META[key].label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="row gap-sm">
              <Button type="submit" variant="primary" icon="plus" touch>
                Add to Queue
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Label preview" subtitle={`Standard: ${TYPE_META[form.type].standard}`}>
          <div className="label-preview">
            <div className="label-qr">
              <Icon name="qr" size={48} className="text-text-light" />
            </div>
            <div className="label-body">
              <p className="t-caption text-text-secondary uppercase">Preview</p>
              <p className="mono t-medium text-truncate">
                {form.code.trim() || `${TYPE_META[form.type].prefix}-YYYYMMDD-SEQ`}
              </p>
              <div className="divider" style={{ margin: '8px 0' }} />
              <dl className="stack-xs">
                <div className="label-row">
                  <dt>Commodity</dt>
                  <dd>Kentang</dd>
                </div>
                <div className="label-row">
                  <dt>Grade</dt>
                  <dd>A / B / C</dd>
                </div>
                <div className="label-row">
                  <dt>Weight</dt>
                  <dd>1 kg pouch</dd>
                </div>
              </dl>
              <div className="label-barcode" aria-hidden="true">
                {[3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 1, 2, 1, 3, 2, 1, 4].map((height, index) => (
                  <span key={index} style={{ width: index % 3 === 0 ? 3 : 1, height: height * 8 }} />
                ))}
              </div>
              <p className="t-caption text-text-light">
                GS1 Digital Link: https://{'{domain}'}/01/{'{GTIN}'}/10/{'{PALLET}'}-{'{GRADE}'}/21/{'{PCH}'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Print queue</h2>
        </div>
        <DataTable
          columns={columns}
          data={jobs}
          rowKey={(row) => row.id}
          emptyTitle="No labels in print queue."
          emptyDescription="The printer is ready — queue a label to start."
        />
      </section>
    </div>
  )
}
