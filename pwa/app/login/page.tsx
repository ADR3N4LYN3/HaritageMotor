"use client";

import { useState, useReducer, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, verifyMFA } from "@/lib/auth";
import { ActionButton } from "@/components/ui/ActionButton";
import { ApiError } from "@/lib/api";
import type { User } from "@/lib/types";

function getRedirectPath(user: User): string {
  if (user.password_change_required) return "/change-password";
  if (user.role === "superadmin") return "/admin";
  return "/scan";
}

export default function LoginPage() {
  const router = useRouter();
  const [{ email, password, showPassword }, setForm] = useReducer(
    (s: { email: string; password: string; showPassword: boolean }, a: Partial<{ email: string; password: string; showPassword: boolean }>) => ({ ...s, ...a }),
    { email: "", password: "", showPassword: false }
  );
  const [{ step, mfaToken, mfaCode }, setMfa] = useReducer(
    (s: { step: "login" | "mfa"; mfaToken: string; mfaCode: string }, a: Partial<{ step: "login" | "mfa"; mfaToken: string; mfaCode: string }>) => ({ ...s, ...a }),
    { step: "login" as "login" | "mfa", mfaToken: "", mfaCode: "" }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mfaInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus MFA input when step changes
  useEffect(() => {
    if (step === "mfa" && mfaInputRef.current) {
      mfaInputRef.current.focus();
    }
  }, [step]);

  // Auto-submit MFA when 6 digits entered
  useEffect(() => {
    if (mfaCode.length === 6 && step === "mfa") {
      handleMFA();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mfaCode, step]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await login(email.trim(), password);
      if (result.step === "mfa") {
        setMfa({ mfaToken: result.mfa_token, step: "mfa" });
      } else {
        router.push(getRedirectPath(result.user));
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Connection failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMFA() {
    setLoading(true);
    setError(null);
    try {
      const user = await verifyMFA(mfaToken, mfaCode);
      router.push(getRedirectPath(user));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Verification failed");
      }
      setMfa({ mfaCode: "" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0e0d0b] flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-10 text-center flex flex-col items-center">
        {/* Shield crest */}
        <svg className="w-10 h-12 text-gold mb-4" viewBox="0 0 40 48" fill="none" stroke="currentColor" strokeWidth={1.2}>
          <path d="M20 2L4 10v14c0 12 16 20 16 20s16-8 16-20V10L20 2z" />
          <path d="M20 8L10 13v9c0 8 10 14 10 14s10-6 10-14v-9L20 8z" strokeWidth={0.8} strokeOpacity={0.4} />
        </svg>
        <h1 className="font-display text-2xl font-light tracking-[0.15em] text-gold">
          Heritage Motor
        </h1>
        <p className="text-white/30 text-[11px] font-sans uppercase tracking-[0.25em] mt-3">
          Vehicle Custody Platform
        </p>
        {/* Gold separator */}
        <div className="w-12 h-px bg-gold/40 mx-auto my-8" />
      </div>

      {step === "login" ? (
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setForm({ email: e.target.value })}
              placeholder="Email"
              required
              className="w-full px-4 py-3.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm font-light tracking-wide transition-colors"
              autoComplete="email"
            />
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setForm({ password: e.target.value })}
              placeholder="Password"
              required
              minLength={8}
              className="w-full px-4 py-3.5 pr-12 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 text-sm font-light tracking-wide transition-colors"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setForm({ showPassword: !showPassword })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
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

          {error && (
            <p className="text-danger text-sm text-center font-light">{error}</p>
          )}

          <ActionButton type="submit" loading={loading}>
            Sign In
          </ActionButton>
        </form>
      ) : (
        <div className="w-full max-w-sm bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-6">
          <div className="text-center">
            <p className="text-white/40 text-sm font-light">Enter the 6-digit code from your authenticator app</p>
          </div>
          <input
            ref={mfaInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={mfaCode}
            onChange={(e) => setMfa({ mfaCode: e.target.value.replace(/\D/g, "") })}
            placeholder="000000"
            className="w-full px-4 py-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-center text-2xl tracking-[0.5em] font-mono placeholder:text-white/15 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
          />

          {error && (
            <p className="text-danger text-sm text-center font-light">{error}</p>
          )}

          {loading && (
            <div className="flex justify-center">
              <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            </div>
          )}

          <button
            onClick={() => { setMfa({ step: "login", mfaCode: "" }); setError(null); }}
            className="w-full text-gold/60 text-xs uppercase tracking-widest hover:text-gold transition-colors"
          >
            Back to login
          </button>
        </div>
      )}
    </div>
  );
}
