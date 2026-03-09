import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";

type CarSceneProps = {
  src: string;
  zoomFrom: number;
  zoomTo: number;
  playbackRate?: number;
};

export const CarScene: React.FC<CarSceneProps> = ({
  src,
  zoomFrom,
  zoomTo,
  playbackRate = 0.8,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Ken Burns: slow cinematic zoom
  const scale = interpolate(frame, [0, durationInFrames], [zoomFrom, zoomTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0e0d0b" }}>
      <Video
        src={src}
        muted
        playbackRate={playbackRate}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
      {/* Cinematic vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(14,13,11,0.5) 100%)",
        }}
      />
      {/* Warm gold tint at bottom for brand consistency */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(184,149,90,0.06) 0%, transparent 40%)",
        }}
      />
    </AbsoluteFill>
  );
};
