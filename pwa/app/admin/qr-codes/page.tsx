"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app.store";
import useSWR from "swr";

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
  const [tab, setTab] = useState<"bays" | "vehicles">("bays");

  const { data: baysData, isLoading: baysLoading } = useSWR<{ bays: BayQR[] }>("/bays/qr-sheet");
  const { data: vehiclesData, isLoading: vehiclesLoading } = useSWR<{ vehicles: VehicleQR[] }>("/vehicles/qr-sheet");

  if (user?.role !== "admin" && user?.role !== "superadmin") {
    return (
      <AppShell>
        <div className="text-center py-12 text-white/50">Access denied</div>
      </AppShell>
    );
  }

  const bays = baysData?.bays || [];
  const vehicles = vehiclesData?.vehicles || [];
  const isLoading = tab === "bays" ? baysLoading : vehiclesLoading;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="QR Codes"
          backHref="/admin"
          action={
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-lg border border-gold/30 text-gold text-xs tracking-wider uppercase hover:bg-gold hover:text-black transition-all duration-500 print:hidden"
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
            >
              Print
            </button>
          }
        />

        {/* Tab toggle */}
        <div className="flex gap-2 print:hidden">
          {(["bays", "vehicles"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                tab === t
                  ? "bg-gold/15 text-gold border-gold/30"
                  : "bg-white/[0.04] text-white/50 border-white/[0.06]"
              }`}
            >
              {t === "bays" ? "Bays" : "Vehicles"}
            </button>
          ))}
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
                    <div
                      key={bay.id}
                      className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] flex flex-col items-center gap-3"
                    >
                      {bay.qr_url ? (
                        <div className="bg-white rounded-xl p-2">
                          <QRCodeSVG value={bay.qr_url} size={120} />
                        </div>
                      ) : (
                        <div className="w-[136px] h-[136px] bg-white/[0.04] rounded-xl flex items-center justify-center text-white/30 text-xs">
                          No QR token
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-white font-medium text-sm">{bay.code}</p>
                        {bay.zone && <p className="text-white/40 text-xs">{bay.zone}</p>}
                      </div>
                    </div>
                  ))
                : vehicles.map((v) => (
                    <div
                      key={v.id}
                      className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] flex flex-col items-center gap-3"
                    >
                      {v.qr_url ? (
                        <div className="bg-white rounded-xl p-2">
                          <QRCodeSVG value={v.qr_url} size={120} />
                        </div>
                      ) : (
                        <div className="w-[136px] h-[136px] bg-white/[0.04] rounded-xl flex items-center justify-center text-white/30 text-xs">
                          No QR token
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-white font-medium text-sm">
                          {v.make} {v.model}
                        </p>
                        {v.year && <p className="text-white/40 text-xs">{v.year}</p>}
                      </div>
                    </div>
                  ))}
            </div>

            {/* Print view */}
            <div className="hidden print:block">
              <h2 className="text-xl font-bold mb-4 text-black">
                Heritage Motor - {tab === "bays" ? "Bay" : "Vehicle"} QR Codes
              </h2>
              <div className="qr-print-grid">
                {(tab === "bays" ? bays : []).map((bay) => (
                  <div key={bay.id} className="qr-print-card">
                    {bay.qr_url && <QRCodeSVG value={bay.qr_url} size={150} />}
                    <p className="qr-print-label">{bay.code}</p>
                    {bay.zone && <p className="qr-print-sub">{bay.zone}</p>}
                  </div>
                ))}
                {(tab === "vehicles" ? vehicles : []).map((v) => (
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
