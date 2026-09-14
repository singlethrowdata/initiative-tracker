'use client'

interface Props {
  drawByOwner: { owner: string; count: number }[]
  wipCapPerOwner: number
}

/** ADR-0004, corrected by ADR-0006: the team's real constraint is "N projects in
 * Design/Build/Deploy at once per owner" (lexicon.md: Owner is currently building
 * it), not a shared team-wide count — Charles and Darian each have their own
 * bandwidth, so one person being at cap doesn't mean the team is. One chip per
 * owner who currently has work in flight. */
export default function CapacityChip({ drawByOwner, wipCapPerOwner }: Props) {
  if (!drawByOwner.length) return null
  return (
    <div className="capacity-chips">
      {drawByOwner.map(({ owner, count }) => {
        const over = count > wipCapPerOwner
        return (
          <span className="capacity-chip" key={owner}>
            <span className="dot" aria-hidden="true" style={{ background: over ? 'var(--danger)' : 'var(--blue-l)' }} />
            {owner}: <b>{count} / {wipCapPerOwner}</b>
          </span>
        )
      })}
    </div>
  )
}
