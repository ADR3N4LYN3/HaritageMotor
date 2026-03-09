"use client";

import { useState } from "react";
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

  // Redirect non-superadmin
  if (user && user.role !== "superadmin") {
    router.push("/scan");
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <StatsSection />
        <TenantsSection />
        <InviteSection />
      </main>
    </div>
  );
}

function Header() {
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="border-b border-white/10 px-4 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-gold">
            Heritage Motor
          </h1>
          <p className="text-white/40 text-xs">Platform Administration</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-white/40 text-sm hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

function StatsSection() {
  const { data } = useSWR<DashboardStats>("/admin/dashboard");

  const stats = [
    { label: "Tenants", value: data?.total_tenants ?? "-" },
    { label: "Active", value: data?.active_tenants ?? "-" },
    { label: "Users", value: data?.total_users ?? "-" },
    { label: "Vehicles", value: data?.total_vehicles ?? "-" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-white/5 border border-white/10 rounded-xl p-4 text-center"
        >
          <p className="text-2xl font-bold text-gold">{s.value}</p>
          <p className="text-white/50 text-xs mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function TenantsSection() {
  const { data } = useSWR<PaginatedResponse<TenantWithStats>>(
    "/admin/tenants"
  );
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-semibold text-gold">
          Tenants
        </h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-sm px-4 py-2 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors"
        >
          {showCreate ? "Cancel" : "+ New Tenant"}
        </button>
      </div>

      {showCreate && <CreateTenantForm onDone={() => setShowCreate(false)} />}

      <div className="space-y-2">
        {data?.data?.length === 0 && (
          <p className="text-white/30 text-sm text-center py-8">
            No tenants yet. Create one to get started.
          </p>
        )}
        {data?.data?.map((t) => (
          <div
            key={t.id}
            className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="font-semibold text-sm">{t.name}</p>
              <p className="text-white/40 text-xs">
                {t.slug} &middot; {t.plan} &middot;{" "}
                <span
                  className={
                    t.status === "active" ? "text-success" : "text-warning"
                  }
                >
                  {t.status}
                </span>
              </p>
            </div>
            <div className="flex gap-4 text-xs text-white/50">
              <span>{t.user_count} users</span>
              <span>{t.vehicle_count} vehicles</span>
              <span>{t.bay_count} bays</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateTenantForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("starter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/admin/tenants", { name, slug, plan });
      mutate("/admin/tenants");
      mutate("/admin/dashboard");
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50 text-sm";

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-3"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
          placeholder="Facility name"
          required
          className={inputClass}
        />
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="slug"
          required
          pattern="[a-z0-9-]+"
          className={inputClass}
        />
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className={inputClass}
        >
          <option value="starter">Starter (25v/5u/20b)</option>
          <option value="pro">Pro (100v/20u/100b)</option>
          <option value="enterprise">Enterprise (unlimited)</option>
        </select>
      </div>
      {error && <p className="text-danger text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-[#a07d48] disabled:opacity-40 transition-colors"
      >
        {loading ? "Creating..." : "Create Tenant"}
      </button>
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
      await api.post("/admin/invitations", {
        tenant_id: tenantId,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
      });
      setResult(`Invitation sent to ${email}`);
      setEmail("");
      setFirstName("");
      setLastName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to invite");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50 text-sm";

  return (
    <section>
      <h2 className="text-lg font-display font-semibold text-gold mb-4">
        Invite User
      </h2>
      <form
        onSubmit={handleSubmit}
        className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">Select tenant...</option>
            {tenants?.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputClass}
          >
            <option value="admin">Admin</option>
            <option value="operator">Operator</option>
            <option value="technician">Technician</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            required
            className={inputClass}
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            required
            className={inputClass}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className={inputClass}
          />
        </div>

        {error && <p className="text-danger text-xs">{error}</p>}
        {result && <p className="text-success text-xs">{result}</p>}

        <button
          type="submit"
          disabled={loading || !tenantId}
          className="px-4 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-[#a07d48] disabled:opacity-40 transition-colors"
        >
          {loading ? "Sending..." : "Send Invitation"}
        </button>
      </form>
    </section>
  );
}
