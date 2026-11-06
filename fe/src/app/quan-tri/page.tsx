import Link from 'next/link'

import { MarketingHeader } from '../../features/marketing/components/marketing-header'

const controls = [
  ['01', 'System Admin', 'Kiểm tra hồ sơ tổ chức trước khi tạo workspace và cấp OWNER đầu tiên.'],
  ['02', 'Owner và Admin', 'Quản lý thành viên, chính sách dữ liệu, catalog và phạm vi vận hành của tổ chức.'],
  ['03', 'Reviewer độc lập', 'Không tự duyệt chính run mình tạo, gửi hoặc chỉnh sửa cuối cùng trong pilot production.'],
]

export default function GovernancePage() {
  return <main className="enterprise-page governance-page"><MarketingHeader /><section className="governance-hero"><p className="eyebrow">Quản trị và kiểm soát</p><h1>Quản trị là thiết kế niềm tin, không phải thêm bước phê duyệt.</h1><p>MedTender AI tách tenant, vai trò, policy và dấu vết xử lý để người đúng quyền làm đúng việc trong đúng phạm vi.</p><Link className="button enterprise-cta" href="/apply">Gửi hồ sơ tổ chức</Link></section><section className="governance-model"><div className="governance-model-copy"><p className="eyebrow">Mô hình khởi tạo</p><h2>Workspace chỉ được mở sau khi tổ chức được phê duyệt.</h2><p>Đây là điểm khởi đầu của tenant isolation: một tài khoản có thể thuộc nhiều tổ chức, nhưng dữ liệu và thao tác luôn đi cùng membership đã xác thực.</p></div><ol>{controls.map(([number, title, copy]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol></section><section className="governance-guardrails"><div><strong>Không có bằng chứng</strong><span>UNKNOWN, không tự động PASS</span></div><div><strong>Input thay đổi</strong><span>Giữ run cũ, tạo revision mới</span></div><div><strong>Xuất báo cáo</strong><span>Approved cần review hợp lệ</span></div></section></main>
}
