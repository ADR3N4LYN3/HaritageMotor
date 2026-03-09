import { Composition } from "remotion";
import { HeroVideo, TOTAL_DURATION } from "./HeroVideo";
import { HeroVideoV2, TOTAL_DURATION_V2 } from "./HeroVideoV2";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HeroVideo"
        component={HeroVideo}
        durationInFrames={TOTAL_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="HeroVideoV2"
        component={HeroVideoV2}
        durationInFrames={TOTAL_DURATION_V2}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
