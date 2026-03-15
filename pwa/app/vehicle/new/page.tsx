"use client";

import { useState, useReducer } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { useBays } from "@/hooks/useBay";
import { api, ApiError } from "@/lib/api";
import { TagInput } from "@/components/ui/TagInput";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { useAppStore } from "@/store/app.store";

interface FormState {
  make: string;
  model: string;
  owner_name: string;
  year: string;
  color: string;
  license_plate: string;
  vin: string;
  owner_email: string;
  owner_phone: string;
  owner_notes: string;
  notes: string;
  tags: string[];
  bay_id: string;
}

const initialForm: FormState = {
  make: "",
  model: "",
  owner_name: "",
  year: "",
  color: "",
  license_plate: "",
  vin: "",
  owner_email: "",
  owner_phone: "",
  owner_notes: "",
  notes: "",
  tags: [],
  bay_id: "",
};

export default function NewVehiclePage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const user = useAppStore((s) => s.user);
  const role = user?.role || "viewer";
  const canCreate = role === "admin" || role === "operator";

  const { bays, isLoading: baysLoading } = useBays();
  const freeBays = bays.filter((b) => b.status === "free");

  const [form, setForm] = useState<FormState>(initialForm);
  const [{ loading, error }, setStatus] = useReducer(
    (s: { loading: boolean; error: string | null }, a: Partial<{ loading: boolean; error: string | null }>) => ({ ...s, ...a }),
    { loading: false, error: null as string | null }
  );

  if (!canCreate) {
    return (
      <AppShell>
        <div className="text-center py-12 text-white/50">Access denied</div>
      </AppShell>
    );
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setTags(tags: string[]) {
    setForm((prev) => ({ ...prev, tags }));
  }

  const isValid = form.make.trim() !== "" && form.model.trim() !== "" && form.owner_name.trim() !== "";

  async function handleSubmit() {
    if (!isValid) return;
    setStatus({ loading: true, error: null });

    const body: Record<string, unknown> = {
      make: form.make.trim(),
      model: form.model.trim(),
      owner_name: form.owner_name.trim(),
    };
    if (form.year) body.year = parseInt(form.year, 10);
    if (form.color.trim()) body.color = form.color.trim();
    if (form.license_plate.trim()) body.license_plate = form.license_plate.trim();
    if (form.vin.trim()) body.vin = form.vin.trim();
    if (form.owner_email.trim()) body.owner_email = form.owner_email.trim();
    if (form.owner_phone.trim()) body.owner_phone = form.owner_phone.trim();
    if (form.owner_notes.trim()) body.owner_notes = form.owner_notes.trim();
    if (form.notes.trim()) body.notes = form.notes.trim();
    if (form.tags.length > 0) body.tags = form.tags;
    if (form.bay_id) body.bay_id = form.bay_id;

    try {
      const vehicle = await api.post<{ id: string }>("/vehicles", body);
      // Invalidate vehicles cache so dashboard shows the new vehicle immediately
      mutate((key: unknown) => typeof key === "string" && key.startsWith("/vehicles"));
      router.push(`/vehicle/${vehicle.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 402) {
          setStatus({ error: "Vehicle limit reached for your plan. Please upgrade." });
        } else if (err.status === 422) {
          setStatus({ error: err.message });
        } else {
          setStatus({ error: err.message });
        }
      } else {
        setStatus({ error: "Network error. Please try again." });
      }
    } finally {
      setStatus({ loading: false });
    }
  }

  const inputClass =
    "w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm font-light tracking-wide transition-colors";

  return (
    <AppShell>
      <div className="space-y-6 pb-6">
        <PageHeader title="New Vehicle" backHref="/dashboard" />

        {/* Vehicle section */}
        <div>
          <h2 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            Vehicle
          </h2>
          <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] space-y-3">
            <input
              type="text"
              placeholder="Make *"
              value={form.make}
              onChange={(e) => updateField("make", e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Model *"
              value={form.model}
              onChange={(e) => updateField("model", e.target.value)}
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Year"
                min={1900}
                max={2030}
                value={form.year}
                onChange={(e) => updateField("year", e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Color"
                value={form.color}
                onChange={(e) => updateField("color", e.target.value)}
                className={inputClass}
              />
            </div>
            <input
              type="text"
              placeholder="License plate"
              value={form.license_plate}
              onChange={(e) => updateField("license_plate", e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="VIN"
              value={form.vin}
              onChange={(e) => updateField("vin", e.target.value)}
              className={inputClass}
            />

            {/* Tags */}
            <TagInput tags={form.tags} onChange={setTags} />

            {/* Bay assignment */}
            <div>
              <p className="text-xs text-white/30 mb-2">Assign to bay (optional)</p>
              <CustomSelect
                value={form.bay_id}
                onChange={(v) => updateField("bay_id", v)}
                placeholder="No bay"
                options={[
                  { value: "", label: "No bay" },
                  ...(baysLoading
                    ? [{ value: "__loading", label: "Loading..." }]
                    : freeBays.map((bay) => ({
                        value: bay.id,
                        label: bay.code,
                        sub: bay.zone ?? undefined,
                      }))),
                ]}
              />
            </div>

            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {/* Owner section */}
        <div>
          <h2 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            Owner
          </h2>
          <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] space-y-3">
            <input
              type="text"
              placeholder="Owner name *"
              value={form.owner_name}
              onChange={(e) => updateField("owner_name", e.target.value)}
              className={inputClass}
            />
            <input
              type="email"
              placeholder="Email"
              value={form.owner_email}
              onChange={(e) => updateField("owner_email", e.target.value)}
              className={inputClass}
            />
            <input
              type="tel"
              placeholder="Phone"
              value={form.owner_phone}
              onChange={(e) => updateField("owner_phone", e.target.value)}
              className={inputClass}
            />
            <textarea
              placeholder="Owner notes"
              value={form.owner_notes}
              onChange={(e) => updateField("owner_notes", e.target.value)}
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {error && (
          <p className="text-danger text-sm text-center">{error}</p>
        )}

        <div className="pb-4">
          <ActionButton onClick={handleSubmit} loading={loading} disabled={!isValid}>
            Create Vehicle
          </ActionButton>
        </div>
      </div>
    </AppShell>
  );
}
