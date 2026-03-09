import { Composition } from "remotion";
import { HeroVideoV2, TOTAL_DURATION_V2 } from "./HeroVideoV2";
import { HeroVideoV3, TOTAL_DURATION_V3 } from "./HeroVideoV3";
import { HeroVideoV4, TOTAL_DURATION_V4 } from "./HeroVideoV4";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HeroVideoV2"
        component={HeroVideoV2}
        durationInFrames={TOTAL_DURATION_V2}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="HeroVideoV3"
        component={HeroVideoV3}
        durationInFrames={TOTAL_DURATION_V3}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="HeroVideoV4"
        component={HeroVideoV4}
        durationInFrames={TOTAL_DURATION_V4}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
