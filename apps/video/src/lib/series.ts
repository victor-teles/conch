export interface SceneTiming {
  scenes: readonly number[];
  transition: number;
}

export const seriesDuration = ({ scenes, transition }: SceneTiming): number =>
  scenes.reduce((total, scene) => total + scene, 0) -
  transition * Math.max(scenes.length - 1, 0);

export const sequenceStarts = ({
  scenes,
  transition,
}: SceneTiming): number[] => {
  const starts: number[] = [];
  let next = 0;
  for (const scene of scenes) {
    starts.push(next);
    next += scene - transition;
  }
  return starts;
};
