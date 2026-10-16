import type { IParsedLrcItem } from "./lrcParser";

export type LearningLanguage = "en" | "ja" | "zh" | "yue";
export type LearningLanguageChoice = LearningLanguage | "auto";
export const learningLanguageLabels: Record<LearningLanguageChoice, string> = { auto: "自动", en: "英语", ja: "日语", zh: "普通话", yue: "粤语" };
export function validLearningLanguage(value: unknown): LearningLanguageChoice {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(learningLanguageLabels, value) ? value as LearningLanguageChoice : "auto";
}
export const hasJapanese = (text: string) => /[\u3040-\u30ff]/.test(text);
export const hasChineseTranslation = (text?: string) => !!text && /[\u3400-\u9fff]/.test(text) && !hasJapanese(text);

export function learningLanguage(text: string, songLanguage: LearningLanguage = "en"): LearningLanguage {
    if (hasJapanese(text)) return "ja";
    if (songLanguage === "yue" && /[\u3400-\u9fff]/.test(text)) return "yue";
    if (/[A-Za-z]/.test(text)) return "en";
    if (/[\u3400-\u9fff]/.test(text)) return songLanguage === "ja" || songLanguage === "yue" ? songLanguage : "zh";
    return songLanguage;
}

export function learningLines(lyrics: IParsedLrcItem[]): IParsedLrcItem[] {
    const result: IParsedLrcItem[] = [];
    for (const item of lyrics) {
        if (!item.lrc.trim()) continue;
        const previous = result[result.length - 1];
        if (previous && Math.abs(previous.time - item.time) < 0.01 &&
            /[A-Za-z\u3040-\u30ff]/.test(previous.lrc) && hasChineseTranslation(item.lrc)) {
            result[result.length - 1] = { ...previous, translation: previous.translation || item.lrc };
        } else result.push({ ...item });
    }
    return result;
}
