'use client'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onClose }: Props) {
  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <h3>{title}</h3>
        <p style={{ color: 'var(--text-2)', fontSize: '.88rem', lineHeight: 1.6, margin: '1rem 0 1.5rem' }}>{message}</p>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger-o" style={{ background: 'var(--danger)', color: '#fff', border: 'none' }} onClick={() => { onConfirm(); onClose() }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
