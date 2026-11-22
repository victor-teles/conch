export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Rgba extends Rgb {
  a: number;
}

const NUMBER = String.raw`\d+(?:\.\d+)?`;

export const HEX_COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;
export const OKLCH_COLOR = new RegExp(
  `^oklch\\((${NUMBER}%?) (${NUMBER}) (${NUMBER})(?:deg)?(?: / (${NUMBER}%?))?\\)$`
);

export const isThemeColor = (value: string): boolean =>
  HEX_COLOR.test(value) || OKLCH_COLOR.test(value);

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const encodeSrgb = (linear: number): number => {
  const x = clamp01(linear);
  return x <= 0.003_130_8 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
};

const decodeSrgb = (encoded: number): number =>
  encoded <= 0.040_45 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;

const oklchToRgb = (l: number, c: number, h: number): Rgb => {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const lCubed = (l + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
  const mCubed = (l - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
  const sCubed = (l - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
  return {
    b: encodeSrgb(
      -0.004_196_086_3 * lCubed -
        0.703_418_614_7 * mCubed +
        1.707_614_701 * sCubed
    ),
    g: encodeSrgb(
      -1.268_438_004_6 * lCubed +
        2.609_757_401_1 * mCubed -
        0.341_319_396_5 * sCubed
    ),
    r: encodeSrgb(
      4.076_741_661_2 * lCubed -
        3.307_711_591_3 * mCubed +
        0.230_969_929 * sCubed
    ),
  };
};

const fraction = (raw: string): number =>
  raw.endsWith("%") ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);

const channel = (hex: string, at: number): number =>
  Number.parseInt(hex.slice(at, at + 2), 16) / 255;

const parseHex = (value: string): Rgba => ({
  a: value.length === 9 ? channel(value, 7) : 1,
  b: channel(value, 5),
  g: channel(value, 3),
  r: channel(value, 1),
});

export const parseThemeColor = (value: string): Rgba | null => {
  if (HEX_COLOR.test(value)) {
    return parseHex(value);
  }
  const match = value.match(OKLCH_COLOR);
  if (!match) {
    return null;
  }
  const [, l = "0", c = "0", h = "0", alpha] = match;
  const rgb = oklchToRgb(fraction(l), Number(c), Number(h));
  return { ...rgb, a: alpha ? clamp01(fraction(alpha)) : 1 };
};

const hexByte = (value: number): string =>
  Math.round(clamp01(value) * 255)
    .toString(16)
    .padStart(2, "0");

export const toHex = (color: Rgba): string => {
  const rgb = `#${hexByte(color.r)}${hexByte(color.g)}${hexByte(color.b)}`;
  return color.a < 1 ? `${rgb}${hexByte(color.a)}` : rgb;
};

export const compositeOver = (top: Rgba, base: Rgb): Rgba => ({
  a: 1,
  b: top.b * top.a + base.b * (1 - top.a),
  g: top.g * top.a + base.g * (1 - top.a),
  r: top.r * top.a + base.r * (1 - top.a),
});

const luminance = ({ r, g, b }: Rgb): number =>
  0.2126 * decodeSrgb(r) + 0.7152 * decodeSrgb(g) + 0.0722 * decodeSrgb(b);

export const contrastRatio = (one: Rgb, two: Rgb): number => {
  const first = luminance(one);
  const second = luminance(two);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
};
