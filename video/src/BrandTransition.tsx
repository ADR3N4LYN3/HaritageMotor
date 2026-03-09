import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const BrandTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Text fades in over first 30%, holds, fades out over last 30%
  const fadeIn = Math.floor(durationInFrames * 0.3);
  const fadeOut = Math.floor(durationInFrames * 0.7);

  const opacity = interpolate(
    frame,
    [0, fadeIn, fadeOut, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Subtle scale-up for cinematic feel
  const scale = interpolate(frame, [0, durationInFrames], [0.95, 1.02], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });

  // Gold line width animation
  const lineWidth = interpolate(frame, [0, fadeIn, fadeOut, durationInFrames], [0, 80, 80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0e0d0b",
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {/* Top gold line */}
      <div
        style={{
          width: lineWidth,
          height: 1,
          backgroundColor: "#b8955a",
          marginBottom: 24,
        }}
      />
      {/* Brand name */}
      <div
        style={{
          fontFamily: "'Cormorant Garamond', 'Georgia', serif",
          fontSize: 72,
          fontWeight: 300,
          letterSpacing: 12,
          textTransform: "uppercase",
          color: "#b8955a",
        }}
      >
        Heritage Motor
      </div>
      {/* Bottom gold line */}
      <div
        style={{
          width: lineWidth,
          height: 1,
          backgroundColor: "#b8955a",
          marginTop: 24,
        }}
      />
    </AbsoluteFill>
  );
};
