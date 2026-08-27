'use client'

interface Props {
  currentDrawCount: number
  wipCap: number
}

/** ADR-0004: the team's real constraint is "N projects in Design/Build/Deploy at
 * once", not a weekly-bandwidth fraction — a plain project count reads clearer for
 * the company-wide, non-technical audience (ADR-0002) than a decimal. */
export default function CapacityChip({ currentDrawCount, wipCap }: Props) {
  const over = currentDrawCount > wipCap
  return (
    <span className="capacity-chip">
      <span className="dot" aria-hidden="true" style={{ background: over ? 'var(--danger)' : 'var(--blue-l)' }} />
      capacity: <b>{currentDrawCount} / {wipCap}</b>&nbsp;projects
    </span>
  )
}
