"use client";

import { useRouter } from "next/navigation";
import { useReveal } from "@/hooks/useReveal";

export function QuickLinks() {
  const router = useRouter();
  const revealRef = useReveal();

  return (
    <section ref={revealRef}>
      <div className="reveal-up grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: "/admin/qr-codes", title: "QR Codes", sub: "Print QR sheets" },
          { href: "/bays", title: "Bays", sub: "Manage facility" },
          { href: "/dashboard", title: "Vehicles", sub: "Fleet registry" },
          { href: "/scan", title: "Scan", sub: "Quick lookup" },
        ].map((link) => (
          <button
            key={link.href}
            onClick={() => router.push(link.href)}
            className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift text-left group"
          >
            <p className="text-sm font-normal text-white/80 group-hover:text-white transition-colors duration-300">
              {link.title}
            </p>
            <p className="text-[10px] text-white/25 mt-1 font-light">{link.sub}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
