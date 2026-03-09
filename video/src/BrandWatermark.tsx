import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const GOLD = "#b8955a";
const GOLD_LIGHT = "#d4b87a";

export const BrandWatermark: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, 60, durationInFrames - 30, durationInFrames],
    [0, 0.4, 0.4, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const translateY = interpolate(frame, [0, durationInFrames], [3, -3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "flex-end",
        padding: "0 52px 0 0",
        opacity,
        transform: `translateY(${translateY}px)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 18,
          background: "rgba(0,0,0,0.25)",
          padding: "14px 24px",
          borderRadius: 6,
          border: `1px solid rgba(184,149,90,0.2)`,
        }}
      >
        {/* HM Shield Crest */}
        <div style={{ width: 46, height: 56, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 280 340" width={46} height={56} style={{ position: "absolute", inset: 0 }}>
            <defs>
              <linearGradient id="wmGoldH" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#96783f" />
                <stop offset="20%" stopColor="#d4b07a" />
                <stop offset="50%" stopColor="#dcc28a" />
                <stop offset="80%" stopColor="#d4b07a" />
                <stop offset="100%" stopColor="#96783f" />
              </linearGradient>
              <linearGradient id="wmDark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#191816" />
                <stop offset="100%" stopColor="#0e0d0b" />
              </linearGradient>
              <linearGradient id="wmGoldV" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dcc28a" />
                <stop offset="45%" stopColor={GOLD} />
                <stop offset="100%" stopColor="#96783f" />
              </linearGradient>
            </defs>
            {/* Shield outer gold */}
            <path d="M140,4 L264,4 Q276,4 276,16 L276,186 Q276,230 248,260 Q218,292 140,332 Q62,292 32,260 Q4,230 4,186 L4,16 Q4,4 16,4 Z" fill="url(#wmGoldH)" />
            {/* Shield inner dark */}
            <path d="M140,12 L260,12 Q268,12 268,20 L268,184 Q268,226 242,254 Q214,284 140,322 Q66,284 38,254 Q12,226 12,184 L12,20 Q12,12 20,12 Z" fill="url(#wmDark)" />
            {/* Inner outline */}
            <path d="M140,22 L254,22 Q260,22 260,28 L260,180 Q260,220 236,246 Q210,274 140,310 Q70,274 44,246 Q20,220 20,180 L20,28 Q20,22 26,22 Z" fill="none" stroke={GOLD} strokeWidth="1.2" />
            {/* HM text */}
            <text x="140" y="185" textAnchor="middle" fontFamily="'Cormorant Garamond','Garamond','Georgia',serif" fontSize="118" fontWeight="700" letterSpacing="5" fill="url(#wmGoldV)">HM</text>
          </svg>
        </div>

        {/* Separator */}
        <div
          style={{
            width: 1,
            height: 34,
            background: `linear-gradient(180deg, transparent, ${GOLD_LIGHT}, transparent)`,
          }}
        />

        <div
          style={{
            fontFamily: "'Cormorant Garamond', 'Georgia', serif",
            fontSize: 34,
            fontWeight: 500,
            letterSpacing: 10,
            textTransform: "uppercase",
            color: GOLD_LIGHT,
            textShadow: `0 0 20px rgba(184,149,90,0.4), 0 1px 3px rgba(0,0,0,0.7)`,
          }}
        >
          Heritage Motor
        </div>
      </div>
    </AbsoluteFill>
  );
};
