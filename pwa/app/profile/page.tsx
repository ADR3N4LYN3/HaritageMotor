"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { TOTPSetup } from "@/components/profile/TOTPSetup";
import { logout } from "@/lib/auth";
import { useAppStore } from "@/store/app.store";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Administrator",
  operator: "Operator",
  technician: "Technician",
  viewer: "Viewer",
};

export default function ProfilePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);

  const [logoutLoading, setLogoutLoading] = useState(false);

  if (!user) {
    return (
      <AppShell>
        <PageHeader title="Profile" backHref="/dashboard" />
        <div className="mt-8 text-center text-white/40">Not authenticated</div>
      </AppShell>
    );
  }

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await logout();
      router.push("/login");
    } catch {
      // Best-effort — redirect anyway
      router.push("/login");
    }
  }

  return (
    <AppShell>
      <PageHeader title="Profile" backHref="/dashboard" />

      {/* User info card */}
      <div className="mt-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
        <p className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-4">
          Account
        </p>

        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-white/40">Name</span>
            <span className="text-sm text-white font-light">
              {user.first_name} {user.last_name}
            </span>
          </div>
          <div className="border-t border-white/[0.04]" />

          <div className="flex justify-between items-baseline">
            <span className="text-sm text-white/40">Email</span>
            <span className="text-sm text-white font-light">{user.email}</span>
          </div>
          <div className="border-t border-white/[0.04]" />

          <div className="flex justify-between items-baseline">
            <span className="text-sm text-white/40">Role</span>
            <span className="text-sm text-white font-light">
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>
          <div className="border-t border-white/[0.04]" />

          <div className="flex justify-between items-baseline">
            <span className="text-sm text-white/40">MFA</span>
            <span className={`text-sm font-light ${user.totp_enabled ? "text-emerald-400" : "text-white/40"}`}>
              {user.totp_enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* MFA section */}
      <TOTPSetup user={user} onUserUpdate={setUser} />

      {/* Logout */}
      <div className="mt-4 mb-8">
        <ActionButton
          variant="danger"
          loading={logoutLoading}
          onClick={handleLogout}
        >
          Log out
        </ActionButton>
      </div>
    </AppShell>
  );
}
