"use client";

import { useState, useRef, useEffect } from "react";
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
  const [step, setStep] = useState<"login" | "mfa">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
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
      const result = await login(email, password);
      if (result.step === "mfa") {
        setMfaToken(result.mfa_token);
        setStep("mfa");
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
      setMfaCode("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-display font-bold text-gold tracking-wide">
          Heritage Motor
        </h1>
        <p className="text-white/40 text-sm mt-2">Vehicle Custody Platform</p>
      </div>

      {step === "login" ? (
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50 text-sm"
              autoComplete="email"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={8}
              className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50 text-sm"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-danger text-sm text-center">{error}</p>
          )}

          <ActionButton type="submit" loading={loading}>
            Sign In
          </ActionButton>
        </form>
      ) : (
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <p className="text-white/60 text-sm">Enter the 6-digit code from your authenticator app</p>
          </div>
          <input
            ref={mfaInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl tracking-[0.5em] font-mono placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-gold/50"
            autoFocus
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
            onClick={() => { setStep("login"); setError(null); setMfaCode(""); }}
            className="w-full text-white/40 text-sm underline"
          >
            Back to login
          </button>
        </div>
      )}
    </div>
  );
}
