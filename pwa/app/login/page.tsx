"use client";

import { useState, useReducer, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, verifyMFA } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import type { User } from "@/lib/types";

function getRedirectPath(user: User): string {
  if (user.password_change_required) return "/change-password";
  if (user.role === "superadmin") return "/admin";
  return "/scan";
}

/* ---------- Landing-style CTA button (outlined gold, hover fill) ---------- */
function LoginButton({ loading, children, ...props }: { loading: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="group relative w-full mt-2 py-3.5 border border-[rgba(184,149,90,0.4)] text-[#b8955a] text-[0.78rem] font-sans font-medium uppercase tracking-[0.15em] rounded overflow-hidden transition-colors duration-500 hover:text-[#0e0d0b] hover:border-[#b8955a] disabled:opacity-40 disabled:pointer-events-none"
      disabled={loading}
      {...props}
    >
      <span className="absolute inset-0 bg-[#b8955a] origin-left scale-x-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </span>
    </button>
  );
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

  useEffect(() => {
    if (step === "mfa" && mfaInputRef.current) {
      mfaInputRef.current.focus();
    }
  }, [step]);

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

  /* Noise texture (same as landing hero::after) */
  const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

  const inputCls = "w-full px-4 py-3.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(184,149,90,0.4)] focus:ring-1 focus:ring-[rgba(184,149,90,0.2)] text-sm font-normal tracking-wide transition-colors";

  return (
    <div className="relative min-h-screen bg-[#0e0d0b] flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Background photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1920&q=60&auto=format&fit=crop"
        alt=""
        className="pointer-events-none fixed inset-0 w-full h-full object-cover object-center scale-105"
      />
      {/* Dark overlay */}
      <div className="pointer-events-none fixed inset-0" style={{ background: "linear-gradient(180deg, rgba(14,13,11,0.96) 0%, rgba(14,13,11,0.91) 40%, rgba(14,13,11,0.91) 60%, rgba(14,13,11,0.97) 100%)" }} />
      {/* Noise texture */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]" style={{ backgroundImage: noiseBg }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">

        {/* Logo crest */}
        <div className="mb-12 text-center flex flex-col items-center">
          <svg className="w-[64px] h-auto mb-6" viewBox="0 0 280 336" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="lGH" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#96783f"/>
                <stop offset="50%" stopColor="#dcc28a"/>
                <stop offset="100%" stopColor="#96783f"/>
              </linearGradient>
              <linearGradient id="lDk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#191816"/>
                <stop offset="100%" stopColor="#0e0d0b"/>
              </linearGradient>
              <linearGradient id="lGV" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dcc28a"/>
                <stop offset="45%" stopColor="#b8955a"/>
                <stop offset="100%" stopColor="#96783f"/>
              </linearGradient>
            </defs>
            <path d="M140,4 L264,4 Q276,4 276,16 L276,186 Q276,230 248,260 Q218,292 140,332 Q62,292 32,260 Q4,230 4,186 L4,16 Q4,4 16,4 Z" fill="url(#lGH)"/>
            <path d="M140,12 L260,12 Q268,12 268,20 L268,184 Q268,226 242,254 Q214,284 140,322 Q66,284 38,254 Q12,226 12,184 L12,20 Q12,12 20,12 Z" fill="url(#lDk)"/>
            <path d="M140,22 L254,22 Q260,22 260,28 L260,180 Q260,220 236,246 Q210,274 140,310 Q70,274 44,246 Q20,220 20,180 L20,28 Q20,22 26,22 Z" fill="none" stroke="#b8955a" strokeWidth="1.2"/>
            <text x="140" y="185" textAnchor="middle" fontFamily="'Cormorant Garamond','Georgia',serif" fontSize="118" fontWeight="700" letterSpacing="5" fill="url(#lGV)">HM</text>
          </svg>
          <h1 className="font-display text-xl font-semibold tracking-[0.25em] uppercase text-[#b8955a]">
            Heritage Motor
          </h1>
          <p className="text-white/30 text-[11px] font-sans uppercase tracking-[0.25em] mt-3">
            Vehicle Custody Platform
          </p>
          {/* Gold gradient separator */}
          <div className="w-16 h-px mx-auto mt-10" style={{ background: "linear-gradient(90deg, transparent, #b8955a, transparent)" }} />
        </div>

        {step === "login" ? (
          <form onSubmit={handleLogin} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 space-y-5">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setForm({ email: e.target.value })}
                placeholder="Email"
                required
                className={inputCls}
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
                className={`${inputCls} pr-12`}
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
              <p className="text-danger text-sm text-center">{error}</p>
            )}

            <LoginButton type="submit" loading={loading}>
              Sign In
            </LoginButton>
          </form>
        ) : (
          <div className="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 space-y-6">
            <div className="text-center">
              <p className="text-white/40 text-sm">Enter the 6-digit code from your authenticator app</p>
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
              className="w-full px-4 py-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-center text-2xl tracking-[0.5em] font-mono placeholder:text-white/15 focus:outline-none focus:border-[rgba(184,149,90,0.4)] focus:ring-1 focus:ring-[rgba(184,149,90,0.2)] transition-colors"
            />

            {error && (
              <p className="text-danger text-sm text-center">{error}</p>
            )}

            {loading && (
              <div className="flex justify-center">
                <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              </div>
            )}

            <button
              onClick={() => { setMfa({ step: "login", mfaCode: "" }); setError(null); }}
              className="w-full text-[#b8955a]/60 text-xs uppercase tracking-widest hover:text-[#b8955a] transition-colors"
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
