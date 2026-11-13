import React from 'react'
import { formatWeight } from '../../lib/utils'

export interface GradeQualityPanelProps {
  grossIntakeKg: number
  totalGradedKg: number
  gradeAKg: number
  gradeBKg: number
  gradeCKg: number
  theme?: 'dark' | 'light'
  className?: string
}

export const GradeQualityPanel: React.FC<GradeQualityPanelProps> = ({
  grossIntakeKg,
  totalGradedKg,
  gradeAKg,
  gradeBKg,
  gradeCKg,
  theme = 'dark',
  className = '',
}) => {
  const isDark = theme === 'dark'

  const yieldPct = grossIntakeKg > 0 ? (totalGradedKg / grossIntakeKg) * 100 : 0
  const shrinkageKg = Math.max(0, grossIntakeKg - totalGradedKg)
  const shrinkagePct = grossIntakeKg > 0 ? (shrinkageKg / grossIntakeKg) * 100 : 0

  const sumGrades = gradeAKg + gradeBKg + gradeCKg
  const pctA = sumGrades > 0 ? (gradeAKg / sumGrades) * 100 : 0
  const pctB = sumGrades > 0 ? (gradeBKg / sumGrades) * 100 : 0
  const pctC = sumGrades > 0 ? (gradeCKg / sumGrades) * 100 : 0

  const grades = [
    {
      code: 'Grade A',
      label: 'Super / Retail',
      kg: gradeAKg,
      pct: pctA,
      barColor: 'bg-emerald-500',
      textColor: isDark ? 'text-emerald-400' : 'text-emerald-700',
      borderColor: isDark ? 'border-emerald-500/30' : 'border-emerald-300',
      badgeBg: isDark ? 'bg-emerald-500/15' : 'bg-emerald-50',
    },
    {
      code: 'Grade B',
      label: 'Medium / HoReCa',
      kg: gradeBKg,
      pct: pctB,
      barColor: 'bg-sky-500',
      textColor: isDark ? 'text-sky-400' : 'text-sky-700',
      borderColor: isDark ? 'border-sky-500/30' : 'border-sky-300',
      badgeBg: isDark ? 'bg-sky-500/15' : 'bg-sky-50',
    },
    {
      code: 'Grade C',
      label: 'Small / Industrial',
      kg: gradeCKg,
      pct: pctC,
      barColor: 'bg-amber-500',
      textColor: isDark ? 'text-amber-400' : 'text-amber-700',
      borderColor: isDark ? 'border-amber-500/30' : 'border-amber-300',
      badgeBg: isDark ? 'bg-amber-500/15' : 'bg-amber-50',
    },
  ]

  return (
    <div
      className={`relative flex flex-col justify-between ${
        isDark
          ? 'bg-white/[0.04] border border-white/10 text-white'
          : 'bg-card border border-border text-foreground'
      } p-3 xl:p-3.5 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className={`text-sm xl:text-base font-bold tracking-tight uppercase ${isDark ? 'text-white' : 'text-foreground'}`}>
              Grade Distribution
            </h3>
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border ${
                isDark
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                  : 'border-amber-500/30 bg-amber-50 text-amber-700'
              }`}
            >
              Station 02
            </span>
          </div>
          <p className={`text-xs ${isDark ? 'text-white/60' : 'text-muted-foreground'}`}>
            Grade ratio &amp; sorting shrinkage
          </p>
        </div>

        {/* Recovery Yield Badge */}
        <div className="text-right shrink-0">
          <p className={`font-mono text-base xl:text-lg font-black tabular-nums leading-tight ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {yieldPct > 0 ? `${yieldPct.toFixed(1)}%` : '—'}
          </p>
          <p className={`text-xs font-mono ${isDark ? 'text-white/65' : 'text-muted-foreground'}`}>
            Recovery Yield
          </p>
        </div>
      </div>

      {/* Stacked Proportional Bar */}
      <div className="shrink-0 mb-2">
        <div className={`h-2.5 w-full rounded-full flex overflow-hidden ${isDark ? 'bg-white/10' : 'bg-muted'}`}>
          {sumGrades > 0 ? (
            <>
              <div
                style={{ width: `${pctA}%` }}
                className="h-full bg-emerald-500 transition-all duration-300"
                title={`Grade A: ${pctA.toFixed(1)}%`}
              />
              <div
                style={{ width: `${pctB}%` }}
                className="h-full bg-sky-500 transition-all duration-300"
                title={`Grade B: ${pctB.toFixed(1)}%`}
              />
              <div
                style={{ width: `${pctC}%` }}
                className="h-full bg-amber-500 transition-all duration-300"
                title={`Grade C: ${pctC.toFixed(1)}%`}
              />
            </>
          ) : (
            <div className={`h-full w-full ${isDark ? 'bg-white/10' : 'bg-muted'}`} />
          )}
        </div>
      </div>

      {/* Grade Rows */}
      <div className={`flex-1 min-h-0 flex flex-col justify-around divide-y ${isDark ? 'divide-white/10' : 'divide-border'}`}>
        {grades.map((g) => (
          <div key={g.code} className="py-1 first:pt-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${g.borderColor} ${g.badgeBg} ${g.textColor}`}
              >
                {g.code}
              </span>
              <span className={`text-xs truncate hidden xl:inline ${isDark ? 'text-white/70' : 'text-muted-foreground'}`}>
                {g.label}
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className={`font-mono text-sm font-bold tabular-nums mr-1.5 ${isDark ? 'text-white' : 'text-foreground'}`}>
                {formatWeight(g.kg)} kg
              </span>
              <span className={`font-mono text-xs font-bold ${g.textColor}`}>
                {g.pct > 0 ? `${g.pct.toFixed(0)}%` : '0%'}
              </span>
            </div>
          </div>
        ))}

        {/* Shrinkage & Reject Row */}
        <div className="py-1 last:pb-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                isDark
                  ? 'border-rose-500/30 bg-rose-500/15 text-rose-400'
                  : 'border-rose-300 bg-rose-50 text-rose-700'
              }`}
            >
              Shrinkage &amp; Reject
            </span>
            <span className={`text-xs truncate hidden xl:inline ${isDark ? 'text-white/50' : 'text-muted-foreground'}`}>
              Soil / Spoilage
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className={`font-mono text-sm font-bold tabular-nums mr-1.5 ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
              {formatWeight(shrinkageKg)} kg
            </span>
            <span className={`font-mono text-xs font-bold ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
              {shrinkagePct > 0 ? `${shrinkagePct.toFixed(0)}%` : '0%'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

