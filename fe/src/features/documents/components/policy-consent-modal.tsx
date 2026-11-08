'use client'

import { useState } from 'react'
import type { PolicyConsentStatus } from '../api'

export function PolicyConsentModal({
  status,
  onAccept,
  onClose,
}: {
  status: PolicyConsentStatus
  onAccept: () => Promise<void>
  onClose: () => void
}) {
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!checked) return
    setSubmitting(true)
    setError(null)
    try {
      await onAccept()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể ghi nhận xác nhận chính sách.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="surface max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-[var(--border-subtle)]">
        <div className="flex items-start justify-between">
          <div>
            <span className="eyebrow">Xác nhận lần đầu · Chỉ hỏi 1 lần</span>
            <h2 className="text-xl font-bold mt-1">Chính sách Dữ liệu & Pháp lý ({status.currentPolicyVersion})</h2>
          </div>
          <button
            type="button"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mt-2">
          Để đảm bảo tính toàn vẹn và bảo mật dữ liệu y tế, vui lòng xác nhận bạn có quyền hợp pháp sử dụng tài liệu này. Các lần tải tệp tiếp theo sẽ không hỏi lại.
        </p>

        <div className="mt-4 space-y-3">
          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)]">
            <div className="font-semibold text-sm flex items-center justify-between">
              <span>{status.termsTitle}</span>
              <span className="text-xs text-[var(--primary)] font-bold">{status.currentPolicyVersion}</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{status.termsSummary}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)]">
            <div className="font-semibold text-sm">{status.privacyTitle}</div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{status.privacySummary}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)]">
            <div className="font-semibold text-sm">{status.aiNoticeTitle}</div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{status.aiNoticeSummary}</p>
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-500 font-semibold mt-3" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5">
          <label className="flex items-start gap-3 cursor-pointer text-xs text-[var(--text-primary)] font-medium">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-[var(--border-subtle)]"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              Tôi xác nhận tổ chức có quyền hợp pháp tải lên các tài liệu này và đồng ý với bộ Điều khoản & Chính sách bảo mật trên.
            </span>
          </label>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Để sau
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={!checked || submitting}
            >
              {submitting ? 'Đang lưu…' : 'Xác nhận & Tiếp tục'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
