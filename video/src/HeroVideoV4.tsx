import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { CarScene } from "./CarScene";
import { BrandWatermark } from "./BrandWatermark";

const FPS = 30;
const SCENE_DURATION = 4 * FPS;
const TRANSITION_DURATION = 1 * FPS;

// ── V4: "Detail & Drive" — v2 clips + 5309xxx luxury series ─────────
const CLIPS = [
  // Scene 1: Rolls-Royce emblem — prestige opening
  "https://videos.pexels.com/video-files/10809162/10809162-hd_1920_1080_25fps.mp4",
  // Scene 2: Luxury car (NEW 5309342)
  "https://videos.pexels.com/video-files/5309342/5309342-hd_1920_1080_25fps.mp4",
  // Scene 3: Lamborghini on the road — dynamic
  "https://videos.pexels.com/video-files/7727416/7727416-hd_1920_1080_25fps.mp4",
  // Scene 4: Luxury car (NEW 5309345)
  "https://videos.pexels.com/video-files/5309345/5309345-hd_1920_1080_25fps.mp4",
  // Scene 5: Red sports car detail — close-up
  "https://videos.pexels.com/video-files/5309351/5309351-hd_1920_1080_25fps.mp4",
  // Scene 6: Luxury car (NEW 5309378)
  "https://videos.pexels.com/video-files/5309378/5309378-hd_1920_1080_25fps.mp4",
  // Scene 7: Luxury fleet — palm-lined street
  "https://videos.pexels.com/video-files/5309381/5309381-hd_1920_1080_25fps.mp4",
  // Scene 8: Luxury car (NEW 5309394)
  "https://videos.pexels.com/video-files/5309394/5309394-hd_1920_1080_25fps.mp4",
  // Scene 9: BMW in moody parking garage
  "https://videos.pexels.com/video-files/7700772/7700772-hd_1920_1080_24fps.mp4",
  // Scene 10: Prestige driving (NEW 7727414)
  "https://videos.pexels.com/video-files/7727414/7727414-hd_1920_1080_25fps.mp4",
  // Scene 11: Sports car at night — moody urban
  "https://videos.pexels.com/video-files/13795953/13795953-hd_1920_1080_30fps.mp4",
  // Scene 12: Sports car speeding — slow closing
  "https://videos.pexels.com/video-files/7727415/7727415-hd_1920_1080_25fps.mp4",
];

const ZOOMS: [number, number][] = [
  [1.02, 1.08], [1.0, 1.05], [1.0, 1.04], [1.04, 1.0],
  [1.0, 1.06], [1.02, 1.0], [1.04, 1.0], [1.0, 1.06],
  [1.0, 1.05], [1.02, 1.0], [1.06, 1.0], [1.02, 1.0],
];

const TRANSITION_COUNT = CLIPS.length - 1;
export const TOTAL_DURATION_V4 =
  CLIPS.length * SCENE_DURATION - TRANSITION_COUNT * TRANSITION_DURATION;

export const HeroVideoV4: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0e0d0b" }}>
      <TransitionSeries>
        {CLIPS.flatMap((src, i) => {
          const scene = (
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={SCENE_DURATION}>
              <CarScene
                src={src}
                zoomFrom={ZOOMS[i][0]}
                zoomTo={ZOOMS[i][1]}
                playbackRate={i === CLIPS.length - 1 ? 0.7 : undefined}
              />
            </TransitionSeries.Sequence>
          );
          if (i === CLIPS.length - 1) return [scene];
          const transition = (
            <TransitionSeries.Transition
              key={`t${i}`}
              presentation={fade()}
              timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
            />
          );
          return [scene, transition];
        })}
      </TransitionSeries>
      <BrandWatermark />
    </AbsoluteFill>
  );
};
