import { Composition } from "remotion";
import { HeroVideo, TOTAL_DURATION } from "./HeroVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="HeroVideo"
      component={HeroVideo}
      durationInFrames={TOTAL_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
