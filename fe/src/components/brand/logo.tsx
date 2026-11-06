import Image from 'next/image'
import Link from 'next/link'

export function Logo({ tone = 'default' }: { tone?: 'default' | 'dark' }) {
  if (tone === 'dark') {
    return (
      <Link className="brand-logo brand-logo-dark" href="/" aria-label="MedTender AI – Trang chủ">
        <span className="brand-lockup" aria-hidden="true">
          <Image className="brand-layer" src="/brand/medtender-ai-transparent.png" alt="" width={2179} height={722} priority />
          <Image className="brand-layer brand-layer-word" src="/brand/medtender-ai-transparent.png" alt="" width={2179} height={722} priority />
          <Image className="brand-layer brand-layer-ai" src="/brand/medtender-ai-transparent.png" alt="" width={2179} height={722} priority />
        </span>
      </Link>
    )
  }

  return (
    <Link className="brand-logo" href="/" aria-label="MedTender AI – Trang chủ">
      <Image src="/brand/medtender-ai-transparent.png" alt="MedTender AI" width={2179} height={722} priority />
    </Link>
  )
}
