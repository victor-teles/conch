export const typedText = (
  text: string,
  frame: number,
  start: number,
  framesPerChar: number
): string => {
  if (frame < start) {
    return "";
  }
  const count = Math.floor((frame - start) / framesPerChar) + 1;
  return text.slice(0, Math.min(count, text.length));
};

export const streamedText = (
  text: string,
  frame: number,
  start: number,
  charsPerFrame: number
): string => {
  if (frame < start) {
    return "";
  }
  return text.slice(0, Math.ceil((frame - start + 1) * charsPerFrame));
};

export const typingEnd = (
  text: string,
  start: number,
  framesPerChar: number
): number => start + (text.length - 1) * framesPerChar;
