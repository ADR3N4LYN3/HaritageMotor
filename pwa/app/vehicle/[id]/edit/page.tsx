"use client";

import { useState, useEffect, useReducer } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { VehicleCardSkeleton } from "@/components/ui/Skeleton";
import { useVehicle } from "@/hooks/useVehicle";
import { api, ApiError } from "@/lib/api";
import { TagInput } from "@/components/ui/TagInput";
import { useAppStore } from "@/store/app.store";

export default function EditVehiclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const user = useAppStore((s) => s.user);
  const canEdit = user?.role === "admin" || user?.role === "operator";

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
        <div className="text-center py-12 text-white/50">Access denied</div>
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
        <div className="text-center py-12 text-white/50">Vehicle not found</div>
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
      color: color.trim(),
      license_plate: licensePlate.trim(),
      vin: vin.trim(),
      owner_email: ownerEmail.trim(),
      owner_phone: ownerPhone.trim(),
      owner_notes: ownerNotes.trim(),
      notes: notes.trim(),
      tags,
    };
    if (year) body.year = parseInt(year, 10);

    try {
      await api.patch(`/vehicles/${id}`, body);
      router.push(`/vehicle/${id}`);
    } catch (err: unknown) {
      setStatus({
        error: err instanceof ApiError ? err.message : "Network error. Please try again.",
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
          title="Edit Vehicle"
          subtitle={vehicle ? `${vehicle.make} ${vehicle.model}` : undefined}
          backHref={`/vehicle/${id}`}
        />

        {/* Status + bay (read-only) */}
        <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30">Status:</span>
              <span className="text-sm text-white">{vehicle.status}</span>
            </div>
            {vehicle.current_bay_id && (
              <button
                onClick={() => router.push(`/vehicle/${id}/move`)}
                className="text-xs text-gold hover:text-gold/80 transition-colors"
              >
                Move vehicle &rarr;
              </button>
            )}
          </div>
        </div>

        {/* Vehicle section */}
        <div>
          <h2 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            Vehicle
          </h2>
          <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] space-y-3">
            <input
              type="text"
              placeholder="Make *"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Model *"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Year"
                min={1900}
                max={2030}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className={inputClass}
              />
            </div>
            <input
              type="text"
              placeholder="License plate"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="VIN"
              value={vin}
              onChange={(e) => setVin(e.target.value)}
              className={inputClass}
            />

            {/* Tags */}
            <TagInput tags={tags} onChange={updateTags} />

            <textarea
              placeholder="Notes"
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
            Owner
          </h2>
          <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] space-y-3">
            <input
              type="text"
              placeholder="Owner name *"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className={inputClass}
            />
            <input
              type="email"
              placeholder="Email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className={inputClass}
            />
            <input
              type="tel"
              placeholder="Phone"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              className={inputClass}
            />
            <textarea
              placeholder="Owner notes"
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
            Save Changes
          </ActionButton>
        </div>
      </div>
    </AppShell>
  );
}
