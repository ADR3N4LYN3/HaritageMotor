"use client";

import useSWR from "swr";
import { useReveal } from "@/hooks/useReveal";
import type { DashboardStats } from "@/lib/types";

export function StatsSection() {
  const { data } = useSWR<DashboardStats>("/admin/dashboard");
  const revealRef = useReveal();

  const stats = [
    { label: "Tenants", value: data?.total_tenants ?? "-", sub: "registered" },
    { label: "Active", value: data?.active_tenants ?? "-", sub: "operational" },
    { label: "Users", value: data?.total_users ?? "-", sub: "across tenants" },
    { label: "Vehicles", value: data?.total_vehicles ?? "-", sub: "in custody" },
  ];

  return (
    <section ref={revealRef}>
      <div className="reveal-up grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`bg-dark-2 p-6 lg:p-8 group relative overflow-hidden reveal-up reveal-d${i + 1}`}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-gold/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <p className="text-3xl lg:text-4xl font-sans font-normal text-white/90 tabular-nums">
                {s.value}
              </p>
              <p className="text-[10px] tracking-[0.15em] uppercase text-gold/60 mt-2 font-medium">
                {s.label}
              </p>
              <p className="text-white/15 text-[10px] mt-0.5 font-light">
                {s.sub}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
