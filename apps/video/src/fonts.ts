import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/mona-sans";
import { cancelRender, continueRender, delayRender } from "remotion";

const FACES = [
  '450 16px "Mona Sans Variable"',
  '560 16px "Mona Sans Variable"',
  '400 16px "JetBrains Mono Variable"',
];

export const waitForFonts = async (): Promise<void> => {
  const handle = delayRender("Loading Mona Sans and JetBrains Mono");
  try {
    await Promise.all(FACES.map((face) => document.fonts.load(face)));
    continueRender(handle);
  } catch (error) {
    cancelRender(error);
  }
};
