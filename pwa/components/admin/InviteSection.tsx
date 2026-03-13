"use client";

import { useState, useReducer } from "react";
import useSWR from "swr";
import { api, ApiError } from "@/lib/api";
import { useReveal } from "@/hooks/useReveal";
import { AdminSelect, inputClass, labelClass } from "./AdminSelect";
import { SectionHeading } from "./SectionHeading";
import type { TenantWithStats, PaginatedResponse } from "@/lib/types";

export function InviteSection() {
  const { data: tenants } =
    useSWR<PaginatedResponse<TenantWithStats>>("/admin/tenants");
  const [{ tenantId, email, firstName, lastName, role }, setForm] = useReducer(
    (s: { tenantId: string; email: string; firstName: string; lastName: string; role: string }, a: Partial<{ tenantId: string; email: string; firstName: string; lastName: string; role: string }>) => ({ ...s, ...a }),
    { tenantId: "", email: "", firstName: "", lastName: "", role: "admin" }
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const revealRef = useReveal();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const trimmedEmail = email.trim();
      await api.post("/admin/invitations", {
        tenant_id: tenantId,
        email: trimmedEmail,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role,
      });
      setResult(`Invitation sent to ${trimmedEmail}`);
      setForm({ email: "", firstName: "", lastName: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6" ref={revealRef}>
      <div className="reveal-up">
        <SectionHeading tag="Onboarding" title="Invite User" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="reveal-up reveal-d1 bg-dark-2 border border-white/[0.06] gold-border-top rounded-2xl p-6 space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="invite-tenant" className={labelClass}>Tenant</label>
            <AdminSelect
              id="invite-tenant"
              value={tenantId}
              onChange={(v) => setForm({ tenantId: v })}
              placeholder="Select tenant..."
              options={tenants?.data?.map((t) => ({ value: t.id, label: t.name })) ?? []}
            />
          </div>
          <div>
            <label htmlFor="invite-role" className={labelClass}>Role</label>
            <AdminSelect id="invite-role" value={role} onChange={(v) => setForm({ role: v })} options={[
              { value: "admin", label: "Admin" },
              { value: "operator", label: "Operator" },
              { value: "technician", label: "Technician" },
              { value: "viewer", label: "Viewer" },
            ]} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className={labelClass}>First name</span>
            <input
              value={firstName}
              onChange={(e) => setForm({ firstName: e.target.value })}
              placeholder="John"
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Last name</span>
            <input
              value={lastName}
              onChange={(e) => setForm({ lastName: e.target.value })}
              placeholder="Doe"
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setForm({ email: e.target.value })}
              placeholder="john@example.com"
              required
              className={inputClass}
            />
          </label>
        </div>

        {error && <p className="text-red-400/80 text-xs font-light">{error}</p>}
        {result && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-emerald-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-emerald-400/70 text-xs font-light">{result}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !tenantId}
          className="px-6 py-2.5 rounded-lg bg-gold text-black text-xs font-semibold tracking-[0.15em] uppercase hover:bg-gold-lt disabled:opacity-40 transition-all duration-500"
          style={{ transitionTimingFunction: "var(--ease-lux)" }}
        >
          {loading ? "Sending..." : "Send Invitation"}
        </button>
      </form>
    </section>
  );
}
