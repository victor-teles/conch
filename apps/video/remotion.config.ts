import { Config } from "@remotion/cli/config";
/* oxlint-disable jest/require-hook -- Remotion reads its config from top-level calls */
import path from "node:path";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      "@": path.join(process.cwd(), "src"),
    },
  },
}));
