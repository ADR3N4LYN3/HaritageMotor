"use client";

import { useState, useReducer } from "react";
import { mutate } from "swr";
import { api, ApiError } from "@/lib/api";
import { AdminSelect, inputClass, labelClass } from "./AdminSelect";

export function CreateTenantForm({ onDone }: { onDone: () => void }) {
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
          <AdminSelect id="create-plan" value={plan} onChange={(v) => setForm({ plan: v })} options={[
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
          <AdminSelect id="create-timezone" value={timezone} onChange={(v) => setForm({ timezone: v })} options={[
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
