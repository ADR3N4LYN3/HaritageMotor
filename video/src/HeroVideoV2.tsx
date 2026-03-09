import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { CarScene } from "./CarScene";
import { BrandWatermark } from "./BrandWatermark";

const FPS = 30;
const SCENE_DURATION = 4 * FPS; // 4 seconds per scene
const TRANSITION_DURATION = 1 * FPS; // 1 second crossfade

// ── Stock footage — Pexels Free License (commercial use OK) ─────────
// Luxury & prestige cars, all 1080p landscape
const CLIPS = [
  // Scene 1: Rolls-Royce emblem close-up — prestige opening
  "https://videos.pexels.com/video-files/10809162/10809162-hd_1920_1080_25fps.mp4",
  // Scene 2: BMW in moody parking garage — indoor/hangar atmosphere
  "https://videos.pexels.com/video-files/7700772/7700772-hd_1920_1080_24fps.mp4",
  // Scene 3: Luxury sports cars cruising palm-lined street — fleet/collection
  "https://videos.pexels.com/video-files/5309381/5309381-hd_1920_1080_25fps.mp4",
  // Scene 4: Red sports car detail — sleek design close-up
  "https://videos.pexels.com/video-files/5309351/5309351-hd_1920_1080_25fps.mp4",
  // Scene 5: Lamborghini on the road — dynamic driving
  "https://videos.pexels.com/video-files/7727416/7727416-hd_1920_1080_25fps.mp4",
  // Scene 6: BMW driving in parking garage — dynamic indoor movement
  "https://videos.pexels.com/video-files/7700793/7700793-hd_1920_1080_24fps.mp4",
  // Scene 7: Sports car at night — moody urban atmosphere
  "https://videos.pexels.com/video-files/13795953/13795953-hd_1920_1080_30fps.mp4",
  // Scene 8: Sports car speeding through city — closing movement
  "https://videos.pexels.com/video-files/7727415/7727415-hd_1920_1080_25fps.mp4",
];

// ── Duration calculation ─────────────────────────────────────────────
// 8 scenes × 120 frames = 960
// 7 fade transitions × 30 frames = -210
// Total = 750 frames = 25 seconds
const TRANSITION_COUNT = CLIPS.length - 1;
export const TOTAL_DURATION_V2 =
  CLIPS.length * SCENE_DURATION - TRANSITION_COUNT * TRANSITION_DURATION;

export const HeroVideoV2: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0e0d0b" }}>
      {/* Video layer */}
      <TransitionSeries>
        {/* ── Scene 1: Rolls-Royce emblem — prestige opening ─────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[0]} zoomFrom={1.02} zoomTo={1.08} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* ── Scene 2: BMW — moody parking garage ────────────────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[1]} zoomFrom={1.0} zoomTo={1.05} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* ── Scene 3: Luxury fleet — palm-lined street ──────────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[2]} zoomFrom={1.04} zoomTo={1.0} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* ── Scene 4: Red sports car — design close-up ──────────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[3]} zoomFrom={1.0} zoomTo={1.06} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* ── Scene 5: Lamborghini — dynamic road action ─────────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[4]} zoomFrom={1.0} zoomTo={1.05} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* ── Scene 6: BMW — driving in parking garage ───────────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[5]} zoomFrom={1.04} zoomTo={1.0} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* ── Scene 7: Sports car at night — moody urban ─────────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[6]} zoomFrom={1.06} zoomTo={1.0} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* ── Scene 8: Sports car — city closing shot ────────────── */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <CarScene src={CLIPS[7]} zoomFrom={1.02} zoomTo={1.0} playbackRate={0.7} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Brand watermark — persistent semi-transparent overlay */}
      <BrandWatermark />
    </AbsoluteFill>
  );
};
