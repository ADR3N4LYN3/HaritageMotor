"use client";

import { useState, useEffect, useReducer } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useVehicle } from "@/hooks/useVehicle";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { vehicleFormI18n } from "@/lib/translations";
import { TagInput } from "@/components/ui/TagInput";
import { useAppStore } from "@/store/app.store";

export default function EditVehiclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const user = useAppStore((s) => s.user);
  const canEdit = user?.role === "admin" || user?.role === "operator";
  const { t } = useI18n(vehicleFormI18n);

  const { vehicle, isLoading } = useVehicle(id);

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [vin, setVin] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerNotes, setOwnerNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [{ loading, error }, setStatus] = useReducer(
    (s: { loading: boolean; error: string | null }, a: Partial<{ loading: boolean; error: string | null }>) => ({ ...s, ...a }),
    { loading: false, error: null as string | null }
  );

  // Initialize form with vehicle data
  useEffect(() => {
    if (vehicle && !initialized) {
      setMake(vehicle.make);
      setModel(vehicle.model);
      setYear(vehicle.year?.toString() || "");
      setColor(vehicle.color || "");
      setLicensePlate(vehicle.license_plate || "");
      setVin(vehicle.vin || "");
      setOwnerName(vehicle.owner_name);
      setOwnerEmail(vehicle.owner_email || "");
      setOwnerPhone(vehicle.owner_phone || "");
      setOwnerNotes(vehicle.owner_notes || "");
      setNotes(vehicle.notes || "");
      setTags(vehicle.tags || []);
      setInitialized(true);
    }
  }, [vehicle, initialized]);

  if (!canEdit) {
    return (
      <AppShell>
        <div className="text-center py-12 text-white/50">{t.accessDenied}</div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <VehicleCardSkeleton />
      </AppShell>
    );
  }

  if (!vehicle) {
    return (
      <AppShell>
        <div className="text-center py-12 text-white/50">{t.vehicleNotFound}</div>
      </AppShell>
    );
  }

  function updateTags(newTags: string[]) {
    setTags(newTags);
  }

  async function handleSave() {
    if (!make.trim() || !model.trim() || !ownerName.trim()) return;
    setStatus({ loading: true, error: null });

    const body: Record<string, unknown> = {
      make: make.trim(),
      model: model.trim(),
      owner_name: ownerName.trim(),
      tags,
    };
    if (color.trim()) body.color = color.trim();
    if (licensePlate.trim()) body.license_plate = licensePlate.trim();
    if (vin.trim()) body.vin = vin.trim();
    if (ownerEmail.trim()) body.owner_email = ownerEmail.trim();
    if (ownerPhone.trim()) body.owner_phone = ownerPhone.trim();
    if (ownerNotes.trim()) body.owner_notes = ownerNotes.trim();
    if (notes.trim()) body.notes = notes.trim();
    if (year) body.year = parseInt(year, 10);

    try {
      await api.patch(`/vehicles/${id}`, body);
      router.push(`/vehicle/${id}`);
    } catch (err: unknown) {
      setStatus({
        error: err instanceof ApiError ? err.message : t.networkError,
      });
    } finally {
      setStatus({ loading: false });
    }
  }

  const inputClass =
    "w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm font-light tracking-wide transition-colors";

  const isValid = make.trim() !== "" && model.trim() !== "" && ownerName.trim() !== "";

  return (
    <AppShell>
      <div className="space-y-6 pb-6">
        <PageHeader
          title={t.editVehicle}
          subtitle={vehicle ? `${vehicle.make} ${vehicle.model}` : undefined}
          backHref={`/vehicle/${id}`}
        />

        {/* Status + bay (read-only) */}
        <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30">{t.status}</span>
              <span className="text-sm text-white">{vehicle.status}</span>
            </div>
            {vehicle.current_bay_id && (
              <button
                onClick={() => router.push(`/vehicle/${id}/move`)}
                className="text-xs text-gold hover:text-gold/80 transition-colors"
              >
                {t.moveVehicle} &rarr;
              </button>
            )}
          </div>
        </div>

        {/* Vehicle section */}
        <div>
          <h2 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            {t.vehicle}
          </h2>
          <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] space-y-3">
            <input
              type="text"
              placeholder={t.makePlaceholder}
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder={t.modelPlaceholder}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder={t.yearPlaceholder}
                min={1900}
                max={2030}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder={t.colorPlaceholder}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className={inputClass}
              />
            </div>
            <input
              type="text"
              placeholder={t.licensePlate}
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder={t.vinPlaceholder}
              value={vin}
              onChange={(e) => setVin(e.target.value)}
              className={inputClass}
            />

            {/* Tags */}
            <TagInput tags={tags} onChange={updateTags} />

            <textarea
              placeholder={t.notes}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className={inputClass}
            />
            <input
              type="email"
              placeholder={t.email}
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className={inputClass}
            />
            <input
              type="tel"
              placeholder={t.phone}
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              className={inputClass}
            />
            <textarea
              placeholder={t.ownerNotes}
              value={ownerNotes}
              onChange={(e) => setOwnerNotes(e.target.value)}
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {error && <p className="text-danger text-sm text-center">{error}</p>}

        <div className="pb-4">
          <ActionButton onClick={handleSave} loading={loading} disabled={!isValid}>
            {t.saveChanges}
          </ActionButton>
        </div>
      </div>
    </AppShell>
  );
}
