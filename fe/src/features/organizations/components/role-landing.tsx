import type { Organization } from '../api'
import { roleLabels } from '../roles'

type RoleLandingContent = { headline: string; focus: string; primary: string; secondary: string; queue: string }

const content: Record<Organization['role'], RoleLandingContent> = {
  OWNER: { headline: 'Điều hành workspace với đầy đủ bối cảnh.', focus: 'Bạn giữ quyền sở hữu, thiết lập thành viên và chuẩn bị nền tảng cho quy trình thầu.', primary: 'Quản trị thành viên', secondary: 'Cấu hình workspace', queue: 'Chưa có công việc cần xử lý' },
  ADMIN: { headline: 'Giữ đội ngũ phối hợp đúng vai trò.', focus: 'Bạn có thể quản trị thành viên và theo dõi trạng thái vận hành của workspace.', primary: 'Quản trị thành viên', secondary: 'Rà soát phân quyền', queue: 'Workspace đang ổn định' },
  BID_MANAGER: { headline: 'Chuẩn bị hồ sơ trước khi đi vào đánh giá.', focus: 'Tập trung cấu trúc yêu cầu và điểm quyết định cần phối hợp trong giai đoạn tiếp theo.', primary: 'Theo dõi hồ sơ', secondary: 'Xem nguyên tắc đánh giá', queue: 'Chưa có hồ sơ đang mở' },
  ANALYST: { headline: 'Bắt đầu từ nguồn bằng chứng đáng tin cậy.', focus: 'Không gian này sẽ tập hợp yêu cầu, catalog và bằng chứng thành ngữ cảnh phân tích thống nhất.', primary: 'Mở phân tích', secondary: 'Tìm hiểu phương pháp', queue: 'Chưa có phân tích chờ bạn' },
  CATALOG_MANAGER: { headline: 'Giữ catalog sẵn sàng cho mọi quyết định.', focus: 'Bạn sẽ quản lý độ đầy đủ nguồn và chất lượng thông tin thiết bị ở bước catalog.', primary: 'Xem catalog', secondary: 'Chuẩn bị nguồn', queue: 'Chưa có catalog cần bổ sung' },
  REVIEWER: { headline: 'Rà soát quyết định trước khi được xác nhận.', focus: 'Mọi tiêu chí và bằng chứng sẽ được tập trung tại đây để bạn đánh giá có kiểm soát.', primary: 'Mở hàng chờ', secondary: 'Xem checklist', queue: 'Không có mục cần phê duyệt' },
  VIEWER: { headline: 'Theo dõi tiến độ với đầy đủ bối cảnh.', focus: 'Bạn có quyền xem những thông tin và bằng chứng mà tổ chức chia sẻ với vai trò của bạn.', primary: 'Xem hoạt động', secondary: 'Tìm hiểu workspace', queue: 'Chế độ chỉ xem đang hoạt động' },
}

export function RoleLanding({ organization }: { organization: Organization }) {
  const data = content[organization.role]
  return <section className="role-landing" aria-label="Trang bắt đầu workspace">
    <div className="role-landing-intro"><div><p className="eyebrow">{roleLabels[organization.role]} · MedTender workspace</p><h2>{data.headline}</h2><p>{data.focus}</p></div><div className="role-access-badge"><span>Quyền hiện tại</span><strong>{roleLabels[organization.role]}</strong></div></div>
    <div className="role-action-grid"><article className="role-action-primary"><span>Điểm bắt đầu</span><h3>{data.primary}</h3><p>Bước này sẽ được mở rộng khi module nghiệp vụ tương ứng được triển khai.</p><button type="button">Sắp ra mắt <span aria-hidden="true">→</span></button></article><article><span>Tiếp tục khám phá</span><h3>{data.secondary}</h3><p>Hiểu rõ phạm vi vai trò và dữ liệu bạn sẽ làm việc cùng.</p></article><article><span>Trạng thái</span><h3>{data.queue}</h3><p>Thông tin thời gian thực sẽ xuất hiện tại đây khi có dữ liệu nghiệp vụ.</p></article></div>
  </section>
}
