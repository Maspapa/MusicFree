import { beforeEach, describe, expect, it, jest } from "@jest/globals";
jest.mock("@/utils/getOrCreateMMKV", () => {
    const stores = new Map<string, Map<string, string>>();
    return { __esModule: true, default: (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const data = stores.get(name)!;
        return { getString: (key: string) => data.get(key), set: (key: string, value: string) => data.set(key, value) };
    } };
});
jest.mock("@/utils/mediaUtils", () => ({ getMediaUniqueKey: (item: { platform: string; id: string }) => JSON.stringify([item.platform, item.id]) }));
import { getMediaExtraProperty, patchMediaExtra } from "../mediaExtra";
import { tokenizeLearningLine } from "../learningTokens";
import LyricDictionary from "@/native/lyricDictionary";
jest.mock("@/native/lyricDictionary", () => ({ __esModule: true, default: { tokenizeChinese: jest.fn(async () => [{ text: "你好", isWord: true }]), tokenizeJapanese: jest.fn(async () => [{ text: "東京", isWord: true }]) } }));

beforeEach(() => {
    jest.clearAllMocks(); 
});
describe("per-song learning language", () => {
    it("persists the selected language without replacing other song metadata or affecting other songs", () => {
        const song = { platform: "test", id: "first" };
        patchMediaExtra(song, { lyricOffset: 2.5, learningLanguage: "yue" });
        patchMediaExtra(song, { learningLanguage: "zh" });
        expect(getMediaExtraProperty({ ...song }, "learningLanguage")).toBe("zh");
        expect(getMediaExtraProperty(song, "lyricOffset")).toBe(2.5);
        expect(getMediaExtraProperty({ platform: "other", id: "first" }, "learningLanguage")).toBeNull();
        expect(getMediaExtraProperty({ platform: "test", id: "second" }, "learningLanguage")).toBeNull();
        patchMediaExtra(song, { learningLanguage: "auto" });
        expect(getMediaExtraProperty(song, "learningLanguage")).toBe("auto");
    });
    it("routes Cantonese and Mandarin to Chinese segmentation, never the Japanese tokenizer", async () => {
        await tokenizeLearningLine("你好", "yue");
        await tokenizeLearningLine("你好", "zh");
        expect(LyricDictionary.tokenizeChinese).toHaveBeenCalledTimes(2);
        expect(LyricDictionary.tokenizeJapanese).not.toHaveBeenCalled();
        await tokenizeLearningLine("東京", "ja");
        expect(LyricDictionary.tokenizeJapanese).toHaveBeenCalledWith("東京");
        expect(await tokenizeLearningLine("Hello!", "en")).toEqual([{ text: "Hello", isWord: true }, { text: "!", isWord: false }]);
    });
});
