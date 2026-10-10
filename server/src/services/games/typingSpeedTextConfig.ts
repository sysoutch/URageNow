export const typingGameMinWords = 20;
export const typingGameMaxWords = 100;
export const typingGameMaxTexts = 30;
export const typingGameMaxTextLength = 600;

export type TypingTextMode = "sequential" | "random" | "shuffle";
export type TypingTextConfig = { texts: string[]; textMode: TypingTextMode };

export function resolveTypingTextConfig(configuration: Record<string, unknown>): TypingTextConfig {
  const texts = configuration.texts === undefined ? [configuration.text] : configuration.texts;
  if (!Array.isArray(texts) || texts.length < 1 || texts.length > typingGameMaxTexts) {
    throw new Error(`Typing game needs 1-${typingGameMaxTexts} texts.`);
  }
  const validated = texts.map((value, index) => {
    if (typeof value !== "string") throw new Error(`Text ${index + 1} must be a string.`);
    const text = value.trim();
    const wordCount = (text.match(/\S+/gu) || []).length;
    if (text.length > typingGameMaxTextLength || wordCount < typingGameMinWords || wordCount > typingGameMaxWords) {
      throw new Error(`Text ${index + 1} must contain ${typingGameMinWords}-${typingGameMaxWords} words and at most ${typingGameMaxTextLength} characters.`);
    }
    return text;
  });
  const textMode = configuration.textMode === undefined ? "sequential" : configuration.textMode;
  if (textMode !== "sequential" && textMode !== "random" && textMode !== "shuffle") {
    throw new Error("Typing game text mode must be sequential, random, or shuffle.");
  }
  return { texts: validated, textMode };
}

export function selectTypingRoundTexts(config: TypingTextConfig, rounds: number, random = Math.random): string[] {
  const result: string[] = [];
  let bag: number[] = [];
  for (let round = 0; round < rounds; round += 1) {
    if (config.textMode === "sequential") {
      result.push(config.texts[round % config.texts.length]!);
      continue;
    }
    if (config.textMode === "random") {
      result.push(config.texts[Math.floor(random() * config.texts.length)]!);
      continue;
    }
    if (!bag.length) {
      bag = config.texts.map((_, index) => index);
      for (let index = bag.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [bag[index], bag[swapIndex]] = [bag[swapIndex]!, bag[index]!];
      }
    }
    result.push(config.texts[bag.pop()!]!);
  }
  return result;
}
