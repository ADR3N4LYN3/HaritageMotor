"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { api, ApiError } from "@/lib/api";
import { useAppStore } from "@/store/app.store";
import { logout } from "@/lib/auth";
import type {
  DashboardStats,
  TenantWithStats,
  PaginatedResponse,
} from "@/lib/types";

export default function AdminPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "superadmin") {
      router.replace("/scan");
    } else {
      setAuthorized(true);
    }
  }, [user, router]);

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-[#080704]">
      {/* Subtle cross-hatch texture */}
      <div className="fixed inset-0 opacity-[0.012] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23b8955a' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <Header />
      <main className="relative max-w-6xl mx-auto px-6 lg:px-8 py-12 space-y-16">
        <StatsSection />
        <TenantsSection />
        <InviteSection />
      </main>
    </div>
  );
}

/* ─── Gold separator ─── */
function GoldRule() {
  return (
    <div className="h-px bg-gradient-to-r from-gold/25 via-gold/10 to-transparent" />
  );
}

/* ─── Section heading ─── */
function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-display font-semibold text-white/90 tracking-wide">
          {title}
        </h2>
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
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#080704]/80 border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold/80 to-gold/40 flex items-center justify-center">
            <span className="text-[#080704] font-display font-bold text-sm">H</span>
          </div>
          <div>
            <h1 className="text-sm font-display font-semibold text-white/90 tracking-wider uppercase">
              Heritage Motor
            </h1>
            <p className="text-white/30 text-[10px] tracking-[0.2em] uppercase">
              Platform Administration
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {user && (
            <span className="text-white/30 text-xs">
              {user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-white/40 text-xs tracking-wider uppercase hover:text-gold transition-colors duration-300"
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

  const stats = [
    { label: "Tenants", value: data?.total_tenants ?? "-", sub: "registered" },
    { label: "Active", value: data?.active_tenants ?? "-", sub: "operational" },
    { label: "Users", value: data?.total_users ?? "-", sub: "across tenants" },
    { label: "Vehicles", value: data?.total_vehicles ?? "-", sub: "in custody" },
  ];

  return (
    <section>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-[#0c0b08] p-6 lg:p-8 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-gold/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <p className="text-3xl lg:text-4xl font-display font-semibold text-white/90 tabular-nums">
                {s.value}
              </p>
              <p className="text-[11px] tracking-[0.15em] uppercase text-gold/70 mt-2 font-medium">
                {s.label}
              </p>
              <p className="text-white/20 text-[10px] mt-0.5">
                {s.sub}
              </p>
            </div>
          </div>
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

  return (
    <section className="space-y-6">
      <SectionHeading
        title="Tenants"
        action={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-lg bg-gold/[0.08] text-gold/80 border border-gold/[0.12] hover:bg-gold/[0.15] hover:text-gold hover:border-gold/25 transition-all duration-300"
          >
            {showCreate ? "Cancel" : "New Tenant"}
          </button>
        }
      />

      {showCreate && <CreateTenantForm onDone={() => setShowCreate(false)} />}

      <div className="space-y-px rounded-xl overflow-hidden border border-white/[0.06]">
        {data?.data?.length === 0 && (
          <div className="bg-[#0c0b08] py-16 text-center">
            <p className="text-white/20 text-sm font-display italic">
              No tenants yet
            </p>
            <p className="text-white/10 text-xs mt-1">
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
  const [name, setName] = useState(t.name);
  const [plan, setPlan] = useState(t.plan);
  const [status, setStatus] = useState(t.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
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
      setError(err instanceof ApiError ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/admin/tenants/${t.id}`);
      mutate("/admin/tenants");
      mutate("/admin/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  return (
    <div className="bg-[#0c0b08] group hover:bg-[#0e0d0a] transition-colors duration-300">
      <div
        className="p-5 flex items-center justify-between cursor-pointer"
        onClick={onToggleEdit}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gold/[0.08] border border-gold/[0.12] flex items-center justify-center shrink-0">
            <span className="text-gold/60 font-display text-sm font-semibold">
              {t.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-sm text-white/80 group-hover:text-white/95 transition-colors">
              {t.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white/25 text-xs font-mono">{t.slug}</span>
              <span className="text-white/10">|</span>
              <span className="text-white/30 text-xs capitalize">{t.plan}</span>
              <span className="text-white/10">|</span>
              <span className={`text-xs ${
                t.status === "active" ? "text-emerald-400/70" : "text-amber-400/70"
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
            className={`w-4 h-4 text-white/20 transition-transform duration-200 ${isEditing ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isEditing && (
        <div className="px-5 pb-5 pt-1 border-t border-white/[0.04]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className={labelClass}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Plan</label>
              <Select value={plan} onChange={setPlan} options={[
                { value: "starter", label: "Starter" },
                { value: "pro", label: "Pro" },
                { value: "enterprise", label: "Enterprise" },
              ]} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <Select value={status} onChange={setStatus} options={[
                { value: "active", label: "Active" },
                { value: "trial", label: "Trial" },
                { value: "suspended", label: "Suspended" },
              ]} />
            </div>
          </div>

          {error && <p className="text-red-400/80 text-xs mt-3">{error}</p>}

          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-gold text-[#080704] text-xs font-semibold tracking-wider uppercase hover:bg-gold/90 disabled:opacity-40 transition-all duration-300"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={onToggleEdit}
                className="text-white/30 text-xs tracking-wider uppercase hover:text-white/50 transition-colors"
              >
                Cancel
              </button>
            </div>

            {!confirmDelete ? (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                className="text-red-400/40 text-xs tracking-wider uppercase hover:text-red-400/70 transition-colors"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-red-400/60 text-xs">Confirm?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold tracking-wider uppercase border border-red-500/20 hover:bg-red-500/30 disabled:opacity-40 transition-all"
                >
                  {deleting ? "Deleting..." : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-white/30 text-xs tracking-wider uppercase hover:text-white/50 transition-colors"
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
      <p className="text-sm font-display text-white/60 tabular-nums">{value}</p>
      <p className="text-[10px] text-white/20 tracking-wider uppercase">{label}</p>
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/90 text-sm placeholder:text-white/20 focus:outline-none focus:border-gold/30 focus:bg-white/[0.05] transition-all duration-200";

const labelClass = "block text-[10px] tracking-[0.15em] uppercase text-white/30 mb-1.5";

type SelectOption = { value: string; label: string };

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
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
        type="button"
        onClick={() => setOpen(!open)}
        className={`${inputClass} text-left flex items-center justify-between`}
      >
        <span className={selected ? "text-white/90" : "text-white/20"}>
          {selected?.label ?? placeholder ?? "Select..."}
        </span>
        <svg
          className={`w-4 h-4 text-white/20 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0e0d0a] shadow-xl shadow-black/40 overflow-hidden">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 ${
                o.value === value
                  ? "bg-gold/[0.1] text-gold"
                  : "text-white/70 hover:bg-white/[0.04] hover:text-white/90"
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
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [country, setCountry] = useState("FR");
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [plan, setPlan] = useState("starter");
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
      className="bg-[#0c0b08] border border-white/[0.06] rounded-xl p-6 space-y-5"
    >
      <p className="text-[10px] tracking-[0.15em] uppercase text-gold/50 font-medium">
        New Tenant
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Facility name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")
              );
            }}
            placeholder="e.g. Monte Carlo Motors"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="monte-carlo-motors"
            required
            pattern="[a-z0-9-]+"
            className={`${inputClass} font-mono`}
          />
        </div>
        <div>
          <label className={labelClass}>Plan</label>
          <Select value={plan} onChange={setPlan} options={[
            { value: "starter", label: "Starter — 25 vehicles, 5 users, 20 bays" },
            { value: "pro", label: "Pro — 100 vehicles, 20 users, 100 bays" },
            { value: "enterprise", label: "Enterprise — unlimited" },
          ]} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Country</label>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            placeholder="FR"
            required
            pattern="[A-Z]{2}"
            maxLength={2}
            className={`${inputClass} font-mono uppercase tracking-widest`}
          />
        </div>
        <div>
          <label className={labelClass}>Timezone</label>
          <Select value={timezone} onChange={setTimezone} options={[
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
      {error && <p className="text-red-400/80 text-xs">{error}</p>}
      <div className="flex items-center gap-4 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-lg bg-gold text-[#080704] text-xs font-semibold tracking-wider uppercase hover:bg-gold/90 disabled:opacity-40 transition-all duration-300"
        >
          {loading ? "Creating..." : "Create Tenant"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-white/30 text-xs tracking-wider uppercase hover:text-white/50 transition-colors"
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
  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setEmail("");
      setFirstName("");
      setLastName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <SectionHeading title="Invite User" />

      <form
        onSubmit={handleSubmit}
        className="bg-[#0c0b08] border border-white/[0.06] rounded-xl p-6 space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tenant</label>
            <Select
              value={tenantId}
              onChange={setTenantId}
              placeholder="Select tenant..."
              options={tenants?.data?.map((t) => ({ value: t.id, label: t.name })) ?? []}
            />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <Select value={role} onChange={setRole} options={[
              { value: "admin", label: "Admin" },
              { value: "operator", label: "Operator" },
              { value: "technician", label: "Technician" },
              { value: "viewer", label: "Viewer" },
            ]} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>First name</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Last name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              required
              className={inputClass}
            />
          </div>
        </div>

        {error && <p className="text-red-400/80 text-xs">{error}</p>}
        {result && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-emerald-400/80 text-xs">{result}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !tenantId}
          className="px-6 py-2.5 rounded-lg bg-gold text-[#080704] text-xs font-semibold tracking-wider uppercase hover:bg-gold/90 disabled:opacity-40 transition-all duration-300"
        >
          {loading ? "Sending..." : "Send Invitation"}
        </button>
      </form>
    </section>
  );
}
