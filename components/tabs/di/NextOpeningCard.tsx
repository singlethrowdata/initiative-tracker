'use client'

import { useState } from 'react'

interface SizeEntry { startsInWeeks: number; finishesInWeeks: number }

interface Props {
  nextOpeningBySize: Record<'Small' | 'Medium' | 'Large', SizeEntry>
}

const SIZES: { key: 'Small' | 'Medium' | 'Large'; letter: string }[] = [
  { key: 'Small', letter: 'S' },
  { key: 'Medium', letter: 'M' },
  { key: 'Large', letter: 'L' },
]

/** Size picker swaps between the three pre-fetched capacity.nextOpeningBySize
 * entries client-side — no extra request per click, matching the mockup's
 * behavior, just wired to real numbers instead of hardcoded data-* attributes. */
export default function NextOpeningCard({ nextOpeningBySize }: Props) {
  const [size, setSize] = useState<'Small' | 'Medium' | 'Large'>('Medium')
  const entry = nextOpeningBySize[size]

  return (
    <section className="next-opening" aria-labelledby="next-opening-h">
      <div className="next-opening-label" id="next-opening-h">Next opening</div>
      <p className="next-opening-copy">
        A new <b>{size}</b> project requested today would start{' '}
        <b>{entry ? `~${entry.startsInWeeks.toFixed(1)} wks` : '\u2014'}</b> from now and finish{' '}
        <b>{entry ? `~${entry.finishesInWeeks.toFixed(1)} wks` : '\u2014'}</b> from now.
      </p>
      <div className="size-picker" role="group" aria-label="Estimate for a different size">
        <span className="size-picker-label">Estimate for a different size:</span>
        {SIZES.map(s => (
          <button
            key={s.key}
            type="button"
            className="size-btn"
            aria-pressed={size === s.key}
            onClick={() => setSize(s.key)}
          >
            {s.letter}
          </button>
        ))}
      </div>
    </section>
  )
}
