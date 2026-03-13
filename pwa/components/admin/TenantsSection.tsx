"use client";

import { useState } from "react";
import useSWR from "swr";
import { useReveal } from "@/hooks/useReveal";
import { SectionHeading } from "./SectionHeading";
import { TenantRow } from "./TenantRow";
import { CreateTenantForm } from "./CreateTenantForm";
import type { TenantWithStats, PaginatedResponse } from "@/lib/types";

export function TenantsSection() {
  const { data } = useSWR<PaginatedResponse<TenantWithStats>>(
    "/admin/tenants"
  );
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const revealRef = useReveal();

  return (
    <section className="space-y-6" ref={revealRef}>
      <div className="reveal-up">
        <SectionHeading
          tag="Management"
          title="Tenants"
          action={
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="text-xs tracking-[0.15em] uppercase px-5 py-2.5 rounded-lg border border-gold/20 text-gold/70 hover:bg-gold hover:text-black hover:border-gold transition-all duration-500 relative overflow-hidden"
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            >
              {showCreate ? "Cancel" : "New Tenant"}
            </button>
          }
        />
      </div>

      {showCreate && <CreateTenantForm onDone={() => setShowCreate(false)} />}

      <div className="reveal-up reveal-d1 space-y-px rounded-2xl overflow-hidden border border-white/[0.06]">
        {data?.data?.length === 0 && (
          <div className="bg-dark-2 py-16 text-center">
            <p className="text-white/20 text-sm font-light italic">
              No tenants yet
            </p>
            <p className="text-white/10 text-xs mt-1 font-light">
              Create one to get started
            </p>
          </div>
        )}
        {data?.data?.map((t) => (
          <TenantRow
            key={t.id}
            tenant={t}
            isEditing={editingId === t.id}
            onToggleEdit={() => setEditingId(editingId === t.id ? null : t.id)}
          />
        ))}
      </div>
    </section>
  );
}
