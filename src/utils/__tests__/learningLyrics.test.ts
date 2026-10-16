import { describe, expect, it } from "@jest/globals";
import { learningLanguage, learningLines, hasChineseTranslation } from "../learningLyrics";

describe("learning lyrics", () => {
    it("keeps lines usable without a synchronized timeline", () => {
        expect(learningLines([{ time: 0, lrc: "Hello", index: 0 }])).toHaveLength(1);
    });
    it("combines a timestamp-aligned Chinese translation without reading it as another line", () => {
        expect(learningLines([
            { time: 10, lrc: "Hello", index: 0 },
            { time: 10, lrc: "你好", index: 1 },
            { time: 20, lrc: "Goodbye", index: 2 },
        ])).toEqual([
            { time: 10, lrc: "Hello", translation: "你好", index: 0 },
            { time: 20, lrc: "Goodbye", index: 2 },
        ]);
    });
    it("selects English and Japanese voices and uses Japanese song context for kanji", () => {
        expect(learningLanguage("Hello world", "ja")).toBe("en");
        expect(learningLanguage("君が好き")).toBe("ja");
        expect(learningLanguage("東京", "ja")).toBe("ja");
        expect(learningLanguage("你好")).toBe("zh");
    });
    it("does not mistake romanization or Japanese text for a Chinese translation", () => {
        expect(hasChineseTranslation("君が好き")).toBe(false);
        expect(hasChineseTranslation("kimi ga suki")).toBe(false);
        expect(hasChineseTranslation("我喜欢你")).toBe(true);
    });
});
