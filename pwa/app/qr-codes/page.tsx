"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app.store";
import useSWR from "swr";
import { useI18n } from "@/lib/i18n";
import { qrCodesI18n } from "@/lib/translations";

interface BayQR {
  id: string;
  code: string;
  zone?: string;
  status: string;
  qr_token?: string;
  qr_url: string;
}

interface VehicleQR {
  id: string;
  make: string;
  model: string;
  year?: number;
  owner_name: string;
  qr_token?: string;
  qr_url: string;
}

export default function QRCodesPage() {
  const user = useAppStore((s) => s.user);
  const { t: qrT } = useI18n(qrCodesI18n);
  const [tab, setTab] = useState<"bays" | "vehicles">("bays");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: baysData, isLoading: baysLoading } = useSWR<{ bays: BayQR[] }>("/bays/qr-sheet");
  const { data: vehiclesData, isLoading: vehiclesLoading } = useSWR<{ vehicles: VehicleQR[] }>("/vehicles/qr-sheet");

  if (user?.role !== "admin" && user?.role !== "operator") {
    return (
      <AppShell>
        <div className="text-center py-12 text-white/50">{qrT.accessRestricted}</div>
      </AppShell>
    );
  }

  const bays = baysData?.bays || [];
  const vehicles = vehiclesData?.vehicles || [];
  const isLoading = tab === "bays" ? baysLoading : vehiclesLoading;
  const currentItems = tab === "bays" ? bays : vehicles;
  const hasSelection = selected.size > 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const allIds = currentItems.map((item) => item.id);
    const allSelected = allIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const handleTabChange = (t: "bays" | "vehicles") => {
    setTab(t);
    setSelected(new Set());
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={qrT.title}
          backHref="/dashboard"
          action={
            <button
              onClick={() => window.print()}
              disabled={!hasSelection}
              className="px-4 py-2 rounded-lg border border-gold/30 text-gold text-xs tracking-wider uppercase hover:bg-gold hover:text-black transition-all duration-500 print:hidden disabled:opacity-30 disabled:pointer-events-none"
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            >
              {qrT.print}{hasSelection ? ` (${selected.size})` : ""}
            </button>
          }
        />

        {/* Tab toggle + select all */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex gap-2">
            {(["bays", "vehicles"] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  tab === t
                    ? "bg-gold/15 text-gold border-gold/30"
                    : "bg-white/[0.04] text-white/50 border-white/[0.06]"
                }`}
              >
                {t === "bays" ? qrT.bays : qrT.vehicles}
              </button>
            ))}
          </div>
          {!isLoading && currentItems.length > 0 && (
            <button
              onClick={selectAll}
              className="text-xs text-white/40 hover:text-gold transition-colors"
            >
              {currentItems.every((item) => selected.has(item.id)) ? qrT.deselectAll : qrT.selectAll}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="skeleton h-52 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Screen view */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 print:hidden">
              {tab === "bays"
                ? bays.map((bay) => (
                    <QRCard
                      key={bay.id}
                      id={bay.id}
                      qrUrl={bay.qr_url}
                      label={bay.code}
                      sub={bay.zone}
                      isSelected={selected.has(bay.id)}
                      onToggle={toggleSelect}
                      noQrTokenLabel={qrT.noQrToken}
                    />
                  ))
                : vehicles.map((v) => (
                    <QRCard
                      key={v.id}
                      id={v.id}
                      qrUrl={v.qr_url}
                      label={`${v.make} ${v.model}`}
                      sub={v.year ? String(v.year) : undefined}
                      isSelected={selected.has(v.id)}
                      onToggle={toggleSelect}
                      noQrTokenLabel={qrT.noQrToken}
                    />
                  ))}
            </div>

            {/* Print view — only selected items */}
            <div className="hidden print:block">
              <h2 className="text-xl font-bold mb-4 text-black">
                Heritage Motor — {tab === "bays" ? qrT.bayQrCodes : qrT.vehicleQrCodes}
              </h2>
              <div className="qr-print-grid">
                {tab === "bays"
                  ? bays
                      .filter((bay) => selected.has(bay.id))
                      .map((bay) => (
                        <div key={bay.id} className="qr-print-card">
                          {bay.qr_url && <QRCodeSVG value={bay.qr_url} size={150} />}
                          <p className="qr-print-label">{bay.code}</p>
                          {bay.zone && <p className="qr-print-sub">{bay.zone}</p>}
                        </div>
                      ))
                  : vehicles
                      .filter((v) => selected.has(v.id))
                      .map((v) => (
                        <div key={v.id} className="qr-print-card">
                          {v.qr_url && <QRCodeSVG value={v.qr_url} size={150} />}
                          <p className="qr-print-label">
                            {v.make} {v.model}
                          </p>
                          {v.year && <p className="qr-print-sub">{v.year}</p>}
                        </div>
                      ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

/* ── QR Card with selection ── */

function QRCard({
  id,
  qrUrl,
  label,
  sub,
  isSelected,
  onToggle,
  noQrTokenLabel = "No QR token",
}: {
  id: string;
  qrUrl: string;
  label: string;
  sub?: string;
  isSelected: boolean;
  onToggle: (id: string) => void;
  noQrTokenLabel?: string;
}) {
  return (
    <button
      onClick={() => onToggle(id)}
      className={`relative bg-white/[0.03] rounded-2xl p-4 border flex flex-col items-center gap-3 transition-all duration-300 text-left ${
        isSelected
          ? "border-gold/40 ring-1 ring-gold/20"
          : "border-white/[0.06] hover:border-white/[0.12]"
      }`}
      style={{ transitionTimingFunction: "var(--ease-lux)" }}
    >
      {/* Checkbox indicator */}
      <div
        className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300 ${
          isSelected
            ? "bg-gold border-gold text-black"
            : "border-white/20 bg-transparent"
        }`}
      >
        {isSelected && (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {qrUrl ? (
        <div className="bg-white rounded-xl p-2">
          <QRCodeSVG value={qrUrl} size={120} />
        </div>
      ) : (
        <div className="w-[136px] h-[136px] bg-white/[0.04] rounded-xl flex items-center justify-center text-white/30 text-xs">
          {noQrTokenLabel}
        </div>
      )}
      <div className="text-center">
        <p className="text-white font-medium text-sm">{label}</p>
        {sub && <p className="text-white/40 text-xs">{sub}</p>}
      </div>
    </button>
  );
}
