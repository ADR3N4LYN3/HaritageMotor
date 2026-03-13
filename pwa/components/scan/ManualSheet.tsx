"use client";

export function ManualSheet({ code, setCode, error, onSubmit, onBack }: {
  code: string;
  setCode: (s: string) => void;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4 pt-4">
      <h2 className="font-display text-xl font-light tracking-wide text-white text-center">
        Enter QR Code
      </h2>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter QR token..."
        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] text-white placeholder:text-white/25 border border-white/[0.08] focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
      />
      {error && <p className="text-danger text-sm text-center">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-white/[0.08] text-white/50 text-sm font-medium active:scale-[0.98] transition-transform"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          className="flex-1 py-3 rounded-xl bg-gold text-white font-medium text-sm active:scale-[0.98] transition-transform"
          disabled={!code}
        >
          Search
        </button>
      </div>
    </div>
  );
}
