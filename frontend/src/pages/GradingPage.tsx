/**
 * Grading — Area Sortir (Sorting).
 *
 * No scale in this area: the operator allocates the pallet's approved weight to
 * grade A/B/C groups and prints a grade label per group (laporan.pdf §9.4).
 */
import { useState } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import { Field, Input, Select } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import ConfirmDialog from '../components/feedback/ConfirmDialog'
import { useToast } from '../components/feedback/Toast'

type GradeRecord = {
  id: string
  palletCode: string
  grade: 'A' | 'B' | 'C'
  weightKg: number
  labelCode: string
  time: string
}

type ApprovedPallet = {
  code: string
  farmer: string
  totalKg: number
  allocatedKg: number
}

const GRADES: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C']

const GRADE_TONE: Record<GradeRecord['grade'], 'success' | 'accent' | 'warning'> = {
  A: 'success',
  B: 'accent',
  C: 'warning',
}

export default function GradingPage() {
  const toast = useToast()
  const [palletCode, setPalletCode] = useState('PLT-20260914-0001')
  const [grade, setGrade] = useState<'A' | 'B' | 'C'>('A')
  const [weightKg, setWeightKg] = useState('')
  const [confirmRecord, setConfirmRecord] = useState<GradeRecord | null>(null)

  const [pallets] = useState<ApprovedPallet[]>([
    { code: 'PLT-20260914-0001', farmer: 'Ahmad Santoso', totalKg: 45.5, allocatedKg: 45.5 },
    { code: 'PLT-20260913-0002', farmer: 'Budi Prasetyo', totalKg: 38.2, allocatedKg: 0 },
  ])

  const [records, setRecords] = useState<GradeRecord[]>([
    {
      id: '1',
      palletCode: 'PLT-20260914-0001',
      grade: 'A',
      weightKg: 45.5,
      labelCode: 'GRD-PLT-20260914-0001-A',
      time: '10:15',
    },
    {
      id: '2',
      palletCode: 'PLT-20260914-0001',
      grade: 'B',
      weightKg: 30.0,
      labelCode: 'GRD-PLT-20260914-0001-B',
      time: '10:20',
    },
  ])

  const selectedPallet = pallets.find((item) => item.code === palletCode) ?? pallets[0]
  const remainingKg = Math.max(0, selectedPallet.totalKg - selectedPallet.allocatedKg)
  const gradeTotal = (target: GradeRecord['grade']) =>
    records.filter((item) => item.palletCode === selectedPallet.code && item.grade === target)
      .reduce((sum, item) => sum + item.weightKg, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(weightKg)
    if (!(value > 0)) {
      toast.error('Allocated weight must be greater than 0 kg.')
      return
    }
    if (value > remainingKg) {
      toast.error(`Only ${remainingKg.toFixed(1)} kg of this pallet is still unallocated.`)
      return
    }

    setConfirmRecord({
      id: String(Date.now()),
      palletCode: selectedPallet.code,
      grade,
      weightKg: value,
      labelCode: `GRD-${selectedPallet.code}-${grade}`,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    })
  }

  const confirmSorting = () => {
    if (!confirmRecord) return
    setRecords((current) => [confirmRecord, ...current])
    toast.success(`Grade ${confirmRecord.grade} recorded (${confirmRecord.weightKg} kg) — label ${confirmRecord.labelCode}.`)
    setConfirmRecord(null)
    setWeightKg('')
  }

  const printGradeLabel = (record: GradeRecord) => {
    toast.warning(`Printing label ${record.labelCode}…`)
    window.setTimeout(() => toast.success(`Label ${record.labelCode} sent to printer.`), 900)
  }

  const columns: Column<GradeRecord>[] = [
    { key: 'time', label: 'Time', render: (row) => <span className="mono t-small">{row.time}</span> },
    { key: 'labelCode', label: 'Label code', priority: true, render: (row) => <span className="mono cell-strong">{row.labelCode}</span> },
    { key: 'palletCode', label: 'Pallet', render: (row) => <span className="mono t-small cell-secondary">{row.palletCode}</span> },
    {
      key: 'grade',
      label: 'Grade',
      priority: true,
      render: (row) => <Badge tone={GRADE_TONE[row.grade]}>{row.grade}</Badge>,
    },
    {
      key: 'weightKg',
      label: 'Weight (kg)',
      align: 'right',
      render: (row) => <span className="cell-strong">{row.weightKg.toFixed(1)}</span>,
    },
    {
      key: 'actions',
      label: 'Label',
      align: 'right',
      priority: true,
      render: (row) => (
        <Button size="sm" variant="outline" icon="print" onClick={() => printGradeLabel(row)}>
          Print
        </Button>
      ),
    },
  ]

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Grading"
        subtitle="Sorting area — allocate the pallet weight to grade A/B/C and print a label per group."
        actions={<Badge tone="neutral" icon="info">No scale in this area</Badge>}
      />

      <Card
        title="Pallet in sorting"
        subtitle={`Approved weight ${selectedPallet.totalKg.toFixed(1)} kg · allocated ${selectedPallet.allocatedKg.toFixed(1)} kg`}
      >
        <div className="stack-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Field label="Pallet" htmlFor="grading-pallet" required hint="Only approved pallets are listed.">
              <Select
                id="grading-pallet"
                mono
                value={palletCode}
                onChange={(e) => setPalletCode(e.target.value)}
              >
                {pallets.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} — {item.farmer}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Grade" htmlFor="grading-grade" required>
              <Select
                id="grading-grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value as GradeRecord['grade'])}
              >
                {GRADES.map((item) => (
                  <option key={item} value={item}>
                    Grade {item}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="row gap-md flex-wrap">
            {GRADES.map((item) => (
              <span className="conn-badge" key={item}>
                Grade {item}: <strong className="mono">{gradeTotal(item).toFixed(1)} kg</strong>
              </span>
            ))}
            <span className="conn-badge">
              Unallocated: <strong className="mono">{remainingKg.toFixed(1)} kg</strong>
            </span>
          </div>
        </div>
      </Card>

      <Card title="Allocate to grade" subtitle="Weight per grade comes from the sorting result.">
        <form className="stack-md" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Field
              label="Weight for this grade (kg)"
              htmlFor="grading-weight"
              required
              hint={`Maximum ${remainingKg.toFixed(1)} kg from pallet ${selectedPallet.code}.`}
            >
              <Input
                id="grading-weight"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max={remainingKg}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="0.0"
                required
              />
            </Field>
            <Field label="Label code" htmlFor="grading-label" hint="Generated automatically as GRD-{pallet}-{grade}.">
              <Input id="grading-label" mono value={`GRD-${selectedPallet.code}-${grade}`} readOnly />
            </Field>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(100, (selectedPallet.allocatedKg / selectedPallet.totalKg) * 100)}%` }}
            />
          </div>

          <div className="row gap-sm">
            <Button type="submit" variant="primary" icon="check" touch>
              Record Grade
            </Button>
            <span className="t-caption text-text-light">
              Confirmation shows a summary before the record is written.
            </span>
          </div>
        </form>
      </Card>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Sorting records</h2>
          <span className="t-caption text-text-secondary">{records.length} groups labelled</span>
        </div>
        <DataTable
          columns={columns}
          data={records}
          rowKey={(row) => row.id}
          emptyTitle="No sorting records for this pallet."
          emptyDescription="Sorting takes place after the pallet weight is approved."
        />
      </section>

      <ConfirmDialog
        open={Boolean(confirmRecord)}
        tone="accent"
        title="Confirm sorting result?"
        description={
          confirmRecord ? (
            <>
              Record <strong>{confirmRecord.weightKg.toFixed(1)} kg</strong> as grade{' '}
              <strong>{confirmRecord.grade}</strong> for pallet <strong>{confirmRecord.palletCode}</strong>? Label{' '}
              <strong>{confirmRecord.labelCode}</strong> will be queued for printing.
            </>
          ) : null
        }
        confirmLabel="Yes, Record"
        onConfirm={confirmSorting}
        onCancel={() => setConfirmRecord(null)}
      />
    </div>
  )
}
