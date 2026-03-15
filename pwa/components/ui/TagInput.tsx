"use client";

import { useState, useCallback } from "react";

const PRESETS = ["classique", "competition", "vip", "electrique"];

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState("");

  const toggle = useCallback(
    (tag: string) => {
      onChange(
        tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]
      );
    },
    [tags, onChange]
  );

  const addCustom = useCallback(() => {
    const val = input.trim().toLowerCase();
    if (!val || tags.includes(val)) {
      setInput("");
      return;
    }
    onChange([...tags, val]);
    setInput("");
  }, [input, tags, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addCustom();
      }
    },
    [addCustom]
  );

  const remove = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange]
  );

  // Custom tags = tags that are not in presets
  const customTags = tags.filter((t) => !PRESETS.includes(t));

  return (
    <div>
      <p className="text-xs text-white/30 mb-2">Tags</p>

      {/* Preset pills */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              tags.includes(tag)
                ? "bg-gold/15 text-gold border-gold/30"
                : "bg-white/[0.04] text-white/50 border-white/[0.06]"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Custom tags */}
      {customTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {customTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gold/15 text-gold border border-gold/30"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add custom tag input */}
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add custom tag..."
          className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!input.trim()}
          className="px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/50 text-xs hover:text-gold hover:border-gold/30 transition-colors disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
