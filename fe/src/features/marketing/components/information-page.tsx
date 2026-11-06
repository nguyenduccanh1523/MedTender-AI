import Link from 'next/link'

import { MarketingHeader } from './marketing-header'

export function InformationPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: Array<{ title: string; copy: string }> }) {
  return <main className="enterprise-page"><MarketingHeader /><section className="enterprise-intro"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p><Link className="button enterprise-cta" href="/apply">Đăng ký tổ chức</Link></section><section className="enterprise-sections">{sections.map((section, index) => <article key={section.title}><span>0{index + 1}</span><h2>{section.title}</h2><p>{section.copy}</p></article>)}</section></main>
}
