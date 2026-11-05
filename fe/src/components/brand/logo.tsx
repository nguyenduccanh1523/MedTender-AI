import Image from 'next/image'
import Link from 'next/link'

export function Logo() {
  return (
    <Link className="brand-logo" href="/" aria-label="MedTender AI – Trang chủ">
      <Image src="/brand/medtender-ai.png" alt="MedTender AI" width={1248} height={832} priority />
    </Link>
  )
}
