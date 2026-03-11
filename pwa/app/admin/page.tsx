"use client";

import { useState, useEffect, useRef, useReducer } from "react";
import { redirect, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { api, ApiError } from "@/lib/api";
import { useAppStore } from "@/store/app.store";
import { useReveal } from "@/hooks/useReveal";
import { logout } from "@/lib/auth";
import type {
  DashboardStats,
  TenantWithStats,
  PaginatedResponse,
} from "@/lib/types";

export default function AdminPage() {
  const user = useAppStore((s) => s.user);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (user.role !== "superadmin") {
    redirect("/scan");
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Noise texture (same as landing hero::after) */}
      <div className="fixed inset-0 opacity-[0.025] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      <Header />
      <main className="relative max-w-6xl mx-auto px-6 lg:px-8 py-14 space-y-16">
        <StatsSection />
        <QuickLinks />
        <TenantsSection />
        <InviteSection />
      </main>
    </div>
  );
}

/* ─── Gold separator (landing style) ─── */
function GoldRule() {
  return (
    <div className="gold-sep" />
  );
}

/* ─── Section heading (landing style with tag + serif heading) ─── */
function SectionHeading({ tag, title, action }: { tag?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          {tag && (
            <div className="section-tag mb-3">
              <span>{tag}</span>
            </div>
          )}
          <h2 className="text-3xl lg:text-4xl font-display font-light text-white tracking-wide leading-tight">
            {title}
          </h2>
        </div>
        {action}
      </div>
      <GoldRule />
    </div>
  );
}

