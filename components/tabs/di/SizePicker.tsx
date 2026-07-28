'use client'

import { useEffect, useState } from 'react'
import { SIZE_VALUES, DEFAULT_SIZE_PRESETS, SizePreset } from '@/lib/di-scheduling'

interface Props {
  onPick: (preset: SizePreset) => void
}

// Pre-fills the five phase-week fields from a Small/Medium/Large preset — a starting
// point, not a persisted property of the initiative. Values stay editable afterward, and
// the presets themselves live in di_config so they can be tuned without a redeploy (see
// docs/adr/0003-estimate-buffer.md).
export default function SizePicker({ onPick }: Props) {
  const [presets, setPresets] = useState<Record<string, SizePreset>>(DEFAULT_SIZE_PRESETS)

  useEffect(() => {
    fetch('/api/di-config')
      .then(r => r.json())
      .then(cfg => {
        if (!cfg.size_presets) return
        try {
          setPresets(JSON.parse(cfg.size_presets))
        } catch {
          // malformed config — fall back to the built-in defaults
        }
      })
  }, [])

  return (
    <select
      defaultValue=""
      onChange={e => {
        const preset = presets[e.target.value]
        if (preset) onPick(preset)
        e.target.value = ''
      }}
    >
      <option value="">Size — pre-fill phase weeks…</option>
      {SIZE_VALUES.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}
