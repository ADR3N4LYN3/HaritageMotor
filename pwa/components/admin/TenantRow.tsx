"use client";

import { useReducer, useState } from "react";
import { mutate } from "swr";
import useSWR from "swr";
import { api, ApiError } from "@/lib/api";
import { AdminSelect, inputClass, labelClass } from "./AdminSelect";
import type { TenantWithStats, PaginatedResponse } from "@/lib/types";

interface TenantUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  last_login_at: string | null;
}

interface TenantVehicle {
  id: string;
  make: string;
  model: string;
  year: number | null;
  status: string;
  owner_name: string;
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-right">
      <p className="text-sm font-sans font-normal text-white/50 tabular-nums">{value}</p>
      <p className="text-[10px] text-white/15 tracking-[0.12em] uppercase">{label}</p>
    </div>
  );
}

type SubTab = "edit" | "users" | "vehicles";

export function TenantRow({
  tenant: t,
  isEditing,
  onToggleEdit,
}: {
  tenant: TenantWithStats;
  isEditing: boolean;
  onToggleEdit: () => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>("edit");
  const [{ name, plan, status }, setForm] = useReducer(
    (s: { name: string; plan: string; status: string }, a: Partial<{ name: string; plan: string; status: string }>) => ({ ...s, ...a }),
    { name: t.name, plan: t.plan, status: t.status }
  );
  const [{ saving, deleting, confirmDelete, error }, setUi] = useReducer(
    (s: { saving: boolean; deleting: boolean; confirmDelete: boolean; error: string | null }, a: Partial<{ saving: boolean; deleting: boolean; confirmDelete: boolean; error: string | null }>) => ({ ...s, ...a }),
    { saving: false, deleting: false, confirmDelete: false, error: null as string | null }
  );

  const { data: usersData } = useSWR<PaginatedResponse<TenantUser>>(
    isEditing && subTab === "users" ? `/admin/tenants/${t.id}/users?per_page=50` : null
  );
  const { data: vehiclesData } = useSWR<PaginatedResponse<TenantVehicle>>(
    isEditing && subTab === "vehicles" ? `/admin/tenants/${t.id}/vehicles?per_page=50` : null
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

  const roleColors: Record<string, string> = {
    admin: "bg-gold/15 text-gold",
    operator: "bg-info/10 text-info",
    technician: "bg-warning/10 text-warning",
    viewer: "bg-white/[0.06] text-white/40",
  };

  const statusColors: Record<string, string> = {
    stored: "bg-success/10 text-success",
    out: "bg-white/10 text-white/50",
    maintenance: "bg-warning/10 text-warning",
    transit: "bg-info/10 text-info",
  };

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
          {/* Sub-tabs */}
          <div className="flex gap-0 border-b border-white/[0.06] mb-4">
            {(["edit", "users", "vehicles"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSubTab(tab)}
                className={`px-4 py-2.5 text-[10px] tracking-[0.12em] uppercase font-medium border-b-2 transition-all duration-300 ${
                  subTab === tab
                    ? "text-gold border-b-gold"
                    : "text-white/25 border-b-transparent hover:text-white/40"
                }`}
              >
                {tab === "edit" ? "Settings" : tab === "users" ? `Users (${t.user_count})` : `Vehicles (${t.vehicle_count})`}
              </button>
            ))}
          </div>

          {subTab === "edit" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <AdminSelect id={`plan-${t.id}`} value={plan} onChange={(v) => setForm({ plan: v })} options={[
                    { value: "starter", label: "Starter" },
                    { value: "pro", label: "Pro" },
                    { value: "enterprise", label: "Enterprise" },
                  ]} />
                </div>
                <div>
                  <label htmlFor={`status-${t.id}`} className={labelClass}>Status</label>
                  <AdminSelect id={`status-${t.id}`} value={status} onChange={(v) => setForm({ status: v })} options={[
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
            </>
          )}

          {subTab === "users" && (
            <div className="space-y-1">
              {!usersData ? (
                <div className="py-8 text-center">
                  <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto" />
                </div>
              ) : usersData.data.length === 0 ? (
                <p className="text-white/20 text-xs text-center py-8 tracking-wider uppercase">No users</p>
              ) : (
                <div className="rounded-xl overflow-hidden border border-white/[0.06]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {["Name", "Email", "Role", "Last login"].map((h) => (
                          <th key={h} className="text-[9px] tracking-[0.15em] uppercase text-gold/30 font-medium text-left px-3 py-2 border-b border-white/[0.06]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {usersData.data.map((u) => (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2.5 border-b border-white/[0.03] text-[12px] text-white/80 font-normal">{u.first_name} {u.last_name}</td>
                          <td className="px-3 py-2.5 border-b border-white/[0.03] text-[12px] text-white/50 font-light">{u.email}</td>
                          <td className="px-3 py-2.5 border-b border-white/[0.03]">
                            <span className={`text-[9px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-full ${roleColors[u.role] || "bg-white/[0.06] text-white/40"}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 border-b border-white/[0.03] text-[12px] text-white/30 font-light">
                            {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {subTab === "vehicles" && (
            <div className="space-y-1">
              {!vehiclesData ? (
                <div className="py-8 text-center">
                  <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto" />
                </div>
              ) : vehiclesData.data.length === 0 ? (
                <p className="text-white/20 text-xs text-center py-8 tracking-wider uppercase">No vehicles in storage</p>
              ) : (
                <div className="rounded-xl overflow-hidden border border-white/[0.06]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {["Vehicle", "Owner", "Status", "Year"].map((h) => (
                          <th key={h} className="text-[9px] tracking-[0.15em] uppercase text-gold/30 font-medium text-left px-3 py-2 border-b border-white/[0.06]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vehiclesData.data.map((v) => (
                        <tr key={v.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2.5 border-b border-white/[0.03] text-[12px] text-white/80 font-normal">{v.make} {v.model}</td>
                          <td className="px-3 py-2.5 border-b border-white/[0.03] text-[12px] text-white/50 font-light">{v.owner_name}</td>
                          <td className="px-3 py-2.5 border-b border-white/[0.03]">
                            <span className={`text-[9px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-full ${statusColors[v.status] || "bg-white/[0.06] text-white/40"}`}>
                              {v.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 border-b border-white/[0.03] text-[12px] text-white/40 font-light">{v.year || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
