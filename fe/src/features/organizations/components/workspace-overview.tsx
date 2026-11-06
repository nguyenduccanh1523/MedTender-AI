import type { Organization } from '../api'
import { roleLabels } from '../roles'

type Overview = { title: string; copy: string; action: string; signal: string; governance?: boolean }

const overviewByRole: Record<Organization['role'], Overview> = {
  OWNER: { title: 'Toàn quyền điều phối workspace', copy: 'Thiết lập đội ngũ, phân vai và giữ luồng ra quyết định nhất quán cho tổ chức.', action: 'Quản lý thành viên', signal: 'Workspace đã sẵn sàng', governance: true },
  ADMIN: { title: 'Điều phối đội ngũ mua sắm', copy: 'Duy trì quyền truy cập và hỗ trợ các nhóm làm việc đúng vai trò.', action: 'Quản lý thành viên', signal: 'Quyền quản trị đang hoạt động', governance: true },
  BID_MANAGER: { title: 'Sẵn sàng điều phối hồ sơ thầu', copy: 'Tập trung vào độ rõ ràng của yêu cầu, tiến độ phân tích và quyết định liên phòng ban.', action: 'Xem lộ trình hồ sơ', signal: 'Không có hồ sơ mới trong bản demo' },
  ANALYST: { title: 'Bắt đầu từ bằng chứng nguồn', copy: 'Chuẩn bị đối chiếu yêu cầu, tài liệu kỹ thuật và dữ liệu catalog trong cùng một ngữ cảnh.', action: 'Mở không gian phân tích', signal: 'Không có phân tích đang chờ' },
  CATALOG_MANAGER: { title: 'Giữ catalog sẵn sàng đối chiếu', copy: 'Theo dõi chất lượng nguồn và độ đầy đủ dữ liệu trước khi catalog đi vào đánh giá.', action: 'Xem sức khoẻ catalog', signal: 'Catalog sẽ xuất hiện ở bước tiếp theo' },
  REVIEWER: { title: 'Rà soát quyết định có kiểm soát', copy: 'Tập trung vào tiêu chí tuân thủ, bằng chứng và các điểm cần phê duyệt.', action: 'Xem hàng chờ rà soát', signal: 'Không có mục cần duyệt' },
  VIEWER: { title: 'Theo dõi quyết định có căn cứ', copy: 'Bạn có quyền xem bối cảnh, tiến độ và bằng chứng đã được chia sẻ trong tổ chức.', action: 'Xem hoạt động workspace', signal: 'Chế độ chỉ xem' },
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
