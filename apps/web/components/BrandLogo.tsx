import Image from "next/image";

export default function BrandLogo({ priority = false }: { priority?: boolean }) {
  return <span className="brand-logo-panel"><Image
    className="brand-logo"
    src="/Anondo-Housing-Logo.png"
    alt="আনন্দ হাউজিং সোসাইটি — Anondo Housing Society"
    width={708}
    height={464}
    sizes="(max-width: 620px) 140px, (max-width: 960px) 72px, 190px"
    priority={priority}
  /></span>;
}
