import Link from "next/link";
import Image from "next/image";
import logoCrest from "@/public/logo-crest-v2.png";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
      <Image
        src={logoCrest}
        alt="Heritage Motor"
        width={64}
        height={64}
        className="opacity-30 mb-6"
      />
      <h1 className="font-display text-5xl font-light tracking-wide text-white/80 mb-2">
        404
      </h1>
      <p className="text-white/30 text-sm tracking-wider uppercase mb-8">
        Page not found
      </p>
      <Link
        href="/dashboard"
        className="px-6 py-3 rounded-xl border border-gold/30 text-gold text-sm tracking-wider uppercase hover:bg-gold hover:text-black transition-all duration-500"
        style={{ transitionTimingFunction: "var(--ease-lux)" }}
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
