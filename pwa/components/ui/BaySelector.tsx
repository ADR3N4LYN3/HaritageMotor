"use client";

import { useState } from "react";
import type { Bay } from "@/lib/types";

interface BaySelectorProps {
  bays: Bay[];
  selectedBayId: string | null;
  onSelect: (bay: Bay) => void;
  loading?: boolean;
}

export function BaySelector({ bays, selectedBayId, onSelect, loading }: BaySelectorProps) {
  const [search, setSearch] = useState("");

  const freeBays = bays.filter(
    (b) => b.status === "free" && b.code.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search bay..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-[#0e0d0b]/10 bg-white text-[#0e0d0b] placeholder:text-[#0e0d0b]/30 focus:outline-none focus:ring-2 focus:ring-[#b8955a]/50 text-sm"
      />
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {freeBays.length === 0 ? (
          <p className="text-center text-sm text-[#0e0d0b]/40 py-4">No available bays</p>
        ) : (
          freeBays.map((bay) => (
            <button
              key={bay.id}
              onClick={() => onSelect(bay)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all touch-target ${
                selectedBayId === bay.id
                  ? "border-[#b8955a] bg-[#b8955a]/10 ring-2 ring-[#b8955a]/20"
                  : "border-[#0e0d0b]/10 bg-white hover:bg-[#0e0d0b]/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#0e0d0b]">{bay.code}</span>
                {bay.zone && (
                  <span className="text-xs text-[#0e0d0b]/40">{bay.zone}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
