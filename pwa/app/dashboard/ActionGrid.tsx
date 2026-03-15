"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";

interface ActionGridProps {
  canCreate: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  labels: {
    scanQr: string; quickLookup: string;
    bays: string; manageFacility: string;
    qrCodes: string; printLabels: string;
    team: string; manageUsers: string;
    auditLog: string; auditSub: string;
    adminPanel: string; adminSub: string;
  };
}

export const ActionGrid = memo(function ActionGrid({ canCreate, isAdmin, isSuperAdmin, labels }: ActionGridProps) {
  const router = useRouter();

  return (
    <div className="reveal-up reveal-d2 grid grid-cols-2 lg:grid-cols-3 gap-3">
      <button onClick={() => router.push("/scan")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift group">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></svg>
          </div>
          <div>
            <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300">{labels.scanQr}</p>
            <p className="text-[10px] text-white/25 mt-0.5">{labels.quickLookup}</p>
          </div>
        </div>
      </button>
      <button onClick={() => router.push("/bays")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift group">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
          </div>
          <div>
            <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300">{labels.bays}</p>
            <p className="text-[10px] text-white/25 mt-0.5">{labels.manageFacility}</p>
          </div>
        </div>
      </button>
      {canCreate && (
        <button onClick={() => router.push("/qr-codes")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift group">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" /><rect x="2" y="14" width="8" height="8" rx="1" /><path d="M14 14h4v4h-4zM22 14v4h-4M22 22h-4v-4" /></svg>
            </div>
            <div>
              <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300">{labels.qrCodes}</p>
              <p className="text-[10px] text-white/25 mt-0.5">{labels.printLabels}</p>
            </div>
          </div>
        </button>
      )}
      {isAdmin && (
        <button onClick={() => router.push("/users")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift group">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div>
              <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300">{labels.team}</p>
              <p className="text-[10px] text-white/25 mt-0.5">{labels.manageUsers}</p>
            </div>
          </div>
        </button>
      )}
      {isAdmin && (
        <button onClick={() => router.push("/audit")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift group">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
            </div>
            <div>
              <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300">{labels.auditLog}</p>
              <p className="text-[10px] text-white/25 mt-0.5">{labels.auditSub}</p>
            </div>
          </div>
        </button>
      )}
      {isSuperAdmin && (
        <button onClick={() => router.push("/admin")} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] gold-border-top card-lift group col-span-2 lg:col-span-3">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-gold/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
            </div>
            <div>
              <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-300">{labels.adminPanel}</p>
              <p className="text-[10px] text-white/25 mt-0.5">{labels.adminSub}</p>
            </div>
          </div>
        </button>
      )}
    </div>
  );
});
