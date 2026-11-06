import Image from 'next/image'
import Link from 'next/link'

export function Logo({ tone = 'default' }: { tone?: 'default' | 'dark' }) {
  return (
    <Link
      className={tone === 'dark' ? 'brand-logo brand-logo-dark' : 'brand-logo'}
      href="/"
      aria-label="MedTender AI – Trang chủ"
    >
      <span className="brand-lockup">
        <Image
          className="brand-layer brand-layer-base"
          src="/brand/medtender-ai-transparent.png"
          alt="MedTender AI"
          width={2179}
          height={722}
          priority
        />
        <Image
          className="brand-layer brand-layer-word"
          src="/brand/medtender-ai-transparent.png"
          alt=""
          width={2179}
          height={722}
          priority
          aria-hidden="true"
        />
        <Image
          className="brand-layer brand-layer-ai"
          src="/brand/medtender-ai-transparent.png"
          alt=""
          width={2179}
          height={722}
          priority
          aria-hidden="true"
        />
      </span>
    </Link>
  )
}
