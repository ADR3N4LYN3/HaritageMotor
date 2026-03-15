"use client";

import { useState, useReducer, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { TagInput } from "@/components/ui/TagInput";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { useBays } from "@/hooks/useBay";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { vehicleFormI18n } from "@/lib/translations";
import { useAppStore } from "@/store/app.store";
import { MAKE_NAMES, getModelsForMake, getYearOptions } from "@/lib/vehicle-catalog";

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

const YEAR_OPTIONS = getYearOptions();

export default function NewVehiclePage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const user = useAppStore((s) => s.user);
  const role = user?.role || "viewer";
  const canCreate = role === "admin" || role === "operator";
  const { t } = useI18n(vehicleFormI18n);

  const { bays, isLoading: baysLoading } = useBays();
  const freeBays = bays.filter((b) => b.status === "free");

  const [form, setForm] = useState<FormState>(initialForm);
  const [customMake, setCustomMake] = useState(false);
  const [customModel, setCustomModel] = useState(false);
  const [{ loading, error }, setStatus] = useReducer(
    (s: { loading: boolean; error: string | null }, a: Partial<{ loading: boolean; error: string | null }>) => ({ ...s, ...a }),
    { loading: false, error: null as string | null }
  );

  // Static catalog data
  const models = useMemo(() => getModelsForMake(form.make), [form.make]);

  const makeOptions = useMemo(() => [
    ...MAKE_NAMES.map((m) => ({ value: m, label: m })),
    { value: "__custom__", label: t.other },
  ], [t.other]);

  const modelOptions = useMemo(() => [
    ...models.map((m) => ({ value: m, label: m })),
    { value: "__custom__", label: t.other },
  ], [models, t.other]);

  if (!canCreate) {
    return (
      <AppShell>
        <div className="text-center py-12 text-white/50">{t.accessDenied}</div>
      </AppShell>
    );
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleMakeChange(value: string) {
    if (value === "__custom__") {
      setCustomMake(true);
      setCustomModel(true);
      setForm((prev) => ({ ...prev, make: "", model: "", year: "" }));
    } else {
      setCustomMake(false);
      setCustomModel(false);
      setForm((prev) => ({ ...prev, make: value, model: "", year: "" }));
    }
  }

  function handleModelChange(value: string) {
    if (value === "__custom__") {
      setCustomModel(true);
      setForm((prev) => ({ ...prev, model: "", year: "" }));
    } else {
      setCustomModel(false);
      setForm((prev) => ({ ...prev, model: value, year: "" }));
    }
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
      mutate((key: unknown) => typeof key === "string" && key.startsWith("/vehicles"));
      router.push(`/vehicle/${vehicle.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 402) {
          setStatus({ error: t.planLimit });
        } else {
          setStatus({ error: err.message });
        }
      } else {
        setStatus({ error: t.networkError });
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
        <PageHeader title={t.newVehicle} backHref="/dashboard" />

        {/* Vehicle section */}
        <div>
          <h2 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            {t.vehicle}
          </h2>
          <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] space-y-3">
            {/* Make */}
            {customMake ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t.makePlaceholder}
                  value={form.make}
                  onChange={(e) => updateField("make", e.target.value)}
                  className={inputClass}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setCustomMake(false); setCustomModel(false); setForm((p) => ({ ...p, make: "", model: "", year: "" })); }}
                  className="shrink-0 px-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/40 text-xs hover:text-gold hover:border-gold/30 transition-colors"
                >
                  {t.list}
                </button>
              </div>
            ) : (
              <CustomSelect
                value={form.make}
                onChange={handleMakeChange}
                options={makeOptions}
                placeholder={t.makePlaceholder}
                searchable
                searchPlaceholder={t.searchMake}
              />
            )}

            {/* Model */}
            {customMake || customModel ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t.modelPlaceholder}
                  value={form.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  className={inputClass}
                />
                {!customMake && form.make && (
                  <button
                    type="button"
                    onClick={() => { setCustomModel(false); setForm((p) => ({ ...p, model: "", year: "" })); }}
                    className="shrink-0 px-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/40 text-xs hover:text-gold hover:border-gold/30 transition-colors"
                  >
                    {t.list}
                  </button>
                )}
              </div>
            ) : form.make ? (
              <CustomSelect
                value={form.model}
                onChange={handleModelChange}
                options={modelOptions}
                placeholder={t.modelPlaceholder}
                searchable
                searchPlaceholder={t.searchModel}
              />
            ) : (
              <CustomSelect
                value=""
                onChange={() => {}}
                options={[]}
                placeholder={t.modelPlaceholder}
              />
            )}

            {/* Year + Color */}
            <div className="grid grid-cols-2 gap-3">
              <CustomSelect
                value={form.year}
                onChange={(v) => updateField("year", v)}
                options={YEAR_OPTIONS}
                placeholder={t.yearPlaceholder}
                searchable
                searchPlaceholder={t.searchYear}
              />
              <input
                type="text"
                placeholder={t.colorPlaceholder}
                value={form.color}
                onChange={(e) => updateField("color", e.target.value)}
                className={inputClass}
              />
            </div>

            <input
              type="text"
              placeholder={t.licensePlate}
              value={form.license_plate}
              onChange={(e) => updateField("license_plate", e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder={t.vinPlaceholder}
              value={form.vin}
              onChange={(e) => updateField("vin", e.target.value)}
              className={inputClass}
            />

            {/* Tags */}
            <TagInput tags={form.tags} onChange={setTags} />

            {/* Bay assignment */}
            <div>
              <p className="text-xs text-white/30 mb-2">{t.assignBay}</p>
              <CustomSelect
                value={form.bay_id}
                onChange={(v) => updateField("bay_id", v)}
                placeholder={t.noBay}
                options={[
                  { value: "", label: t.noBay },
                  ...(baysLoading
                    ? [{ value: "__loading", label: t.loading }]
                    : freeBays.map((bay) => ({
                        value: bay.id,
                        label: bay.code,
                        sub: bay.zone ?? undefined,
                      }))),
                ]}
              />
            </div>

            <textarea
              placeholder={t.notes}
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
            {t.owner}
          </h2>
          <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] space-y-3">
            <input
              type="text"
              placeholder={t.ownerName}
              value={form.owner_name}
              onChange={(e) => updateField("owner_name", e.target.value)}
              className={inputClass}
            />
            <input
              type="email"
              placeholder={t.email}
              value={form.owner_email}
              onChange={(e) => updateField("owner_email", e.target.value)}
              className={inputClass}
            />
            <input
              type="tel"
              placeholder={t.phone}
              value={form.owner_phone}
              onChange={(e) => updateField("owner_phone", e.target.value)}
              className={inputClass}
            />
            <textarea
              placeholder={t.ownerNotes}
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
            {t.createVehicle}
          </ActionButton>
        </div>
      </div>
    </AppShell>
  );
}
