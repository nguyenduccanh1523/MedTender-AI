import Link from 'next/link'

import { Logo } from '../components/brand/logo'

export default function HomePage() {
  return (
    <>
      <header className="app-header">
        <div className="app-header-row">
          <Logo />
          <nav aria-label="Tài khoản"><Link href="/login">Đăng nhập</Link></nav>
        </div>
      </header>
      <main className="landing landing-hero">
        <section className="hero-copy">
          <p className="eyebrow">Evidence-driven medical procurement</p>
          <h1>MedTender <span>AI</span></h1>
          <p>Đối chiếu yêu cầu kỹ thuật, catalog thiết bị và bằng chứng gốc trong một không gian làm việc minh bạch.</p>
          <div className="landing-actions">
            <Link className="button button-primary" href="/apply">Đăng ký tổ chức</Link>
            <Link className="button button-secondary" href="/login">Đăng nhập</Link>
          </div>
          <ul className="hero-benefits"><li>Quyết định nhanh hơn</li><li>Bằng chứng rõ ràng</li><li>Kiểm soát theo vai trò</li></ul>
        </section>
        <section className="hero-visual" aria-label="Luồng phân tích hồ sơ thầu">
          <div className="document-stack"><span>Hồ sơ mời thầu</span><strong>Yêu cầu kỹ thuật</strong><strong>Tiêu chí đánh giá</strong><strong>Điều kiện tuân thủ</strong></div>
          <div className="ai-core">AI</div>
          <div className="catalog-stack"><span>Catalog thiết bị</span><strong>Thông số sản phẩm</strong><strong>Chứng cứ nguồn</strong><strong>Kết quả phù hợp</strong></div>
        </section>
      </main>
    </>
  )
}
