import { registerRoot } from "remotion";

import { waitForFonts } from "./fonts";
import { RemotionRoot } from "./root";

// oxlint-disable-next-line jest/require-hook -- Remotion holds frame 0 until this resolves
waitForFonts();
// oxlint-disable-next-line jest/require-hook -- Remotion's entry point
registerRoot(RemotionRoot);
