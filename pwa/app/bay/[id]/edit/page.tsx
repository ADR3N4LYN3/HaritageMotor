"use client";

import { useState, useEffect, useReducer } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { useBay } from "@/hooks/useBay";
import { api, ApiError } from "@/lib/api";
import { useAppStore } from "@/store/app.store";

const FEATURE_OPTIONS = [
  "climate_controlled",
  "covered",
  "lift",
  "security_camera",
  "charging_station",
];

const STATUS_OPTIONS = ["free", "reserved", "maintenance"];

export default function EditBayPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const user = useAppStore((s) => s.user);
  const canEdit = user?.role === "admin" || user?.role === "operator";

  const { bay, isLoading: bayLoading } = useBay(id);

  const [code, setCode] = useState("");
  const [zone, setZone] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("free");
  const [features, setFeatures] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [{ loading, error }, setFormStatus] = useReducer(
    (s: { loading: boolean; error: string | null }, a: Partial<{ loading: boolean; error: string | null }>) => ({ ...s, ...a }),
    { loading: false, error: null as string | null }
  );

  // Initialize form with bay data
  useEffect(() => {
    if (bay && !initialized) {
      setCode(bay.code);
      setZone(bay.zone || "");
      setDescription(bay.description || "");
      setStatus(bay.status);
      setFeatures(bay.features || []);
      setInitialized(true);
    }
  }, [bay, initialized]);

  if (!canEdit) {
    return (
      <AppShell>
        <div className="text-center py-12 text-white/50">Access denied</div>
      </AppShell>
    );
  }

  if (bayLoading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (!bay) {
    return (
      <AppShell>
        <div className="text-center py-12 text-white/50">Bay not found</div>
      </AppShell>
    );
  }

  function toggleFeature(f: string) {
    setFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }

  async function handleSave() {
    if (!code.trim()) return;
    setFormStatus({ loading: true, error: null });

    const body: Record<string, unknown> = {
      code: code.trim(),
      zone: zone.trim() || null,
      description: description.trim() || null,
      status,
      features,
    };

    try {
      await api.patch(`/bays/${id}`, body);
      router.push(`/bay/${id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setFormStatus({ error: "This code already exists in your facility" });
        } else {
          setFormStatus({ error: err.message });
        }
      } else {
        setFormStatus({ error: "Network error. Please try again." });
      }
    } finally {
      setFormStatus({ loading: false });
    }
  }

  async function handleDelete() {
    if (!bay || bay.status !== "free") return;
    if (!confirm("Delete this bay? This action cannot be undone.")) return;
    setFormStatus({ loading: true, error: null });
    try {
      await api.delete(`/bays/${id}`);
      router.push("/bays");
    } catch (err: unknown) {
      setFormStatus({
        error: err instanceof ApiError ? err.message : "Failed to delete bay",
      });
    } finally {
      setFormStatus({ loading: false });
    }
  }

  const inputClass =
    "w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm font-light tracking-wide transition-colors";

  return (
    <AppShell>
      <div className="space-y-6 pb-6">
        <PageHeader title="Edit Bay" subtitle={bay?.code} backHref={`/bay/${id}`} />

        <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] space-y-3">
          <input
            type="text"
            placeholder="Code *"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Zone"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className={inputClass}
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
          />

          {/* Status */}
          <div>
            <p className="text-xs text-white/30 mb-2">Status</p>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  disabled={bay.status === "occupied"}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    status === s
                      ? "bg-gold/15 text-gold border-gold/30"
                      : "bg-white/[0.04] text-white/50 border-white/[0.06]"
                  } disabled:opacity-30`}
                >
                  {s}
                </button>
              ))}
              {bay.status === "occupied" && (
                <span className="px-3 py-1.5 text-xs text-white/30">
                  (occupied — managed by vehicle move)
                </span>
              )}
            </div>
          </div>

          {/* Features */}
          <div>
            <p className="text-xs text-white/30 mb-2">Features</p>
            <div className="flex flex-wrap gap-2">
              {FEATURE_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFeature(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    features.includes(f)
                      ? "bg-gold/15 text-gold border-gold/30"
                      : "bg-white/[0.04] text-white/50 border-white/[0.06]"
                  }`}
                >
                  {f.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-danger text-sm text-center">{error}</p>}

        <div className="flex gap-3 pb-4">
          {bay.status === "free" && (
            <ActionButton
              variant="danger"
              onClick={handleDelete}
              disabled={loading}
              fullWidth={false}
              className="flex-1"
            >
              Delete
            </ActionButton>
          )}
          <ActionButton
            onClick={handleSave}
            loading={loading}
            disabled={!code.trim()}
            fullWidth={false}
            className="flex-[2]"
          >
            Save Changes
          </ActionButton>
        </div>
      </div>
    </AppShell>
  );
}
