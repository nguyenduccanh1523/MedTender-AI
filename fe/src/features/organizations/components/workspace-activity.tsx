'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '../../../lib/api/client'
import { getWorkspaceActivity, type Organization, type WorkspaceActivity } from '../api'
import { roleLabels } from '../roles'

const roleOperationalMeta: Record<
  Organization['role'],
  {
    badge: string
    headline: string
    mandate: string
    focusPill: string
  }
> = {
  OWNER: {
    badge: 'ĐIỀU HÀNH CẤP CAO · OWNER',
    headline: ' Trung tâm chỉ huy & Giám sát toàn diện tổ chức',
    mandate:
      'Theo dõi sức khỏe vận hành toàn workspace, kiểm soát phân quyền ADMIN, chuẩn hóa chính sách bảo mật và rà soát nhật ký kiểm toán.',
    focusPill: 'Quản trị cấu trúc · Phân quyền ADMIN · Nhật ký kiểm toán',
  },
  ADMIN: {
    badge: 'ĐIỀU PHỐI HỆ THỐNG · ADMIN',
    headline: 'Bảng điều phối nhân sự nghiệp vụ, hồ sơ thầu & catalog',
    mandate:
      'Đảm bảo các nhóm Bid Manager, Catalog Manager, Analyst và Reviewer phối hợp thông suốt, xử lý lời mời đang chờ và giám sát tiến độ.',
    focusPill: 'Điều phối thành viên · Hồ sơ mua sắm · Chuẩn hóa catalog',
  },
  BID_MANAGER: {
    badge: 'QUẢN LÝ ĐẤU THẦU · BID MANAGER',
    headline: 'Bàn làm việc điều phối gói thầu, chia Lot & danh mục hàng hóa',
    mandate:
      'Khởi tạo RFQ / E-HSMT, rà soát các gói thầu chưa chia lot hoặc thiếu dòng hàng hóa, và đối chiếu danh mục thiết bị trong Catalog.',
    focusPill: 'Khởi tạo RFQ/E-HSMT · Cấu trúc Lot & STT · Tiến độ gói thầu',
  },
  CATALOG_MANAGER: {
    badge: 'QUẢN TRỊ DANH MỤC · CATALOG MANAGER',
    headline: 'Trung tâm chuẩn hóa SKU, phiên bản bất biến & thông số kỹ thuật',
    mandate:
      'Quản lý vòng đời phiên bản thiết bị (Draft → Published → Superseded), bổ sung trích dẫn nguồn tài liệu và xử lý xung đột thông số kỹ thuật.',
    focusPill: 'Chuẩn hóa SKU · Phiên bản bất biến · Xử lý xung đột thông số',
  },
  ANALYST: {
    badge: 'PHÂN TÍCH KỸ THUẬT · ANALYST',
    headline: 'Không gian đối chiếu yêu cầu E-HSMT & thông số thiết bị',
    mandate:
      'Khảo sát chi tiết từng dòng hàng hóa trong các Lot thầu, đối chiếu với phiên bản sản phẩm đã xuất bản và phát hiện điểm nghẽn thông số.',
    focusPill: 'Phân tích yêu cầu kỹ thuật · Đối chiếu phiên bản · Truy vết nguồn',
  },
  REVIEWER: {
    badge: 'THẨM ĐỊNH ĐỘC LẬP · REVIEWER',
    headline: 'Hàng đợi rà soát chéo & kiểm định tính nhất quán dữ liệu',
    mandate:
      'Thẩm định độc lập cấu trúc gói thầu, kiểm tra các thông số kỹ thuật đang có xung đột giữa nhiều nguồn tài liệu trước khi chốt phương án.',
    focusPill: 'Thẩm định độc lập · Kiểm soát xung đột · Đảm bảo tuân thủ',
  },
  VIEWER: {
    badge: 'QUAN SÁT VIÊN · VIEWER',
    headline: 'Bảng theo dõi tiến độ gói thầu & tra cứu danh mục chuẩn',
    mandate:
      'Tra cứu nhanh các gói thầu đang triển khai và danh mục thiết bị đã xuất bản trong phạm vi quyền đọc được cấp.',
    focusPill: 'Chế độ chỉ đọc · Tra cứu gói thầu · Tra cứu Catalog',
  },
}

