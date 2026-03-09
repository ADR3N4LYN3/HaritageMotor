import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { CarScene } from "./CarScene";
import { BrandWatermark } from "./BrandWatermark";

const FPS = 30;
const SCENE_DURATION = 4 * FPS; // 4 seconds per scene
const TRANSITION_DURATION = 1 * FPS; // 1 second crossfade

// ── Stock footage — Pexels Free License (commercial use OK) ─────────
// Modern luxury cars only, all 1080p landscape, identifiable brands
const CLIPS = [
  // Scene 1: Multiple supercars in indoor hall — garage/collection feel
  "https://videos.pexels.com/video-files/14228182/14228182-hd_1920_1080_60fps.mp4",
  // Scene 2: Red Ferrari driving through city streets — dynamic
  "https://videos.pexels.com/video-files/30794587/13171246_1920_1080_60fps.mp4",
  // Scene 3: Lamborghini wheel detail — sunflare, elegant close-up
  "https://videos.pexels.com/video-files/20153915/20153915-hd_1920_1080_24fps.mp4",
  // Scene 4: Mercedes-Benz AMG GT black — moody rainy urban
  "https://videos.pexels.com/video-files/5098993/5098993-hd_1920_1080_24fps.mp4",
  // Scene 5: BMW M3 driving at dusk — scenic road
  "https://videos.pexels.com/video-files/30604039/13103345_1920_1080_60fps.mp4",
  // Scene 6: McLaren Senna rear view — red, sunset closing shot
  "https://videos.pexels.com/video-files/5309319/5309319-hd_1920_1080_25fps.mp4",
];

// ── Duration calculation ─────────────────────────────────────────────
// 6 scenes × 120 frames = 720
// 5 fade transitions × 30 frames = -150
// Total = 570 frames = 19 seconds
const TRANSITION_COUNT = CLIPS.length - 1;
export const TOTAL_DURATION =
  CLIPS.length * SCENE_DURATION - TRANSITION_COUNT * TRANSITION_DURATION;

export const HeroVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0e0d0b" }}>
      {/* Video layer */}
      <TransitionSeries>
        {/* ── Scene 1: Supercars hall — collection/garage opening ── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[0]} zoomFrom={1.0} zoomTo={1.06} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* ── Scene 2: Ferrari — city driving ──────────────────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[1]} zoomFrom={1.02} zoomTo={1.0} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* ── Scene 3: Lamborghini — wheel detail sunflare ─────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[2]} zoomFrom={1.0} zoomTo={1.08} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* ── Scene 4: Mercedes AMG GT — moody black ───────────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[3]} zoomFrom={1.04} zoomTo={1.0} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* ── Scene 5: BMW M3 — dusk driving ───────────────────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[4]} zoomFrom={1.0} zoomTo={1.05} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* ── Scene 6: McLaren Senna — sunset closing ──────────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[5]} zoomFrom={1.06} zoomTo={1.0} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Brand watermark — persistent semi-transparent overlay */}
      <BrandWatermark />
    </AbsoluteFill>
  );
};
