import type { Organization } from '../api'
import { roleLabels } from '../roles'

type Overview = { title: string; copy: string; action: string; signal: string; governance?: boolean }

const overviewByRole: Record<Organization['role'], Overview> = {
  OWNER: { title: 'Toàn quyền điều phối workspace', copy: 'Thiết lập đội ngũ, phân vai và giữ luồng ra quyết định nhất quán cho tổ chức.', action: 'Quản lý thành viên', signal: 'Workspace đã sẵn sàng', governance: true },
  ADMIN: { title: 'Điều phối đội ngũ mua sắm', copy: 'Duy trì quyền truy cập và hỗ trợ các nhóm làm việc đúng vai trò.', action: 'Quản lý thành viên', signal: 'Quyền quản trị đang hoạt động', governance: true },
  BID_MANAGER: { title: 'Sẵn sàng điều phối hồ sơ thầu', copy: 'Tạo hồ sơ mua sắm và theo dõi các tender trong tổ chức.', action: 'Quản lý hồ sơ thầu', signal: 'Quyền tạo hồ sơ đang hoạt động' },
  ANALYST: { title: 'Bắt đầu từ hồ sơ nguồn', copy: 'Xem tender hiện có để chuẩn bị cho luồng phân tích ở bước tiếp theo.', action: 'Xem hồ sơ thầu', signal: 'Quyền xem đang hoạt động' },
  CATALOG_MANAGER: { title: 'Chuẩn hóa danh mục & phiên bản thiết bị', copy: 'Quản lý SKU, biên tập thông số kỹ thuật có trích dẫn nguồn và xuất bản phiên bản sản phẩm bất biến.', action: 'Quản lý Catalog thiết bị', signal: 'Quyền quản lý Catalog đang hoạt động' },
  REVIEWER: { title: 'Nắm bối cảnh trước khi review', copy: 'Xem hồ sơ thầu; quyết định review chỉ mở khi có module analysis và bằng chứng.', action: 'Xem hồ sơ thầu', signal: 'Quyền xem đang hoạt động' },
  VIEWER: { title: 'Theo dõi thông tin được chia sẻ', copy: 'Bạn có thể đọc hồ sơ thầu thuộc tổ chức theo quyền hiện tại.', action: 'Xem hồ sơ thầu', signal: 'Chế độ chỉ xem' },
}

export function WorkspaceOverview({ organization }: { organization: Organization }) {
  const overview = overviewByRole[organization.role]
  return <section className="role-overview" aria-label="Tổng quan vai trò">
    <div className="role-overview-main">
      <div><p className="role-overview-label">Vai trò của bạn <strong>{roleLabels[organization.role]}</strong></p><h2>{overview.title}</h2><p>{overview.copy}</p></div>
      <div className="role-overview-signal"><span className="status-dot" aria-hidden="true" /><span>{overview.signal}</span></div>
    </div>
    <div className="role-overview-action"><span>Tiếp theo</span><strong>{overview.action}</strong>{overview.governance && <small>Quyền quản lý bên dưới</small>}</div>
  </section>
}
