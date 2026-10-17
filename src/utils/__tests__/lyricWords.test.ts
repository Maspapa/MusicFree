import { describe, expect, it } from "@jest/globals";
import { normalizeLyricWord, tokenizeLyricLine, tokenizeLyricFallback } from "../lyricWords";

describe("lyric word tokenization", () => {
    it("分词不可用时仍能点选中日文片段，且保留标点与空格", () => {
        const text = "私の歌、Hello！ 海闊天空";
        const tokens = tokenizeLyricFallback(text);
        expect(tokens.map(token => token.text).join("")).toBe(text);
        expect(tokens.filter(token => token.isWord).map(token => token.text)).toEqual(["私の歌", "Hello", "海闊天空"]);
        expect(tokenizeLyricFallback("！？ ").every(token => !token.isWord)).toBe(true);
    });
    it("preserves punctuation and spaces while exposing English words", () => {
        expect(tokenizeLyricLine("Don't stop, well-being! 爱你")).toEqual([
            { text: "Don't", isWord: true },
            { text: " ", isWord: false },
            { text: "stop", isWord: true },
            { text: ", ", isWord: false },
            { text: "well-being", isWord: true },
            { text: "! 爱你", isWord: false },
        ]);
    });

    it("normalizes curly apostrophes and edge punctuation", () => {
        expect(normalizeLyricWord("(DON’T!)")).toBe("don't");
    });

    it("leaves non-English lyrics as a single plain token", () => {
        expect(tokenizeLyricLine("夜空中最亮的星")).toEqual([
            { text: "夜空中最亮的星", isWord: false },
        ]);
    });
});
