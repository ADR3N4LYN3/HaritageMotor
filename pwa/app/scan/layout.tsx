"use client";

import { SideNav } from "@/components/layout/SideNav";

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SideNav />
      {children}
    </div>
  );
}
