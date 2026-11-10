'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '../../../lib/api/client'
import {
  invalidateResource,
  loadResource,
  readResource,
  writeResource,
} from '../../../lib/api/resource-cache'
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
    headline: 'Trung tâm chỉ huy & Giám sát toàn diện tổ chức',
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

type LogScopeFilter = 'ALL' | 'TENDER' | 'CATALOG' | 'ORG'

const logScopeLabels: Record<LogScopeFilter, string> = {
  ALL: 'Tất cả sự kiện',
  TENDER: 'Hồ sơ thầu / Lot / Item',
  CATALOG: 'Catalog & Phiên bản',
  ORG: 'Tổ chức & Nhân sự',
}

function matchLogScope(action: string, scope: LogScopeFilter) {
  if (scope === 'ALL') return true
  if (scope === 'CATALOG') return action.startsWith('CATALOG_')
  if (scope === 'ORG') return action.startsWith('ORG_')
  return (
    action.startsWith('TENDER_') || action.startsWith('LOT_') || action.startsWith('ITEM_')
  )
}

export function WorkspaceActivityView({ slug }: { slug: string }) {
  const cacheKey = `activity:${slug}`
  const cachedData = readResource<WorkspaceActivity>(cacheKey)

  const [data, setData] = useState<WorkspaceActivity | null>(cachedData ?? null)
  const [loading, setLoading] = useState(cachedData === undefined)
  const [error, setError] = useState<string | null>(null)

  const [activeSubtab, setActiveSubtab] = useState<'queue' | 'logs'>('queue')
  const [logScope, setLogScope] = useState<LogScopeFilter>('ALL')
  const [logLimit, setLogLimit] = useState(10)
  const [logPage, setLogPage] = useState(1)

  const load = useCallback(async (force = false) => {
    if (force) {
      invalidateResource(cacheKey)
      setLoading(true)
    }
    setError(null)
    try {
      const response = await (force
        ? getWorkspaceActivity(slug)
        : loadResource(cacheKey, () => getWorkspaceActivity(slug)))
      writeResource(cacheKey, response)
      setData(response)
    } catch (err) {
      if (!cachedData) {
        setError(err instanceof ApiError ? err.message : 'Không tải được dữ liệu hoạt động.')
      }
    } finally {
      setLoading(false)
    }
  }, [slug, cacheKey, cachedData])

  useEffect(() => {
    let active = true
    loadResource(cacheKey, () => getWorkspaceActivity(slug))
      .then((response) => {
        if (active) {
          writeResource(cacheKey, response)
          setData(response)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (active && !cachedData) {
          setError(err instanceof ApiError ? err.message : 'Không tải được dữ liệu hoạt động.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug, cacheKey, cachedData])

  if (loading && !data) {
    return (
      <section className="surface tender-list-panel" aria-busy="true">
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
      <section className="surface tender-list-panel">
        <p className="notice notice-error" role="alert">
          {error ?? 'Không thể hiển thị bảng hoạt động.'}
        </p>
        <button className="button button-secondary" type="button" onClick={() => void load(true)}>
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

  const filteredLogs = data.timeline.filter((item) => matchLogScope(item.action, logScope))
  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / logLimit))
  const safeLogPage = Math.min(logPage, totalLogPages)
  const logStartIndex = (safeLogPage - 1) * logLimit
  const visibleLogs = filteredLogs.slice(logStartIndex, logStartIndex + logLimit)

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
            className={loading ? 'tender-icon-button is-spinning' : 'tender-icon-button'}
            type="button"
            onClick={() => void load(true)}
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

      <div className="tender-subtabs-bar">
        <div className="tender-subtabs" role="tablist" aria-label="Chế độ xem hoạt động">
          <button
            type="button"
            role="tab"
            aria-selected={activeSubtab === 'queue'}
            className={activeSubtab === 'queue' ? 'tender-subtab is-active' : 'tender-subtab'}
            onClick={() => setActiveSubtab('queue')}
          >
            Hàng đợi công việc
            <span className="tender-subtab-badge">{data.workQueue.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubtab === 'logs'}
            className={activeSubtab === 'logs' ? 'tender-subtab is-active' : 'tender-subtab'}
            onClick={() => setActiveSubtab('logs')}
          >
            Nhật ký sự kiện (Log)
            <span className="tender-subtab-badge">{data.timeline.length}</span>
          </button>
        </div>
      </div>

      {activeSubtab === 'queue' ? (
        <section className="surface tender-list-panel" aria-label="Hàng đợi công việc">
          <div className="tender-entry-heading">
            <div>
              <strong>Công việc đề xuất theo trách nhiệm ({roleLabels[data.role]})</strong>
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
      ) : (
        <section className="surface tender-audit-panel" aria-label="Nhật ký sự kiện vận hành">
          <div className="tender-entry-heading">
            <div>
              <strong>Nhật ký sự kiện vận hành gần đây</strong>
              <p className="muted">
                Theo dõi dạng log gọn gàng các thao tác nghiệp vụ mới nhất trên hồ sơ thầu, phiên bản sản phẩm và tổ chức.
              </p>
            </div>
          </div>

          <div className="tender-audit-toolbar" role="region" aria-label="Bộ lọc sự kiện">
            <div className="tender-stage-tabs" role="group" aria-label="Phạm vi sự kiện">
              {(['ALL', 'TENDER', 'CATALOG', 'ORG'] as LogScopeFilter[]).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  className={
                    logScope === scope ? 'tender-filter-chip is-active' : 'tender-filter-chip'
                  }
                  onClick={() => {
                    setLogScope(scope)
                    setLogPage(1)
                  }}
                >
                  {logScopeLabels[scope]}
                </button>
              ))}
            </div>

            <label className="tender-audit-limit-control">
              <span>Hiển thị</span>
              <select
                aria-label="Số dòng sự kiện mỗi trang"
                value={String(logLimit)}
                onChange={(event) => {
                  setLogLimit(Number(event.target.value))
                  setLogPage(1)
                }}
              >
                <option value="5">5 dòng / trang</option>
                <option value="10">10 dòng / trang</option>
                <option value="20">20 dòng / trang</option>
              </select>
            </label>
          </div>

          {visibleLogs.length === 0 ? (
            <p className="muted" style={{ marginTop: '.75rem' }}>
              Chưa có sự kiện nào khớp với bộ lọc hiện tại.
            </p>
          ) : (
            <>
              <ul className="tender-audit-list">
                {visibleLogs.map((event) => (
                  <li key={event.id} className="tender-audit-row">
                    <div>
                      <strong>{event.summary}</strong>
                      <small>
                        {event.actorName} · {roleLabels[event.actorRole]} ·{' '}
                        <span className="tender-audit-action">{event.action}</span>
                        {event.href && (
                          <>
                            {' · '}
                            <Link className="activity-timeline-link" href={event.href}>
                              Mở chi tiết →
                            </Link>
                          </>
                        )}
                      </small>
                    </div>
                    <time dateTime={String(event.createdAt)}>
                      {new Date(event.createdAt).toLocaleString('vi-VN')}
                    </time>
                  </li>
                ))}
              </ul>

              <div className="tender-audit-pagination" aria-label="Phân trang sự kiện">
                <span className="muted">
                  Hiển thị{' '}
                  <strong>
                    {logStartIndex + 1}–{logStartIndex + visibleLogs.length}
                  </strong>{' '}
                  trên tổng <strong>{filteredLogs.length}</strong> sự kiện
                </span>
                <div className="tender-audit-page-controls">
                  <button
                    type="button"
                    className="tender-chip-button"
                    disabled={safeLogPage <= 1}
                    onClick={() => setLogPage((prev) => Math.max(1, prev - 1))}
                  >
                    ← Trang trước
                  </button>
                  <span className="tender-audit-page-indicator">
                    Trang {safeLogPage} / {totalLogPages}
                  </span>
                  <button
                    type="button"
                    className="tender-chip-button"
                    disabled={safeLogPage >= totalLogPages}
                    onClick={() => setLogPage((prev) => Math.min(totalLogPages, prev + 1))}
                  >
                    Trang sau →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
