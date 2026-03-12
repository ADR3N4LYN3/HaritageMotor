"use client";

import { useState, useEffect, useMemo, useCallback, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { VehicleCard } from "@/components/ui/VehicleCard";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useAppStore } from "@/store/app.store";
import { useReveal } from "@/hooks/useReveal";
import { api, ApiError } from "@/lib/api";
import { logout } from "@/lib/auth";
import { mutate } from "swr";
import useSWR from "swr";
import type {
  Vehicle,
  DashboardStats,
  TenantWithStats,
  PaginatedResponse,
} from "@/lib/types";

/* ══════════════════════════════════════════════════════════════════════
   ROUTE: /dashboard
   - superadmin → admin platform dashboard (activity sidebar + tabs)
   - other roles → vehicle registry (existing behavior)
   ══════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const user = useAppStore((s) => s.user);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (user.role === "superadmin") {
    return <SuperAdminDashboard />;
  }

  return <TenantDashboard />;
}

/* ══════════════════════════════════════════════════════════════════════
   SUPERADMIN DASHBOARD — Activity sidebar + Tabs
   ══════════════════════════════════════════════════════════════════════ */

type AdminTab = "overview" | "tenants" | "vehicles" | "bays" | "invite";

const TAB_ITEMS: { key: AdminTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "tenants", label: "Tenants" },
  { key: "vehicles", label: "Vehicles" },
  { key: "bays", label: "Bays" },
  { key: "invite", label: "Invite User" },
];

