import Link from 'next/link'

import { MarketingHeader } from '../../features/marketing/components/marketing-header'

const foundations = [
  ['Tài liệu có phiên bản', 'PDF, DOCX, XLSX và scan được lưu thành document version bất biến cùng hash, quyền xử lý và locator gốc.'],
  ['Yêu cầu có cấu trúc', 'Tender → lot → item → requirement giúp không gán nhầm tiêu chí giường bệnh cho một model máy siêu âm.'],
  ['Kết quả có nguồn', 'Mỗi PASS, FAIL, UNKNOWN hoặc NEEDS REVIEW luôn đi cùng lý do, evidence và phiên bản đầu vào.'],
]

export default function PlatformPage() {
  return <main className="enterprise-page platform-page"><MarketingHeader /><section className="platform-hero"><div><p className="eyebrow">Nền tảng làm việc</p><h1>Không phải một chatbot. Là nền tảng để kiểm tra bằng chứng.</h1><p>MedTender AI biến tài liệu, catalog và tiêu chí kỹ thuật thành cấu trúc có thể đối chiếu, review và kiểm toán trong đúng tenant của tổ chức.</p><div className="marketing-actions"><Link className="button enterprise-cta" href="/apply">Khởi tạo workspace</Link><Link className="marketing-text-link" href="/quy-trinh">Xem quy trình →</Link></div></div><aside className="platform-structure" aria-label="Cấu trúc dữ liệu nghiệp vụ"><p>NGỮ CẢNH NGHIỆP VỤ</p><strong>Tender</strong><i /><strong>Lot</strong><i /><strong>Item</strong><i /><strong>Requirement</strong><span>Tender → lot → item → requirement</span></aside></section><section className="platform-foundations" aria-label="Ba nền tảng kiểm soát">{foundations.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{copy}</p></article>)}</section><section className="platform-evidence"><div><p className="eyebrow">Evidence first</p><h2>Hệ thống giữ lại điều gì để một kết luận có thể được kiểm tra lại?</h2><p>Không có evidence phù hợp, kết quả là UNKNOWN. Confidence chỉ hỗ trợ ưu tiên review, không biến thiếu bằng chứng thành kết luận.</p></div><dl><div><dt>Nguồn</dt><dd>Document và product version đúng scope</dd></div><div><dt>Vị trí</dt><dd>PDF page, DOCX table hoặc XLSX sheet/cell</dd></div><div><dt>Quy tắc</dt><dd>Đơn vị, điều kiện và logic đối chiếu</dd></div><div><dt>Con người</dt><dd>Người tạo, reviewer, lý do override</dd></div></dl></section></main>
}
