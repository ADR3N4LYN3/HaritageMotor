"use client";

import { useState, useReducer } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { api, ApiError } from "@/lib/api";
import { useAppStore } from "@/store/app.store";
import { useI18n } from "@/lib/i18n";
import { bayFormI18n } from "@/lib/translations";

const FEATURE_OPTIONS = [
  "climate_controlled",
  "covered",
  "lift",
  "security_camera",
  "charging_station",
];

export default function NewBayPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const { t } = useI18n(bayFormI18n);
  const canCreate = user?.role === "admin" || user?.role === "operator";

  const [code, setCode] = useState("");
  const [zone, setZone] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [{ loading, error }, setStatus] = useReducer(
    (s: { loading: boolean; error: string | null }, a: Partial<{ loading: boolean; error: string | null }>) => ({ ...s, ...a }),
    { loading: false, error: null as string | null }
  );

  if (!canCreate) {
    return (
      <AppShell>
        <div className="text-center py-12 text-white/50">{t.accessDenied}</div>
      </AppShell>
    );
  }

  function toggleFeature(f: string) {
    setFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }

  async function handleSubmit() {
    if (!code.trim()) return;
    setStatus({ loading: true, error: null });

    const body: Record<string, unknown> = { code: code.trim() };
    if (zone.trim()) body.zone = zone.trim();
    if (description.trim()) body.description = description.trim();
    if (features.length > 0) body.features = features;

    try {
      const bay = await api.post<{ id: string }>("/bays", body);
      router.push(`/bay/${bay.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setStatus({ error: t.codeExists });
        } else if (err.status === 402) {
          setStatus({ error: t.bayLimitReached });
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
        <PageHeader title={t.newBay} backHref="/bays" />

        <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] space-y-3">
          <input
            type="text"
            placeholder={t.codePlaceholder}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder={t.zonePlaceholder}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className={inputClass}
          />
          <textarea
            placeholder={t.description}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
          />

          {/* Features */}
          <div>
            <p className="text-xs text-white/30 mb-2">{t.features}</p>
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

        <div className="pb-4">
          <ActionButton
            onClick={handleSubmit}
            loading={loading}
            disabled={!code.trim()}
          >
            {t.createBay}
          </ActionButton>
        </div>
      </div>
    </AppShell>
  );
}
