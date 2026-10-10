/**
 * Grading — Area Sortir (Sorting).
 *
 * Implements the verified sorting flow:
 *   1. Scan / select approved intake pallet (PLT-...).
 *   2. Classify harvest into Grade A, B, or C.
 *   3. Print Grade Label (GRD-PLT-...-[GRADE]) to affix to the sorted pallet/crate.
 *   No scale in this area — weight per grade is captured downstream during 1 kg pouch packing.
 */
import { useState } from 'react'
import Card from '../components/shared/Card'
import Badge from '../components/shared/Badge'
import Button from '../components/shared/Button'
import Icon from '../components/shared/Icon'
import { Field, Input, Select } from '../components/shared/Form'
import DataTable, { type Column } from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import ConfirmDialog from '../components/feedback/ConfirmDialog'
import { useToast } from '../components/feedback/Toast'

type GradeRecord = {
  id: string
  palletCode: string
  farmer: string
  grade: 'A' | 'B' | 'C'
  labelCode: string
  time: string
  printedCount: number
}

type ApprovedPallet = {
  code: string
  farmer: string
  totalKg: number
  depositDate: string
}

const GRADES: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C']

const GRADE_TONE: Record<GradeRecord['grade'], 'success' | 'accent' | 'warning'> = {
  A: 'success',
  B: 'accent',
  C: 'warning',
}

