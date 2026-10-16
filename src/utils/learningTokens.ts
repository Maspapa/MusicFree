import LyricDictionary from "@/native/lyricDictionary";
import { LearningLanguage } from "./learningLyrics";
import { ILyricToken, tokenizeLyricLine } from "./lyricWords";

export function tokenizeLearningLine(text: string, language: LearningLanguage): Promise<ILyricToken[]> {
    if (language === "ja") return LyricDictionary.tokenizeJapanese(text);
    if (language === "zh" || language === "yue") return LyricDictionary.tokenizeChinese(text);
    return Promise.resolve(tokenizeLyricLine(text));
}
