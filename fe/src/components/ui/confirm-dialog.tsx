'use client'

import { useEffect } from 'react'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  badge?: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  badge,
  confirmLabel = 'Xác nhận xóa',
  cancelLabel = 'Hủy bỏ',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div
      className="confirm-modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel()
      }}
    >
      <section
        className="confirm-modal-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-modal-head">
          <div className="confirm-modal-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <div className="confirm-modal-copy">
            {badge && <span className="confirm-modal-badge">{badge}</span>}
            <h3 id="confirm-modal-title">{title}</h3>
            <p id="confirm-modal-desc">{description}</p>
          </div>
        </div>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="button button-secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="button confirm-modal-danger-btn"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Đang xóa…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