function Header() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-gold/10">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold/60 to-gold-dk/40 flex items-center justify-center border border-gold/20">
            <span className="text-black font-display font-semibold text-sm">H</span>
          </div>
          <div>
            <h1 className="text-sm font-display font-light text-white/90 tracking-[0.2em] uppercase">
              Heritage Motor
            </h1>
            <p className="text-gold/50 text-[10px] tracking-[0.25em] uppercase font-medium">
              Platform Administration
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {user && (
            <span className="text-white/25 text-xs tracking-wider">
              {user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-white/30 text-xs tracking-[0.15em] uppercase hover:text-gold transition-colors duration-500"
            style={{ transitionTimingFunction: "var(--ease-lux)" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

function StatsSection() {
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
              <p className="text-3xl lg:text-4xl font-display font-light text-white/90 tabular-nums">
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

function QuickLinks() {
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
            <p className="text-sm font-display font-light text-white/80 group-hover:text-white transition-colors duration-300 tracking-wide">
              {link.title}
            </p>
            <p className="text-[10px] text-white/25 mt-1 font-light">{link.sub}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function TenantsSection() {
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
            <p className="text-white/20 text-sm font-display font-light italic">
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

function TenantRow({
  tenant: t,
  isEditing,
  onToggleEdit,
}: {
  tenant: TenantWithStats;
  isEditing: boolean;
  onToggleEdit: () => void;
}) {
  const [{ name, plan, status }, setForm] = useReducer(
    (s: { name: string; plan: string; status: string }, a: Partial<{ name: string; plan: string; status: string }>) => ({ ...s, ...a }),
    { name: t.name, plan: t.plan, status: t.status }
  );
  const [{ saving, deleting, confirmDelete, error }, setUi] = useReducer(
    (s: { saving: boolean; deleting: boolean; confirmDelete: boolean; error: string | null }, a: Partial<{ saving: boolean; deleting: boolean; confirmDelete: boolean; error: string | null }>) => ({ ...s, ...a }),
    { saving: false, deleting: false, confirmDelete: false, error: null as string | null }
  );

  async function handleSave() {
    setUi({ saving: true });
    setUi({ error: null });
    try {
      const body: Record<string, string> = {};
      if (name !== t.name) body.name = name;
      if (plan !== t.plan) body.plan = plan;
      if (status !== t.status) body.status = status;
      if (Object.keys(body).length === 0) { onToggleEdit(); return; }
      await api.patch(`/admin/tenants/${t.id}`, body);
      mutate("/admin/tenants");
      mutate("/admin/dashboard");
      onToggleEdit();
    } catch (err) {
      setUi({ error: err instanceof ApiError ? err.message : "Failed to update" });
    } finally {
      setUi({ saving: false });
    }
  }

  async function handleDelete() {
    setUi({ deleting: true });
    setUi({ error: null });
    try {
      await api.delete(`/admin/tenants/${t.id}`);
      mutate("/admin/tenants");
      mutate("/admin/dashboard");
    } catch (err) {
      setUi({ error: err instanceof ApiError ? err.message : "Failed to delete" });
      setUi({ deleting: false });
    }
  }

  return (
    <div className="bg-dark-2 group hover:bg-[#161512] transition-colors duration-500" style={{ transitionTimingFunction: "var(--ease-lux)" }}>
      <div
        className="p-5 flex items-center justify-between cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={onToggleEdit}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleEdit(); } }}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/15 flex items-center justify-center shrink-0">
            <span className="text-gold/60 font-display text-sm font-light">
              {t.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-display font-light text-sm text-white/80 group-hover:text-white/95 transition-colors tracking-wide">
              {t.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white/20 text-xs font-mono">{t.slug}</span>
              <span className="text-white/10">|</span>
              <span className="text-white/25 text-xs capitalize font-light">{t.plan}</span>
              <span className="text-white/10">|</span>
              <span className={`text-xs font-light ${
                t.status === "active" ? "text-emerald-400/60" : "text-amber-400/60"
              }`}>
                {t.status}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <StatPill value={t.user_count} label="users" />
          <StatPill value={t.vehicle_count} label="vehicles" />
          <StatPill value={t.bay_count} label="bays" />
          <svg
            className={`w-4 h-4 text-white/15 transition-transform duration-300 ${isEditing ? "rotate-180" : ""}`}
            style={{ transitionTimingFunction: "var(--ease-lux)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isEditing && (
        <div className="px-5 pb-5 pt-1 border-t border-white/[0.04]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                value={name}
                onChange={(e) => setForm({ name: e.target.value })}
                className={inputClass}
              />
            </label>
            <div>
              <label htmlFor={`plan-${t.id}`} className={labelClass}>Plan</label>
              <Select id={`plan-${t.id}`} value={plan} onChange={(v) => setForm({ plan: v })} options={[
                { value: "starter", label: "Starter" },
                { value: "pro", label: "Pro" },
                { value: "enterprise", label: "Enterprise" },
              ]} />
            </div>
            <div>
              <label htmlFor={`status-${t.id}`} className={labelClass}>Status</label>
              <Select id={`status-${t.id}`} value={status} onChange={(v) => setForm({ status: v })} options={[
                { value: "active", label: "Active" },
                { value: "trial", label: "Trial" },
                { value: "suspended", label: "Suspended" },
              ]} />
            </div>
          </div>

          {error && <p className="text-red-400/80 text-xs mt-3 font-light">{error}</p>}

          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-gold text-black text-xs font-semibold tracking-[0.15em] uppercase hover:bg-gold-lt disabled:opacity-40 transition-all duration-500"
                style={{ transitionTimingFunction: "var(--ease-lux)" }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={onToggleEdit}
                className="text-white/25 text-xs tracking-[0.12em] uppercase hover:text-white/50 transition-colors duration-300"
              >
                Cancel
              </button>
            </div>

            {!confirmDelete ? (
              <button
                onClick={(e) => { e.stopPropagation(); setUi({ confirmDelete: true }); }}
                className="text-red-400/30 text-xs tracking-[0.12em] uppercase hover:text-red-400/60 transition-colors duration-300"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-red-400/50 text-xs font-light">Confirm?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-1.5 rounded-lg bg-red-500/15 text-red-400/80 text-xs font-medium tracking-wider uppercase border border-red-500/15 hover:bg-red-500/25 disabled:opacity-40 transition-all duration-300"
                >
                  {deleting ? "Deleting..." : "Yes, delete"}
                </button>
                <button
                  onClick={() => setUi({ confirmDelete: false })}
                  className="text-white/25 text-xs tracking-wider uppercase hover:text-white/50 transition-colors"
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-right">
      <p className="text-sm font-display font-light text-white/50 tabular-nums">{value}</p>
      <p className="text-[10px] text-white/15 tracking-[0.12em] uppercase">{label}</p>
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/90 text-sm font-light placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 focus:bg-white/[0.05] transition-all duration-300";

const labelClass = "block text-[10px] tracking-[0.15em] uppercase text-gold/40 mb-1.5 font-medium";

type SelectOption = { value: string; label: string };

function Select({
  value,
  onChange,
  options,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen(!open)}
        className={`${inputClass} text-left flex items-center justify-between`}
      >
        <span className={selected ? "text-white/90" : "text-white/15"}>
          {selected?.label ?? placeholder ?? "Select..."}
        </span>
        <svg
          className={`w-4 h-4 text-white/15 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          style={{ transitionTimingFunction: "var(--ease-lux)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-white/[0.08] bg-dark shadow-xl shadow-black/50 overflow-hidden">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm font-light transition-colors duration-200 ${
                o.value === value
                  ? "bg-gold/[0.08] text-gold"
                  : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTenantForm({ onDone }: { onDone: () => void }) {
  const [{ name, slug, country, timezone, plan }, setForm] = useReducer(
    (s: { name: string; slug: string; country: string; timezone: string; plan: string }, a: Partial<{ name: string; slug: string; country: string; timezone: string; plan: string }>) => ({ ...s, ...a }),
    { name: "", slug: "", country: "FR", timezone: "Europe/Paris", plan: "starter" }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/admin/tenants", { name, slug, country, timezone, plan });
      mutate("/admin/tenants");
      mutate("/admin/dashboard");
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-dark-2 border border-white/[0.06] gold-border-top rounded-2xl p-6 space-y-5"
    >
      <p className="text-[10px] tracking-[0.2em] uppercase text-gold/50 font-medium">
        New Tenant
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block">
          <span className={labelClass}>Facility name</span>
          <input
            value={name}
            onChange={(e) => {
              const val = e.target.value;
              setForm({
                name: val,
                slug: val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
              });
            }}
            placeholder="e.g. Monte Carlo Motors"
            required
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Slug</span>
          <input
            value={slug}
            onChange={(e) => setForm({ slug: e.target.value })}
            placeholder="monte-carlo-motors"
            required
            pattern="[a-z0-9-]+"
            className={`${inputClass} font-mono`}
          />
        </label>
        <div>
          <label htmlFor="create-plan" className={labelClass}>Plan</label>
          <Select id="create-plan" value={plan} onChange={(v) => setForm({ plan: v })} options={[
            { value: "starter", label: "Starter — 25 vehicles, 5 users, 20 bays" },
            { value: "pro", label: "Pro — 100 vehicles, 20 users, 100 bays" },
            { value: "enterprise", label: "Enterprise — unlimited" },
          ]} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>Country</span>
          <input
            value={country}
            onChange={(e) => setForm({ country: e.target.value.toUpperCase() })}
            placeholder="FR"
            required
            pattern="[A-Z]{2}"
            maxLength={2}
            className={`${inputClass} font-mono uppercase tracking-widest`}
          />
        </label>
        <div>
          <label htmlFor="create-timezone" className={labelClass}>Timezone</label>
          <Select id="create-timezone" value={timezone} onChange={(v) => setForm({ timezone: v })} options={[
            { value: "Europe/Paris", label: "Europe / Paris" },
            { value: "Europe/London", label: "Europe / London" },
            { value: "Europe/Berlin", label: "Europe / Berlin" },
            { value: "Europe/Zurich", label: "Europe / Zurich" },
            { value: "Europe/Brussels", label: "Europe / Brussels" },
            { value: "America/New_York", label: "America / New York" },
            { value: "America/Los_Angeles", label: "America / Los Angeles" },
            { value: "Asia/Dubai", label: "Asia / Dubai" },
          ]} />
        </div>
      </div>
      {error && <p className="text-red-400/80 text-xs font-light">{error}</p>}
      <div className="flex items-center gap-4 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-lg bg-gold text-black text-xs font-semibold tracking-[0.15em] uppercase hover:bg-gold-lt disabled:opacity-40 transition-all duration-500"
          style={{ transitionTimingFunction: "var(--ease-lux)" }}
        >
          {loading ? "Creating..." : "Create Tenant"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-white/25 text-xs tracking-[0.12em] uppercase hover:text-white/50 transition-colors duration-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function InviteSection() {
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
            <Select
              id="invite-tenant"
              value={tenantId}
              onChange={(v) => setForm({ tenantId: v })}
              placeholder="Select tenant..."
              options={tenants?.data?.map((t) => ({ value: t.id, label: t.name })) ?? []}
            />
          </div>
          <div>
            <label htmlFor="invite-role" className={labelClass}>Role</label>
            <Select id="invite-role" value={role} onChange={(v) => setForm({ role: v })} options={[
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