const priorityLabels: Record<'HIGH' | 'MEDIUM' | 'INFO', { label: string; className: string }> = {
  HIGH: { label: 'Cần xử lý ngay', className: 'is-high' },
  MEDIUM: { label: 'Trọng tâm trong ca', className: 'is-medium' },
  INFO: { label: 'Theo dõi thường xuyên', className: 'is-info' },
}

export function WorkspaceActivityView({ slug }: { slug: string }) {
  const [data, setData] = useState<WorkspaceActivity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getWorkspaceActivity(slug)
      setData(response)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được dữ liệu hoạt động.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    let active = true
    getWorkspaceActivity(slug)
      .then((response) => {
        if (active) {
          setData(response)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof ApiError ? err.message : 'Không tải được dữ liệu hoạt động.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug])

  if (loading && !data) {
    return (
      <section className="tender-panel" aria-busy="true">
        <div className="tender-skeleton-list" aria-label="Đang tải hoạt động theo vai trò">
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="tender-panel">
        <p className="form-error" role="alert">
          {error ?? 'Không thể hiển thị bảng hoạt động.'}
        </p>
        <button className="button button-secondary" type="button" onClick={() => void load()}>
          Thử lại
        </button>
      </section>
    )
  }

  const meta = roleOperationalMeta[data.role]
  const m = data.metrics

  const kpiCards =
    data.role === 'CATALOG_MANAGER'
      ? [
          {
            label: 'Sản phẩm đang hoạt động',
            value: m.productsCount,
            sub: 'Mã SKU chuẩn hóa trong tổ chức',
          },
          {
            label: 'Phiên bản đã xuất bản',
            value: m.publishedVersionsCount,
            sub: 'Khóa bất biến để sẵn sàng đấu thầu',
          },
          {
            label: 'Bản nháp đang biên tập',
            value: m.draftVersionsCount,
            sub: 'Đang chờ hoàn thiện & xuất bản',
          },
          {
            label: 'Thông số có xung đột nguồn',
            value: m.conflictingSpecsCount,
            sub: m.conflictingSpecsCount > 0 ? 'Cần đối chiếu tài liệu nguồn' : 'Dữ liệu đồng nhất',
            highlight: m.conflictingSpecsCount > 0,
          },
        ]
      : data.role === 'BID_MANAGER'
        ? [
            {
              label: 'Hồ sơ thầu đang quản lý',
              value: m.tendersCount,
              sub: 'RFQ, E-HSMT và mua sắm nội bộ',
            },
            {
              label: 'Tổng số Lot đã chia',
              value: m.lotsCount,
              sub: 'Cấu trúc phân lô theo hồ sơ gốc',
            },
            {
              label: 'Dòng hàng hóa (Items)',
              value: m.itemsCount,
              sub: 'Tổng số hạng mục thiết bị yêu cầu',
            },
            {
              label: 'Phiên bản Catalog sẵn sàng',
              value: m.publishedVersionsCount,
              sub: `${m.productsCount} sản phẩm trong danh mục`,
            },
          ]
        : data.role === 'OWNER' || data.role === 'ADMIN'
          ? [
              {
                label: 'Nhân sự đang hoạt động',
                value: m.membersCount ?? 0,
                sub:
                  (m.pendingInvitationsCount ?? 0) > 0
                    ? `${m.pendingInvitationsCount} lời mời đang chờ xác nhận`
                    : 'Đội ngũ đã kích hoạt đầy đủ',
              },
              {
                label: 'Hồ sơ thầu & Hạng mục',
                value: `${m.tendersCount} / ${m.itemsCount}`,
                sub: `${m.lotsCount} lot hàng hóa đang vận hành`,
              },
              {
                label: 'Sản phẩm & Bản xuất bản',
                value: `${m.productsCount} / ${m.publishedVersionsCount}`,
                sub: `${m.draftVersionsCount} phiên bản nháp đang mở`,
              },
              {
                label: 'Cảnh báo xung đột thông số',
                value: m.conflictingSpecsCount,
                sub: m.conflictingSpecsCount > 0 ? 'Cần Catalog/Reviewer kiểm tra' : 'Không có xung đột',
                highlight: m.conflictingSpecsCount > 0,
              },
            ]
          : [
              {
                label: 'Hồ sơ thầu trong tổ chức',
                value: m.tendersCount,
                sub: `${m.lotsCount} lot đã được cấu trúc`,
              },
              {
                label: 'Hạng mục thiết bị cần đối chiếu',
                value: m.itemsCount,
                sub: 'Theo dõi theo từng lot mua sắm',
              },
              {
                label: 'Phiên bản thiết bị chuẩn hóa',
                value: m.publishedVersionsCount,
                sub: `Trên tổng số ${m.productsCount} sản phẩm`,
              },
              {
                label: 'Điểm xung đột thông số nguồn',
                value: m.conflictingSpecsCount,
                sub:
                  m.conflictingSpecsCount > 0
                    ? 'Lưu ý khi thẩm định / phân tích'
                    : 'Tất cả thông số đồng nhất',
                highlight: m.conflictingSpecsCount > 0,
              },
            ]

  return (
    <div className="activity-dashboard">
      <section className="activity-role-banner">
        <div className="activity-role-banner-main">
          <div className="activity-role-chips">
            <span className="activity-role-badge">{meta.badge}</span>
            <span className="activity-role-focus">{meta.focusPill}</span>
          </div>
          <h2>{meta.headline}</h2>
          <p>{meta.mandate}</p>
        </div>
        <div className="activity-role-banner-actions">
          {data.role === 'OWNER' && (
            <Link className="button button-primary" href={`/${slug}/quan-tri-to-chuc`}>
              Đặc quyền Quản trị tổ chức
            </Link>
          )}
          <button
            className="button button-secondary button-icon"
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Làm mới bảng hoạt động"
            title="Làm mới dữ liệu hoạt động"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </button>
        </div>
      </section>

      <section className="activity-kpi-grid" aria-label="Chỉ số vận hành theo vai trò">
        {kpiCards.map((card) => (
          <article
            key={card.label}
            className={card.highlight ? 'activity-kpi-card is-alert' : 'activity-kpi-card'}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.sub}</p>
          </article>
        ))}
      </section>

      <div className="activity-main-grid">
        <section className="tender-panel activity-queue-panel">
          <div className="tender-panel-head">
            <div>
              <p className="eyebrow">Hàng đợi tác nghiệp · {roleLabels[data.role]}</p>
              <h2>Công việc đề xuất theo trách nhiệm của bạn</h2>
              <p className="muted">
                Danh sách tác vụ được tổng hợp trực tiếp từ trạng thái thực tế của hồ sơ thầu, catalog và đội ngũ.
              </p>
            </div>
          </div>

          <div className="activity-queue-list">
            {data.workQueue.map((item) => {
              const prio = priorityLabels[item.priority]
              return (
                <article key={item.id} className="activity-queue-card">
                  <div className="activity-queue-top">
                    <span className={`activity-priority-pill ${prio.className}`}>{prio.label}</span>
                    <span className="activity-category-tag">{item.category}</span>
                    <span className="activity-meta-tag">{item.meta}</span>
                  </div>
                  <div className="activity-queue-body">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                    <Link className="button button-secondary activity-cta-link" href={item.href}>
                      {item.ctaLabel} →
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="tender-panel activity-timeline-panel">
          <div className="tender-panel-head">
            <div>
              <p className="eyebrow">Dòng sự kiện vận hành</p>
              <h2>Nhật ký hoạt động gần đây</h2>
              <p className="muted">
                Các thao tác nghiệp vụ mới nhất trên hồ sơ thầu, phiên bản sản phẩm và cấu hình tổ chức.
              </p>
            </div>
          </div>

          {data.timeline.length === 0 ? (
            <div className="tender-empty">
              <h3>Chưa có sự kiện nào được ghi nhận</h3>
              <p className="muted">
                Khi các thành viên khởi tạo hồ sơ thầu hoặc xuất bản phiên bản catalog, dòng thời gian sẽ cập nhật tại đây.
              </p>
            </div>
          ) : (
            <ol className="activity-timeline-list" aria-label="Dòng thời gian hoạt động">
              {data.timeline.map((event) => (
                <li key={event.id} className="activity-timeline-item">
                  <div className="activity-timeline-dot" aria-hidden="true" />
                  <div className="activity-timeline-content">
                    <div className="activity-timeline-header">
                      <span className="tender-code">{event.action}</span>
                      <time dateTime={String(event.createdAt)}>
                        {new Date(event.createdAt).toLocaleString('vi-VN')}
                      </time>
                    </div>
                    <p className="activity-timeline-summary">{event.summary}</p>
                    <div className="activity-timeline-footer">
                      <span className="muted">
                        Thực hiện bởi <strong>{event.actorName}</strong> ({roleLabels[event.actorRole]})
                      </span>
                      {event.href && (
                        <Link className="activity-timeline-link" href={event.href}>
                          Mở chi tiết →
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
