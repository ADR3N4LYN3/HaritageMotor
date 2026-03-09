import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const BrandWatermark: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Fade in over first 2 seconds, stay, fade out over last 1 second
  const opacity = interpolate(
    frame,
    [0, 60, durationInFrames - 30, durationInFrames],
    [0, 0.12, 0.12, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Very subtle drift upward
  const translateY = interpolate(frame, [0, durationInFrames], [4, -4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "'Cormorant Garamond', 'Georgia', serif",
          fontSize: 90,
          fontWeight: 300,
          letterSpacing: 16,
          textTransform: "uppercase",
          color: "#ffffff",
        }}
      >
        Heritage Motor
      </div>
    </AbsoluteFill>
  );
};
