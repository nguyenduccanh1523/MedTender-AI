import Link from 'next/link'

import { MarketingFooter } from '../../features/marketing/components/marketing-footer'
import { MarketingHeader } from '../../features/marketing/components/marketing-header'

const approval = [
  { number: '01', title: 'Gửi hồ sơ tổ chức', detail: 'Đại diện cung cấp thông tin pháp lý và email người phụ trách.' },
  { number: '02', title: 'Xác minh và phê duyệt', detail: 'System Admin kiểm tra hồ sơ trước khi mở không gian làm việc.' },
  { number: '03', title: 'Kích hoạt tài khoản', detail: 'Người phụ trách nhận email, đặt mật khẩu và trở thành OWNER đầu tiên.' },
]

const roles = [
  { title: 'System Admin', scope: 'Nền tảng', detail: 'Duyệt tổ chức và khởi tạo workspace. Không thay tổ chức đưa ra quyết định thầu.' },
  { title: 'Owner · Admin', scope: 'Tổ chức', detail: 'Quản lý thành viên, phân vai và quyền truy cập trong tổ chức.' },
  { title: 'Nhóm nghiệp vụ', scope: 'Hồ sơ', detail: 'Tạo, phân tích và quản lý hồ sơ theo vai trò được cấp.' },
  { title: 'Reviewer · Viewer', scope: 'Kiểm tra', detail: 'Rà soát độc lập hoặc theo dõi kết quả trong phạm vi được phép.' },
]

export default function GovernancePage() {
  return (
    <main className="enterprise-page governance-v2">
      <MarketingHeader />

      <section className="governance-v2-hero">
        <div className="governance-v2-lead">
          <p className="eyebrow">QUẢN TRỊ MEDTENDER AI</p>
          <h1>Mỗi quyền hạn có một người chịu trách nhiệm.</h1>
          <p>Quy trình bắt đầu từ một tổ chức được xác minh. Sau đó, mỗi thành viên chỉ làm việc với dữ liệu và hành động thuộc vai trò của mình.</p>
          <div className="governance-v2-actions">
            <Link className="button enterprise-cta" href="/apply">Đăng ký tổ chức <span aria-hidden="true">↗</span></Link>
            <a href="#quy-trinh-phe-duyet">Xem cách bắt đầu <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div className="governance-v2-diagram" aria-label="Luồng cấp quyền tổ chức">
          <div className="diagram-head"><span>01 / ACCESS MODEL</span><span>MEDTENDER AI</span></div>
          <div className="diagram-root"><span className="diagram-mark">M</span><div><small>NỀN TẢNG</small><strong>System Admin</strong></div><b>Phê duyệt</b></div>
          <div className="diagram-line" aria-hidden="true" />
          <div className="diagram-org"><span className="diagram-mark">O</span><div><small>TỔ CHỨC ĐÃ XÁC MINH</small><strong>Workspace riêng</strong></div><b>OWNER</b></div>
          <div className="diagram-branches"><div><small>VẬN HÀNH</small><strong>Admin · Nhóm nghiệp vụ</strong></div><div><small>GIÁM SÁT</small><strong>Reviewer · Viewer</strong></div></div>
          <p className="diagram-foot">Quyền truy cập được kiểm tra theo tài khoản, tổ chức và vai trò.</p>
        </div>
      </section>

      <section className="governance-v2-process" id="quy-trinh-phe-duyet" aria-labelledby="approval-heading">
        <div className="governance-v2-section-head"><p className="eyebrow">BẮT ĐẦU SỬ DỤNG</p><h2 id="approval-heading">Không gian làm việc chỉ mở sau khi hồ sơ được duyệt.</h2><p>Không cần tự tạo một tổ chức chưa được xác minh trong hệ thống.</p></div>
        <ol>{approval.map((step) => <li key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.detail}</p></li>)}</ol>
      </section>

      <section className="governance-v2-roles" aria-labelledby="roles-heading">
        <div className="governance-v2-section-head"><p className="eyebrow">PHÂN CÔNG RÕ RÀNG</p><h2 id="roles-heading">Ai được làm gì?</h2><p>Vai trò được cấp trong từng tổ chức. Một người có thể tham gia nhiều tổ chức với quyền khác nhau.</p></div>
        <div className="governance-v2-role-grid">{roles.map((role) => <article key={role.title}><span>{role.scope}</span><h3>{role.title}</h3><p>{role.detail}</p></article>)}</div>
      </section>

      <section className="governance-v2-closing"><div><p className="eyebrow">SẴN SÀNG BẮT ĐẦU?</p><h2>Gửi thông tin tổ chức để được xem xét cấp quyền.</h2></div><Link className="button enterprise-cta" href="/apply">Gửi hồ sơ tổ chức <span aria-hidden="true">↗</span></Link></section>
      <MarketingFooter />
    </main>
  )
}