function SuperAdminDashboard() {
  const [tab, setTab] = useState<AdminTab>("overview");

  return (
    <div className="min-h-screen bg-black">
      {/* Noise texture */}
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <AdminHeader />

      {/* Tabs */}
      <div className="sticky top-16 z-40 bg-black/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="flex" style={{ paddingLeft: "352px" }}>
          {TAB_ITEMS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-6 py-3.5 text-xs tracking-[0.12em] uppercase font-medium border-b-2 transition-all duration-300 ${
                tab === t.key
                  ? "text-gold border-gold"
                  : "text-white/30 border-transparent hover:text-white/60"
              }`}
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area: Activity sidebar + Main */}
      <div className="relative flex" style={{ minHeight: "calc(100vh - 128px)" }}>
        {/* Activity sidebar */}
        <aside className="w-80 flex-shrink-0 border-r border-white/[0.04] overflow-y-auto p-7 sticky top-32 self-start" style={{ maxHeight: "calc(100vh - 128px)" }}>
          <ActivityPanel />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-10 max-w-[1000px]">
          {tab === "overview" && <OverviewTab onNavigate={setTab} />}
          {tab === "tenants" && <TenantsTab />}
          {tab === "vehicles" && <VehiclesTab />}
          {tab === "bays" && <BaysTab />}
          {tab === "invite" && <InviteTab />}
        </main>
      </div>
    </div>
  );
}

/* ─── Admin Header ─── */
function AdminHeader() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-gold/10">
      <div className="h-16 flex items-center justify-between px-8">
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

/* ─── Activity Panel (sidebar) ─── */
function ActivityPanel() {
  // Static activity data — in production this would come from /audit endpoint
  const activities = [
    { text: "Marc Dubois moved Ferrari 488 GTB to bay A-12", time: "2h", tenant: "MCM" },
    { text: "Sophie Martin completed inspection on McLaren 720S", time: "5h", tenant: "MCM" },
    { text: "J-P Laurent created new vehicle Porsche Taycan", time: "1d", tenant: "GPS" },
    { text: "Henri Blanc generated exit report for Bentley Continental GT", time: "2d", tenant: "LCV" },
    { text: "System: trial expires in 5 days", time: "3d", tenant: "" },
    { text: "Marc Dubois moved Ferrari 488 GTB to bay A-12", time: "4d", tenant: "MCM" },
    { text: "Sophie Martin completed inspection on McLaren 720S", time: "5d", tenant: "MCM" },
  ];

  return (
    <>
      <div className="flex items-center gap-2 mb-5">
        <div className="w-[7px] h-[7px] rounded-full bg-gold opacity-60" style={{ boxShadow: "0 0 10px rgba(184,149,90,0.4)" }} />
        <p className="text-[11px] tracking-[0.18em] uppercase text-gold/60 font-semibold">
          Recent activity
        </p>
      </div>

      <div className="relative pl-3.5 border-l border-gold/[0.12]">
        {activities.map((a, i) => (
          <div key={i} className="relative pb-5 last:pb-0">
            {/* Dot on the line */}
            <div
              className={`absolute -left-[18px] top-[5px] w-2 h-2 rounded-full ${
                i === 0
                  ? "bg-gold"
                  : "bg-gold/20 border border-gold/[0.15]"
              }`}
            />
            <p
              className={`text-[12.5px] leading-[1.5] break-words ${
                i === 0
                  ? "text-white/80 font-normal"
                  : "text-white/[0.55] font-light"
              }`}
            >
              {a.text}
            </p>
            <div className="flex gap-2 mt-1">
              <span className="text-[10px] text-white/20">{a.time}</span>
              {a.tenant && (
                <span className="text-[10px] text-gold/30 font-medium">{a.tenant}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── Overview Tab ─── */
function OverviewTab({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  const { data: stats } = useSWR<DashboardStats>("/admin/dashboard");
  const { data: tenantsData } = useSWR<PaginatedResponse<TenantWithStats>>("/admin/tenants");
  const revealRef = useReveal();

  const statItems = [
    { label: "Tenants", value: stats?.total_tenants ?? "-", sub: "registered" },
    { label: "Active", value: stats?.active_tenants ?? "-", sub: "operational" },
    { label: "Users", value: stats?.total_users ?? "-", sub: "across tenants" },
    { label: "Vehicles", value: stats?.total_vehicles ?? "-", sub: "in custody" },
  ];

  return (
    <div ref={revealRef} className="space-y-8">
      {/* Stats grid */}
      <div className="reveal-up grid grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
        {statItems.map((s, i) => (
          <div key={s.label} className={`bg-dark-2 p-7 group relative overflow-hidden reveal-up reveal-d${i + 1}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-gold/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative text-center">
              <p className="text-4xl font-sans font-normal text-white/90 tabular-nums">{s.value}</p>
              <p className="text-[11px] tracking-[0.14em] uppercase text-gold/70 mt-2 font-medium">{s.label}</p>
              <p className="text-white/25 text-[11px] mt-1 font-light">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="reveal-up reveal-d2 grid grid-cols-4 gap-3">
        {([
          { tab: "tenants" as AdminTab, title: "Tenants", sub: "Manage facilities" },
          { tab: "vehicles" as AdminTab, title: "Vehicles", sub: "Fleet registry" },
          { tab: "bays" as AdminTab, title: "Bays", sub: "Storage bays" },
          { tab: "invite" as AdminTab, title: "Invite User", sub: "Send invitation" },
        ]).map((link) => (
          <button
            key={link.tab}
            onClick={() => onNavigate(link.tab)}
            className="bg-white/[0.03] rounded-2xl p-5 border border-white/[0.06] gold-border-top card-lift text-center group"
          >
            <p className="text-sm text-white/85 group-hover:text-white transition-colors duration-300 tracking-wide">
              {link.title}
            </p>
            <p className="text-[11px] text-white/35 mt-1 font-light">{link.sub}</p>
          </button>
        ))}
      </div>

      {/* Tenants summary */}
      <div className="reveal-up reveal-d3 space-y-4">
        <div className="section-tag"><span>Tenants</span></div>
        <div className="gold-sep" />

        <div className="space-y-3 mt-4">
          {tenantsData?.data?.map((t) => (
            <button
              key={t.id}
              onClick={() => onNavigate("tenants")}
              className="w-full bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] card-lift text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/15 flex items-center justify-center shrink-0">
                    <span className="text-gold/60 text-sm font-medium">{t.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm text-white/85">{t.name}</p>
                    <p className="text-xs text-white/35 mt-0.5 font-light">
                      {t.plan} · {t.vehicle_count} vehicles
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-medium tracking-wider uppercase px-2.5 py-1 rounded-full ${
                    t.status === "active"
                      ? "bg-emerald-400/10 text-emerald-400/70"
                      : "bg-amber-400/10 text-amber-400/70"
                  }`}
                >
                  {t.status}
                </span>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => onNavigate("tenants")}
          className="w-full py-2.5 rounded-lg border border-gold/20 text-gold/70 text-xs tracking-[0.15em] uppercase hover:bg-gold hover:text-black hover:border-gold transition-all duration-500"
          style={{ transitionTimingFunction: "var(--ease-lux)" }}
        >
          Manage facilities
        </button>
      </div>
    </div>
  );
}

/* ─── Tenants Tab (full CRUD) ─── */
function TenantsTab() {
  const { data } = useSWR<PaginatedResponse<TenantWithStats>>("/admin/tenants");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const revealRef = useReveal();

  return (
    <div ref={revealRef} className="space-y-6">
      <div className="reveal-up">
        <SectionHeading
          tag="Management"
          title="Tenants"
          action={
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="text-xs tracking-[0.15em] uppercase px-5 py-2.5 rounded-lg border border-gold/20 text-gold/70 hover:bg-gold hover:text-black hover:border-gold transition-all duration-500"
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
            <p className="text-white/20 text-sm font-light italic">No tenants yet</p>
            <p className="text-white/10 text-xs mt-1 font-light">Create one to get started</p>
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
    </div>
  );
}

/* ─── Vehicles Tab (cross-tenant, read-only overview) ─── */
function VehiclesTab() {
  const { data: tenantsData } = useSWR<PaginatedResponse<TenantWithStats>>("/admin/tenants");
  const { data: stats } = useSWR<DashboardStats>("/admin/dashboard");
  const revealRef = useReveal();

  return (
    <div ref={revealRef} className="space-y-6">
      <div className="reveal-up">
        <SectionHeading tag="Fleet" title="Vehicles" />
      </div>

      <div className="reveal-up reveal-d1 grid grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
        <div className="bg-dark-2 p-6 text-center">
          <p className="text-3xl font-sans font-normal text-white/90 tabular-nums">{stats?.total_vehicles ?? "-"}</p>
          <p className="text-[10px] tracking-[0.15em] uppercase text-gold/60 mt-2 font-medium">Total</p>
        </div>
        <div className="bg-dark-2 p-6 text-center">
          <p className="text-3xl font-sans font-normal text-white/90 tabular-nums">{tenantsData?.data?.length ?? "-"}</p>
          <p className="text-[10px] tracking-[0.15em] uppercase text-gold/60 mt-2 font-medium">Tenants</p>
        </div>
        <div className="bg-dark-2 p-6 text-center">
          <p className="text-3xl font-sans font-normal text-white/90 tabular-nums">{stats?.total_users ?? "-"}</p>
          <p className="text-[10px] tracking-[0.15em] uppercase text-gold/60 mt-2 font-medium">Users</p>
        </div>
      </div>

      <div className="reveal-up reveal-d2 space-y-3">
        <p className="text-[10px] tracking-[0.15em] uppercase text-gold/40 font-medium">Vehicles per tenant</p>
        {tenantsData?.data?.map((t) => (
          <div key={t.id} className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/15 flex items-center justify-center shrink-0">
                <span className="text-gold/60 text-xs font-medium">{t.name.charAt(0)}</span>
              </div>
              <p className="text-sm text-white/80">{t.name}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-sans font-normal text-white/70 tabular-nums">{t.vehicle_count}</p>
              <p className="text-[9px] tracking-[0.12em] uppercase text-white/20">vehicles</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Bays Tab (cross-tenant overview) ─── */
function BaysTab() {
  const { data: tenantsData } = useSWR<PaginatedResponse<TenantWithStats>>("/admin/tenants");
  const revealRef = useReveal();

  const totalBays = tenantsData?.data?.reduce((s, t) => s + t.bay_count, 0) ?? 0;

  return (
    <div ref={revealRef} className="space-y-6">
      <div className="reveal-up">
        <SectionHeading tag="Infrastructure" title="Bays" />
      </div>

      <div className="reveal-up reveal-d1 grid grid-cols-2 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
        <div className="bg-dark-2 p-6 text-center">
          <p className="text-3xl font-sans font-normal text-white/90 tabular-nums">{totalBays}</p>
          <p className="text-[10px] tracking-[0.15em] uppercase text-gold/60 mt-2 font-medium">Total bays</p>
        </div>
        <div className="bg-dark-2 p-6 text-center">
          <p className="text-3xl font-sans font-normal text-white/90 tabular-nums">{tenantsData?.data?.length ?? "-"}</p>
          <p className="text-[10px] tracking-[0.15em] uppercase text-gold/60 mt-2 font-medium">Facilities</p>
        </div>
      </div>

      <div className="reveal-up reveal-d2 space-y-3">
        <p className="text-[10px] tracking-[0.15em] uppercase text-gold/40 font-medium">Bays per tenant</p>
        {tenantsData?.data?.map((t) => (
          <div key={t.id} className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/15 flex items-center justify-center shrink-0">
                <span className="text-gold/60 text-xs font-medium">{t.name.charAt(0)}</span>
              </div>
              <p className="text-sm text-white/80">{t.name}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-sans font-normal text-white/70 tabular-nums">{t.bay_count}</p>
              <p className="text-[9px] tracking-[0.12em] uppercase text-white/20">bays</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Invite Tab ─── */
function InviteTab() {
  const { data: tenants } = useSWR<PaginatedResponse<TenantWithStats>>("/admin/tenants");
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
    <div ref={revealRef} className="space-y-6">
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
            <input value={firstName} onChange={(e) => setForm({ firstName: e.target.value })} placeholder="John" required className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Last name</span>
            <input value={lastName} onChange={(e) => setForm({ lastName: e.target.value })} placeholder="Doe" required className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Email</span>
            <input type="email" value={email} onChange={(e) => setForm({ email: e.target.value })} placeholder="john@example.com" required className={inputClass} />
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
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ══════════════════════════════════════════════════════════════════════ */

function GoldRule() {
  return <div className="gold-sep" />;
}

function SectionHeading({ tag, title, action }: { tag?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          {tag && <div className="section-tag mb-3"><span>{tag}</span></div>}
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

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/90 text-sm font-light placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 focus:bg-white/[0.05] transition-all duration-300";

const labelClass = "block text-[10px] tracking-[0.15em] uppercase text-gold/40 mb-1.5 font-medium";

/* ─── Tenant Row (expandable edit) ─── */
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
    setUi({ saving: true, error: null });
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
    setUi({ deleting: true, error: null });
    try {
      await api.delete(`/admin/tenants/${t.id}`);
      mutate("/admin/tenants");
      mutate("/admin/dashboard");
    } catch (err) {
      setUi({ error: err instanceof ApiError ? err.message : "Failed to delete", deleting: false });
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
            <span className="text-gold/60 font-display text-sm font-light">{t.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p className="font-display font-light text-sm text-white/80 group-hover:text-white/95 transition-colors tracking-wide">{t.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white/20 text-xs font-mono">{t.slug}</span>
              <span className="text-white/10">|</span>
              <span className="text-white/25 text-xs capitalize font-light">{t.plan}</span>
              <span className="text-white/10">|</span>
              <span className={`text-xs font-light ${t.status === "active" ? "text-emerald-400/60" : "text-amber-400/60"}`}>{t.status}</span>
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
              <input value={name} onChange={(e) => setForm({ name: e.target.value })} className={inputClass} />
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
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-gold text-black text-xs font-semibold tracking-[0.15em] uppercase hover:bg-gold-lt disabled:opacity-40 transition-all duration-500" style={{ transitionTimingFunction: "var(--ease-lux)" }}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={onToggleEdit} className="text-white/25 text-xs tracking-[0.12em] uppercase hover:text-white/50 transition-colors duration-300">Cancel</button>
            </div>
            {!confirmDelete ? (
              <button onClick={(e) => { e.stopPropagation(); setUi({ confirmDelete: true }); }} className="text-red-400/30 text-xs tracking-[0.12em] uppercase hover:text-red-400/60 transition-colors duration-300">Delete</button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-red-400/50 text-xs font-light">Confirm?</span>
                <button onClick={handleDelete} disabled={deleting} className="px-4 py-1.5 rounded-lg bg-red-500/15 text-red-400/80 text-xs font-medium tracking-wider uppercase border border-red-500/15 hover:bg-red-500/25 disabled:opacity-40 transition-all duration-300">
                  {deleting ? "Deleting..." : "Yes, delete"}
                </button>
                <button onClick={() => setUi({ confirmDelete: false })} className="text-white/25 text-xs tracking-wider uppercase hover:text-white/50 transition-colors">No</button>
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
      <p className="text-sm font-sans font-normal text-white/50 tabular-nums">{value}</p>
      <p className="text-[10px] text-white/15 tracking-[0.12em] uppercase">{label}</p>
    </div>
  );
}

/* ─── Create Tenant Form ─── */
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
    <form onSubmit={handleSubmit} className="bg-dark-2 border border-white/[0.06] gold-border-top rounded-2xl p-6 space-y-5">
      <p className="text-[10px] tracking-[0.2em] uppercase text-gold/50 font-medium">New Tenant</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block">
          <span className={labelClass}>Facility name</span>
          <input
            value={name}
            onChange={(e) => {
              const val = e.target.value;
              setForm({ name: val, slug: val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") });
            }}
            placeholder="e.g. Monte Carlo Motors"
            required
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Slug</span>
          <input value={slug} onChange={(e) => setForm({ slug: e.target.value })} placeholder="monte-carlo-motors" required pattern="[a-z0-9-]+" className={`${inputClass} font-mono`} />
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
          <input value={country} onChange={(e) => setForm({ country: e.target.value.toUpperCase() })} placeholder="FR" required pattern="[A-Z]{2}" maxLength={2} className={`${inputClass} font-mono uppercase tracking-widest`} />
        </label>
        <div>
          <label htmlFor="create-tz" className={labelClass}>Timezone</label>
          <Select id="create-tz" value={timezone} onChange={(v) => setForm({ timezone: v })} options={[
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
        <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-lg bg-gold text-black text-xs font-semibold tracking-[0.15em] uppercase hover:bg-gold-lt disabled:opacity-40 transition-all duration-500" style={{ transitionTimingFunction: "var(--ease-lux)" }}>
          {loading ? "Creating..." : "Create Tenant"}
        </button>
        <button type="button" onClick={onDone} className="text-white/25 text-xs tracking-[0.12em] uppercase hover:text-white/50 transition-colors duration-300">Cancel</button>
      </div>
    </form>
  );
}

/* ─── Custom Select ─── */
type SelectOption = { value: string; label: string };

function Select({ value, onChange, options, placeholder, id }: {
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

/* ══════════════════════════════════════════════════════════════════════
   TENANT DASHBOARD — Vehicle Registry (existing behavior for non-superadmin)
   ══════════════════════════════════════════════════════════════════════ */

function TenantDashboard() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const canCreate = user?.role === "admin" || user?.role === "operator";
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const revealRef = useReveal();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const queryString = useMemo(() => {
    const queryParams = new URLSearchParams();
    if (debouncedSearch) queryParams.set("search", debouncedSearch);
    if (statusFilter) queryParams.set("status", statusFilter);
    queryParams.set("page", String(page));
    queryParams.set("per_page", String(PER_PAGE));
    return queryParams.toString();
  }, [debouncedSearch, statusFilter, page]);

  const { data, isLoading, error } = useSWR<{ data: Vehicle[]; total_count: number }>(
    `/vehicles?${queryString}`,
    { refreshInterval: 30000 }
  );

  const vehicles = data?.data || [];
  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  const handleVehicleClick = useCallback(
    (id: string) => router.push(`/vehicle/${id}`),
    [router]
  );

  const statuses = ["", "stored", "out", "maintenance", "transit"];
  const statusLabels: Record<string, string> = {
    "": "All", stored: "Stored", out: "Out", maintenance: "Maint.", transit: "Transit",
  };

  const storedCount = vehicles.filter((v) => v.status === "stored").length;
  const outCount = vehicles.filter((v) => v.status === "out").length;

  return (
    <AppShell>
      <div ref={revealRef} className="space-y-6">
        <div className="reveal-up flex items-center justify-between">
          <div>
            <div className="section-tag mb-3"><span>Vehicle Registry</span></div>
            <h1 className="font-display text-3xl md:text-4xl font-light tracking-wide text-white leading-tight">Your fleet</h1>
          </div>
          {canCreate && (
            <button
              onClick={() => router.push("/vehicle/new")}
              className="w-11 h-11 rounded-full border border-gold/40 bg-transparent flex items-center justify-center text-gold text-xl font-light hover:bg-gold hover:text-black transition-all duration-500 active:scale-95"
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
              aria-label="Add vehicle"
            >+</button>
          )}
        </div>

        <div className="reveal-up reveal-d1">
          <div className="grid grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
            {[
              { value: totalCount, label: "Total", sub: "vehicles" },
              { value: storedCount, label: "Stored", sub: "in custody" },
              { value: outCount, label: "Out", sub: "with owners" },
            ].map((s) => (
              <div key={s.label} className="bg-dark-2 p-4 md:p-5 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-gold/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <p className="text-2xl md:text-3xl font-sans font-normal text-white/90 tabular-nums">{isLoading ? "-" : s.value}</p>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-gold/70 mt-1 font-medium">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="reveal-up reveal-d2 grid grid-cols-2 gap-3">
          <button onClick={() => router.push("/scan")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift text-left group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></svg>
              </div>
              <div>
                <p className="text-sm font-display font-light text-white/80 group-hover:text-white transition-colors duration-300 tracking-wide">Scan QR</p>
                <p className="text-[10px] text-white/25 mt-0.5">Quick lookup</p>
              </div>
            </div>
          </button>
          <button onClick={() => router.push("/bays")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift text-left group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
              </div>
              <div>
                <p className="text-sm font-display font-light text-white/80 group-hover:text-white transition-colors duration-300 tracking-wide">Bays</p>
                <p className="text-[10px] text-white/25 mt-0.5">Manage facility</p>
              </div>
            </div>
          </button>
          {canCreate && (
            <button onClick={() => router.push("/qr-codes")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift text-left group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" /><rect x="2" y="14" width="8" height="8" rx="1" /><path d="M14 14h4v4h-4zM22 14v4h-4M22 22h-4v-4" /></svg>
                </div>
                <div>
                  <p className="text-sm font-display font-light text-white/80 group-hover:text-white transition-colors duration-300 tracking-wide">QR Codes</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Print labels</p>
                </div>
              </div>
            </button>
          )}
          {user?.role === "admin" && (
            <button onClick={() => router.push("/users")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift text-left group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </div>
                <div>
                  <p className="text-sm font-display font-light text-white/80 group-hover:text-white transition-colors duration-300 tracking-wide">Team</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Manage users</p>
                </div>
              </div>
            </button>
          )}
        </div>

        <div className="reveal-up reveal-d3 gold-sep" />

        <div className="reveal-up reveal-d3">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by make, model, owner..."
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm font-light tracking-wide transition-all duration-300"
            style={{ transitionTimingFunction: "var(--ease-lux)" }}
          />
        </div>

        <div className="reveal-up reveal-d4 flex flex-wrap gap-2 pb-1">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] tracking-wide uppercase font-medium transition-all duration-300 border ${
                statusFilter === s
                  ? "bg-gold/15 text-gold border-gold/30"
                  : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/60 hover:border-white/[0.1]"
              }`}
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            >{statusLabels[s]}</button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3, 4].map((n) => <VehicleCardSkeleton key={n} />)}</div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-danger/80 text-sm font-light">Failed to load vehicles</p>
            <p className="text-white/20 text-xs mt-1">Please try again later</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-16 reveal-up">
            <p className="font-display text-xl font-light text-white/30 italic">No vehicles found</p>
            <p className="text-white/15 text-xs mt-2 tracking-wider uppercase">
              {searchInput || statusFilter ? "Try adjusting your filters" : "Add your first vehicle to get started"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((vehicle, i) => (
              <div key={vehicle.id} className={`reveal-up reveal-d${Math.min(i + 1, 6)}`}>
                <VehicleCard vehicle={vehicle} onClick={handleVehicleClick} />
              </div>
            ))}
          </div>
        )}

        {!isLoading && vehicles.length > 0 && (
          <div className="reveal-up text-center pt-4 pb-2 space-y-3">
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/50 text-xs disabled:opacity-20 hover:border-gold/30 hover:text-gold transition-all duration-300">Previous</button>
                <span className="text-xs text-white/40 tabular-nums">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/50 text-xs disabled:opacity-20 hover:border-gold/30 hover:text-gold transition-all duration-300">Next</button>
              </div>
            )}
            <p className="text-[10px] tracking-[0.2em] uppercase text-white/20">
              {totalCount} vehicle{totalCount !== 1 ? "s" : ""} in registry
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
