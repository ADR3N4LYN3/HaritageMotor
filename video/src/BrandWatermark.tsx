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
        justifyContent: "flex-start",
        alignItems: "flex-start",
        padding: "44px 52px",
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
        {/* Logo placeholder — will be replaced with actual SVG logo */}
        <div
          style={{
            width: 46,
            height: 46,
            border: `1.5px solid ${GOLD}`,
            borderRadius: 4,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: GOLD,
            fontSize: 9,
            fontFamily: "sans-serif",
            letterSpacing: 2,
          }}
        >
          LOGO
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