export default function GradingPage() {
  const toast = useToast()
  const [palletCode, setPalletCode] = useState('PLT-20261010-0001')
  const [grade, setGrade] = useState<'A' | 'B' | 'C'>('A')
  const [confirmRecord, setConfirmRecord] = useState<GradeRecord | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)

  const [pallets] = useState<ApprovedPallet[]>([
    { code: 'PLT-20261010-0001', farmer: 'Ahmad Santoso', totalKg: 45.5, depositDate: '2026-10-10' },
    { code: 'PLT-20261010-0002', farmer: 'Budi Prasetyo', totalKg: 38.2, depositDate: '2026-10-10' },
  ])

  const [records, setRecords] = useState<GradeRecord[]>([
    {
      id: '1',
      palletCode: 'PLT-20261010-0001',
      farmer: 'Ahmad Santoso',
      grade: 'A',
      labelCode: 'GRD-PLT-20261010-0001-A',
      time: '10:25',
      printedCount: 1,
    },
    {
      id: '2',
      palletCode: 'PLT-20261010-0001',
      farmer: 'Ahmad Santoso',
      grade: 'B',
      labelCode: 'GRD-PLT-20261010-0001-B',
      time: '10:30',
      printedCount: 1,
    },
  ])

  const selectedPallet = pallets.find((item) => item.code === palletCode) ?? pallets[0]

  const handlePrintRequest = (e: React.FormEvent) => {
    e.preventDefault()
    const targetLabel = `GRD-${selectedPallet.code}-${grade}`
    setConfirmRecord({
      id: String(Date.now()),
      palletCode: selectedPallet.code,
      farmer: selectedPallet.farmer,
      grade,
      labelCode: targetLabel,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      printedCount: 1,
    })
  }

  const confirmAndPrint = () => {
    if (!confirmRecord) return
    setIsPrinting(true)
    toast.warning(`Sending Grade Label ${confirmRecord.labelCode} to printer…`)

    window.setTimeout(() => {
      setIsPrinting(false)
      setRecords((current) => [confirmRecord, ...current])
      toast.success(`Grade ${confirmRecord.grade} label printed! Affix to sorted pallet.`)
      setConfirmRecord(null)
    }, 700)
  }

  const rePrintGradeLabel = (record: GradeRecord) => {
    toast.warning(`Re-printing label ${record.labelCode}…`)
    window.setTimeout(() => {
      setRecords((current) =>
        current.map((item) =>
          item.id === record.id ? { ...item, printedCount: item.printedCount + 1 } : item,
        ),
      )
      toast.success(`Label ${record.labelCode} re-printed successfully.`)
    }, 700)
  }

  const columns: Column<GradeRecord>[] = [
    { key: 'time', label: 'Time', render: (row) => <span className="mono t-small">{row.time}</span> },
    { key: 'labelCode', label: 'Label Code', priority: true, render: (row) => <span className="mono cell-strong">{row.labelCode}</span> },
    { key: 'palletCode', label: 'Intake Pallet', render: (row) => <span className="mono t-small cell-secondary">{row.palletCode}</span> },
    { key: 'farmer', label: 'Farmer', render: (row) => <span className="cell-strong text-sm">{row.farmer}</span> },
    {
      key: 'grade',
      label: 'Grade',
      priority: true,
      render: (row) => <Badge tone={GRADE_TONE[row.grade]}>Grade {row.grade}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      priority: true,
      render: (row) => (
        <Button size="sm" variant="outline" icon="print" onClick={() => rePrintGradeLabel(row)}>
          Re-Print ({row.printedCount})
        </Button>
      ),
    },
  ]

  return (
    <div className="stack stack-lg">
      <PageHeader
        title="Grading & Sorting"
        subtitle="Sorting area — scan intake pallet, classify into Grade A/B/C, and print grade label for the sorted pallet (no scale in this area)."
        actions={<Badge tone="neutral" icon="info">Pure Classification · No Scale</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        {/* Intake Pallet Context */}
        <Card
          title="Intake Pallet in Sorting"
          subtitle="Scan or select the approved intake pallet currently being sorted."
        >
          <div className="stack-md">
            <Field label="Intake Pallet (PLT-...)" htmlFor="grading-pallet" required hint="Scan QR code from pallet box.">
              <Select
                id="grading-pallet"
                mono
                value={palletCode}
                onChange={(e) => setPalletCode(e.target.value)}
              >
                {pallets.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} — {item.farmer} ({item.totalKg.toFixed(1)} kg)
                  </option>
                ))}
              </Select>
            </Field>

            <div className="p-3 bg-surface-2 border border-border rounded-lg stack-xs">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Farmer:</span>
                <span className="font-semibold">{selectedPallet.farmer}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Approved Net Weight:</span>
                <span className="mono font-bold text-green-700">{selectedPallet.totalKg.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Deposit Date:</span>
                <span className="mono">{selectedPallet.depositDate}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Commodity:</span>
                <span>Kentang (Potatoes)</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Grade Classification & Label Printing */}
        <div className="lg:col-span-2">
          <Card
            title="Classify & Print Grade Label"
            subtitle="Select the sorted grade and print the label to affix to the sorted pallet."
          >
            <form className="stack-md" onSubmit={handlePrintRequest}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md items-end">
                <Field label="Sorted Grade" htmlFor="grading-grade" required hint="Quality classification result.">
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

                <Field label="Target Grade Label Code" htmlFor="grading-label" hint="System-generated label format.">
                  <Input id="grading-label" mono value={`GRD-${selectedPallet.code}-${grade}`} readOnly />
                </Field>
              </div>

              {/* Label Preview Card */}
              <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-surface flex items-center justify-between flex-wrap gap-3">
                <div className="stack-xs">
                  <span className="t-caption text-text-secondary uppercase">Label Preview</span>
                  <span className="mono font-bold text-base">GRD-{selectedPallet.code}-{grade}</span>
                  <span className="t-caption text-text-secondary">
                    Sorted Pallet · Grade {grade} · Kentang (Potatoes) · Source: {selectedPallet.code}
                  </span>
                </div>
                <Button type="submit" variant="primary" icon="print" touch size="md">
                  Print Grade Label
                </Button>
              </div>

              <p className="t-caption text-text-secondary">
                <Icon name="info" size={13} /> Sesuai SOP, Area Sortir tidak memiliki timbangan. Tempel label grade ini pada palet hasil sortir sebelum dialirkan ke Area Pengepakan.
              </p>
            </form>
          </Card>
        </div>
      </div>

      <section className="stack-sm">
        <div className="section-header">
          <h2 className="section-title">Sorted Pallet Labels Today</h2>
          <span className="t-caption text-text-secondary">{records.length} grade labels issued</span>
        </div>
        <DataTable
          columns={columns}
          data={records}
          rowKey={(row) => row.id}
          emptyTitle="No sorting labels printed yet."
          emptyDescription="Scan an intake pallet and print the first grade label."
        />
      </section>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmRecord)}
        tone="accent"
        title="Print Sorted Pallet Grade Label?"
        description={
          confirmRecord ? (
            <>
              Print grade label <strong>{confirmRecord.labelCode}</strong> for{' '}
              <strong>Grade {confirmRecord.grade}</strong> (Source: {confirmRecord.palletCode})?
              Affix this label to the sorted pallet.
            </>
          ) : null
        }
        confirmLabel={isPrinting ? 'Printing…' : 'Yes, Print Label'}
        onConfirm={confirmAndPrint}
        onCancel={() => setConfirmRecord(null)}
      />
    </div>
  )
}
