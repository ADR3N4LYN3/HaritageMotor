"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { QRCodeSVG } from "qrcode.react";
import { api, ApiError } from "@/lib/api";
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

  // MFA setup state
  const [mfaStep, setMfaStep] = useState<"idle" | "setup" | "verify">("idle");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaUrl, setMfaUrl] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  // MFA disable state
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);

  // Logout state
  const [logoutLoading, setLogoutLoading] = useState(false);

  if (!user) {
    return (
      <AppShell>
        <PageHeader title="Profile" backHref="/dashboard" />
        <div className="mt-8 text-center text-white/40">Not authenticated</div>
      </AppShell>
    );
  }

  async function handleSetupMFA() {
    setMfaError(null);
    setMfaLoading(true);
    try {
      const data = await api.post<{ secret: string; url: string }>("/auth/mfa/setup");
      setMfaSecret(data.secret);
      setMfaUrl(data.url);
      setMfaStep("setup");
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : "Failed to setup MFA");
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleEnableMFA() {
    if (totpCode.length !== 6) {
      setMfaError("Please enter a 6-digit code");
      return;
    }
    setMfaError(null);
    setMfaLoading(true);
    try {
      await api.post("/auth/mfa/enable", { code: totpCode });
      setUser({ ...user!, totp_enabled: true });
      setMfaStep("idle");
      setMfaSecret("");
      setMfaUrl("");
      setTotpCode("");
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : "Invalid code");
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleDisableMFA() {
    setMfaError(null);
    setDisableLoading(true);
    try {
      await api.delete("/auth/mfa");
      setUser({ ...user!, totp_enabled: false });
      setShowDisableConfirm(false);
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : "Failed to disable MFA");
    } finally {
      setDisableLoading(false);
    }
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
      <div className="mt-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
        <p className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-4">
          Multi-Factor Authentication
        </p>

        {mfaError && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
            {mfaError}
          </div>
        )}

        {/* MFA not enabled — show setup */}
        {!user.totp_enabled && mfaStep === "idle" && (
          <div>
            <p className="text-sm text-white/40 font-light mb-4">
              Protect your account with a time-based one-time password (TOTP) using an authenticator app like Google Authenticator.
            </p>
            <ActionButton
              variant="secondary"
              loading={mfaLoading}
              onClick={handleSetupMFA}
            >
              Setup MFA
            </ActionButton>
          </div>
        )}

        {/* MFA setup — show QR + secret */}
        {!user.totp_enabled && mfaStep === "setup" && (
          <div>
            <p className="text-sm text-white/40 font-light mb-4">
              Scan this QR code with your authenticator app, then enter the 6-digit code below to verify.
            </p>

            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <QRCodeSVG value={mfaUrl} size={200} bgColor="transparent" fgColor="#b8955a" />
              </div>
            </div>

            <p className="text-xs text-white/30 text-center mb-2">
              Or enter this secret manually:
            </p>
            <code className="block bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 text-sm text-gold font-mono tracking-widest text-center select-all mb-6">
              {mfaSecret}
            </code>

            <div className="mb-4">
              <label className="block text-sm text-white/40 mb-2">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 rounded-xl px-4 py-3 text-center text-lg tracking-[0.3em] font-mono outline-none transition-all"
                autoComplete="one-time-code"
              />
            </div>

            <div className="flex gap-3">
              <ActionButton
                variant="secondary"
                fullWidth
                onClick={() => {
                  setMfaStep("idle");
                  setMfaSecret("");
                  setMfaUrl("");
                  setTotpCode("");
                  setMfaError(null);
                }}
              >
                Cancel
              </ActionButton>
              <ActionButton
                variant="primary"
                fullWidth
                loading={mfaLoading}
                onClick={handleEnableMFA}
                disabled={totpCode.length !== 6}
              >
                Verify &amp; Enable
              </ActionButton>
            </div>
          </div>
        )}

        {/* MFA enabled — show disable option */}
        {user.totp_enabled && !showDisableConfirm && (
          <div>
            <p className="text-sm text-white/40 font-light mb-4">
              MFA is currently active on your account. You can disable it below.
            </p>
            <ActionButton
              variant="danger"
              onClick={() => setShowDisableConfirm(true)}
            >
              Disable MFA
            </ActionButton>
          </div>
        )}

        {/* Disable confirmation */}
        {user.totp_enabled && showDisableConfirm && (
          <div>
            <div className="mb-4 p-4 rounded-xl bg-danger/10 border border-danger/20">
              <p className="text-sm text-danger font-medium mb-1">Are you sure?</p>
              <p className="text-sm text-white/40 font-light">
                Disabling MFA will make your account less secure. You will no longer need a code from your authenticator app to sign in.
              </p>
            </div>
            <div className="flex gap-3">
              <ActionButton
                variant="secondary"
                fullWidth
                onClick={() => {
                  setShowDisableConfirm(false);
                  setMfaError(null);
                }}
              >
                Keep enabled
              </ActionButton>
              <ActionButton
                variant="danger"
                fullWidth
                loading={disableLoading}
                onClick={handleDisableMFA}
              >
                Confirm disable
              </ActionButton>
            </div>
          </div>
        )}
      </div>

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
