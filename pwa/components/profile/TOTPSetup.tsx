"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ActionButton } from "@/components/ui/ActionButton";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { totpI18n } from "@/lib/translations";

export interface TOTPSetupProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

export function TOTPSetup({ user, onUserUpdate }: TOTPSetupProps) {
  const { t } = useI18n(totpI18n);
  const [mfaStep, setMfaStep] = useState<"idle" | "setup">("idle");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaUrl, setMfaUrl] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);

  async function handleSetupMFA() {
    setMfaError(null);
    setMfaLoading(true);
    try {
      const data = await api.post<{ secret: string; url: string }>("/auth/mfa/setup");
      setMfaSecret(data.secret);
      setMfaUrl(data.url);
      setMfaStep("setup");
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : t.setupFailed);
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleEnableMFA() {
    if (totpCode.length !== 6) {
      setMfaError(t.enterCode);
      return;
    }
    setMfaError(null);
    setMfaLoading(true);
    try {
      await api.post("/auth/mfa/enable", { code: totpCode });
      onUserUpdate({ ...user, totp_enabled: true });
      setMfaStep("idle");
      setMfaSecret("");
      setMfaUrl("");
      setTotpCode("");
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : t.invalidCode);
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleDisableMFA() {
    setMfaError(null);
    setDisableLoading(true);
    try {
      await api.delete("/auth/mfa");
      onUserUpdate({ ...user, totp_enabled: false });
      setShowDisableConfirm(false);
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : t.disableFailed);
    } finally {
      setDisableLoading(false);
    }
  }

  return (
    <div className="mt-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
      <p className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-4">
        {t.title}
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
            {t.protectAccount}
          </p>
          <ActionButton
            variant="secondary"
            loading={mfaLoading}
            onClick={handleSetupMFA}
          >
            {t.setupMFA}
          </ActionButton>
        </div>
      )}

      {/* MFA setup — show QR + secret */}
      {!user.totp_enabled && mfaStep === "setup" && (
        <div>
          <p className="text-sm text-white/40 font-light mb-4">
            {t.scanQrCode}
          </p>

          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <QRCodeSVG value={mfaUrl} size={200} bgColor="transparent" fgColor="#b8955a" />
            </div>
          </div>

          <p className="text-xs text-white/30 text-center mb-2">
            {t.manualEntry}
          </p>
          <code className="block bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 text-sm text-gold font-mono tracking-widest text-center select-all mb-6">
            {mfaSecret}
          </code>

          <div className="mb-4">
            <label className="block text-sm text-white/40 mb-2">{t.verificationCode}</label>
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
              {t.cancel}
            </ActionButton>
            <ActionButton
              variant="primary"
              fullWidth
              loading={mfaLoading}
              onClick={handleEnableMFA}
              disabled={totpCode.length !== 6}
            >
              {t.verifyEnable}
            </ActionButton>
          </div>
        </div>
      )}

      {/* MFA enabled — show disable option */}
      {user.totp_enabled && !showDisableConfirm && (
        <div>
          <p className="text-sm text-white/40 font-light mb-4">
            {t.mfaActive}
          </p>
          <ActionButton
            variant="danger"
            onClick={() => setShowDisableConfirm(true)}
          >
            {t.disableMFA}
          </ActionButton>
        </div>
      )}

      {/* Disable confirmation */}
      {user.totp_enabled && showDisableConfirm && (
        <div>
          <div className="mb-4 p-4 rounded-xl bg-danger/10 border border-danger/20">
            <p className="text-sm text-danger font-medium mb-1">{t.areYouSure}</p>
            <p className="text-sm text-white/40 font-light">
              {t.disableWarning}
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
              {t.keepEnabled}
            </ActionButton>
            <ActionButton
              variant="danger"
              fullWidth
              loading={disableLoading}
              onClick={handleDisableMFA}
            >
              {t.confirmDisable}
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
