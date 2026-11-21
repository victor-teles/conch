export const wait = async (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  await promise;
};

export const checksDrawn = (container: Element): boolean =>
  [...container.querySelectorAll("path[pathLength]")].every(
    (path) => path.getAttribute("stroke-dasharray") === "1 1"
  );

export const swapsSettled = (container: Element): boolean =>
  container.querySelector('[data-slot="swap-text"] > span + span') === null;

export const nextFrame = async (): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  requestAnimationFrame(() => resolve());
  await promise;
};
