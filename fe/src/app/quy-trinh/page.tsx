import Link from 'next/link'

import { MarketingHeader } from '../../features/marketing/components/marketing-header'

const phases = [
  ['01', 'Tiếp nhận hồ sơ', 'Phân loại RFQ, E-HSMT hoặc hồ sơ nội bộ; tạo tender, lot và các dòng hàng hóa theo cấu trúc gốc.'],
  ['02', 'Chuẩn hoá yêu cầu', 'Giữ lại locator từ PDF, DOCX hoặc XLSX để mỗi requirement luôn quay về đúng nguồn.'],
  ['03', 'Đối chiếu có chứng cứ', 'So sánh candidate product theo item; thiếu chứng cứ là UNKNOWN, không suy đoán thành PASS.'],
  ['04', 'Review và báo cáo', 'Reviewer độc lập xem xét, giữ nguyên phiên bản run và chỉ xuất Approved sau khi phê duyệt.'],
]

export default function WorkflowPage() {
  return <main className="enterprise-page workflow-page"><MarketingHeader /><section className="workflow-hero"><div><p className="eyebrow">Quy trình làm việc</p><h1>Mỗi quyết định đều có đường đi rõ ràng.</h1><p>Biến một bộ hồ sơ phức tạp thành checklist có nguồn, có trạng thái và có người chịu trách nhiệm — không biến AI thành người ra quyết định.</p><Link className="button enterprise-cta" href="/apply">Khởi tạo workspace</Link></div><aside aria-label="Nguyên tắc của quy trình"><p>NGUYÊN TẮC</p><strong>Evidence first</strong><span>Không có nguồn phù hợp → UNKNOWN</span><hr /><strong>Phiên bản bất biến</strong><span>Sửa input → tạo run mới, không âm thầm ghi đè</span></aside></section><section className="workflow-timeline" aria-label="Bốn giai đoạn xử lý">{phases.map(([number, title, copy]) => <article key={number}><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></article>)}</section><section className="workflow-note"><p className="eyebrow">Điểm kiểm soát</p><h2>PASS, FAIL, UNKNOWN và NEEDS REVIEW là trạng thái làm việc, không phải lời cam kết pháp lý.</h2><p>Mỗi kết quả cần được kiểm tra theo requirement, đúng model/version, rule số học và evidence source trước khi review.</p></section></main>
}
