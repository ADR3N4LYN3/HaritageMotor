"use client";

import { useState, useReducer } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAppStore } from "@/store/app.store";
import { ActionButton } from "@/components/ui/ActionButton";

function getStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

const strengthLabels = ["", "Weak", "Fair", "Good", "Strong", "Excellent"];
const strengthColors = ["", "bg-red-500", "bg-orange-500", "bg-amber-400", "bg-emerald-400", "bg-emerald-500"];

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        minLength={8}
        className="w-full px-4 py-3.5 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50 text-sm"
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
        tabIndex={-1}
      >
        {show ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [{ loading, error }, setStatus] = useReducer(
    (s: { loading: boolean; error: string | null }, a: Partial<{ loading: boolean; error: string | null }>) => ({ ...s, ...a }),
    { loading: false, error: null as string | null }
  );

  const strength = getStrength(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
  const hasLength = newPassword.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ error: null });

    if (newPassword !== confirm) {
      setStatus({ error: "Passwords do not match" });
      return;
    }

    setStatus({ loading: true });
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      if (user?.role === "superadmin") {
        router.push("/admin");
      } else {
        router.push("/scan");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setStatus({ error: err.message });
      } else {
        setStatus({ error: "Failed to change password" });
      }
    } finally {
      setStatus({ loading: false });
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-display font-bold text-gold tracking-wide">
          Change Password
        </h1>
        <p className="text-white/40 text-sm mt-2">
          You must change your password before continuing
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <PasswordInput
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Current password"
          autoComplete="current-password"
        />
        <PasswordInput
          value={newPassword}
          onChange={setNewPassword}
          placeholder="New password"
          autoComplete="new-password"
        />

        {/* Strength bar */}
        {newPassword.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    n <= strength ? strengthColors[strength] : "bg-white/[0.06]"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-white/40 text-xs">{strengthLabels[strength]}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                { ok: hasLength, label: "8+ characters" },
                { ok: hasLower, label: "Lowercase" },
                { ok: hasUpper, label: "Uppercase" },
                { ok: hasDigit, label: "Digit" },
                { ok: hasSpecial, label: "Special character" },
              ].map((r) => (
                <p key={r.label} className={`text-xs ${r.ok ? "text-emerald-400/70" : "text-white/20"}`}>
                  {r.ok ? "\u2713" : "\u2022"} {r.label}
                </p>
              ))}
            </div>
          </div>
        )}

        <PasswordInput
          value={confirm}
          onChange={setConfirm}
          placeholder="Confirm new password"
          autoComplete="new-password"
        />

        {error && <p className="text-danger text-sm text-center">{error}</p>}

        <ActionButton type="submit" loading={loading}>
          Update Password
        </ActionButton>
      </form>
    </div>
  );
}
