import Link from 'next/link'

import { MarketingFooter } from '../features/marketing/components/marketing-footer'
import { MarketingHeader } from '../features/marketing/components/marketing-header'

const outcomes = [
  ['01', 'Chuẩn hoá yêu cầu', 'Biến hồ sơ mời thầu thành các tiêu chí có thể truy vết.'],
  ['02', 'Đối chiếu bằng chứng', 'So sánh catalog và tài liệu nguồn trên cùng một ngữ cảnh.'],
  ['03', 'Ra quyết định rõ ràng', 'Giữ lại rationale, vai trò xét duyệt và lịch sử kiểm toán.'],
]

export default function HomePage() {
  return (
    <main className="enterprise-page">
      <MarketingHeader />

      <section className="enterprise-home-hero">
        <div className="marketing-copy">
          <p className="eyebrow">Mua sắm y tế có kiểm soát</p>
          <h1>Quyết định rõ ràng. <em>Trách nhiệm rõ ràng.</em></h1>
          <p className="marketing-lede">MedTender AI kết nối hồ sơ mời thầu, catalog và bằng chứng nguồn thành một quy trình minh bạch để đội ngũ của bạn ra quyết định chắc chắn hơn.</p>
          <div className="marketing-actions"><Link className="button enterprise-cta" href="/apply">Đăng ký tổ chức <span aria-hidden="true">→</span></Link><Link className="marketing-text-link" href="/quy-trinh">Xem quy trình <span aria-hidden="true">→</span></Link></div>
          <p className="marketing-assurance">Phân quyền rõ ràng · Lưu vết quyết định · Sẵn sàng kiểm toán</p>
        </div>
        <section className="enterprise-summary" aria-label="Tóm tắt năng lực"><article><span>01</span><strong>Chuẩn hoá</strong><p>Đưa yêu cầu vào cùng một ngôn ngữ đánh giá.</p></article><article><span>02</span><strong>Đối chiếu</strong><p>Liên kết dữ liệu catalog và bằng chứng nguồn.</p></article><article><span>03</span><strong>Kiểm soát</strong><p>Quản lý vai trò và lưu vết quyết định.</p></article></section>
      </section>

      <section className="enterprise-sections">{outcomes.map(([index, title, copy]) => <article key={index}><span>{index}</span><h2>{title}</h2><p>{copy}</p></article>)}</section>
      <section className="enterprise-operating-model" aria-labelledby="operating-model-title">
        <div><p className="eyebrow">Vận hành có kiểm soát</p><h2 id="operating-model-title">Một workspace chung, nhưng mỗi người chỉ thấy đúng phần việc của mình.</h2><p>Hệ thống tách rõ trách nhiệm của tổ chức, đội vận hành và người đánh giá để quy trình không phụ thuộc vào một cá nhân.</p></div>
        <ol><li><span>01</span><div><strong>Hồ sơ được phê duyệt</strong><p>Tổ chức gửi thông tin, System Admin kiểm tra và tạo workspace sau khi phê duyệt.</p></div></li><li><span>02</span><div><strong>Đội ngũ được cấp quyền</strong><p>OWNER và ADMIN mời các vai trò nghiệp vụ theo đúng phạm vi công việc.</p></div></li><li><span>03</span><div><strong>Quyết định được lưu vết</strong><p>Bằng chứng, tiêu chí và kết quả rà soát được giữ cùng một bối cảnh.</p></div></li></ol>
      </section>
      <MarketingFooter />
    </main>
  )
}
