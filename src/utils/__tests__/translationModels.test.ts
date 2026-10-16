import { beforeEach, describe, expect, it, jest } from "@jest/globals";
jest.mock("@/native/lyricDictionary", () => ({ __esModule: true, default: { getTranslationModels: jest.fn(), downloadTranslationModel: jest.fn() } }));
jest.mock("jotai", () => {
    const actual = jest.requireActual<typeof import("jotai")>("jotai");
    return { ...actual, getDefaultStore: actual.createStore };
});
import LyricDictionary from "@/native/lyricDictionary";

let manager: typeof import("@/core/translationModels").default;
let native: typeof LyricDictionary;
const models = (zh = false, ja = false) => [
    { language: "zh" as const, downloaded: zh, downloading: false, error: "" },
    { language: "ja" as const, downloaded: ja, downloading: false, error: "" },
];
beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.isolateModules(() => {
        const bridge = require("@/native/lyricDictionary").default;
        native = bridge;
        bridge.getTranslationModels.mockResolvedValue(models());
        bridge.downloadTranslationModel.mockResolvedValue(undefined);
        manager = require("@/core/translationModels").default;
    });
});

describe("translation model downloads", () => {
    it("starts with Wi-Fi only and no invented download percentage", () => {
        expect(manager.state.wifiOnly).toBe(true);
        expect(manager.state.models).toEqual(models());
        expect(manager.state).not.toHaveProperty("percent");
    });
    it("loads installed models and skips them in a batch", async () => {
        jest.mocked(native.getTranslationModels).mockResolvedValue(models(true));
        await manager.downloadAll();
        expect(native.downloadTranslationModel).toHaveBeenCalledTimes(1);
        expect(native.downloadTranslationModel).toHaveBeenCalledWith("ja", true);
        expect(manager.state.batch).toBe(false);
    });
    it("preserves failures, stops the batch and permits retry over mobile data", async () => {
        jest.mocked(native.downloadTranslationModel).mockRejectedValueOnce(new Error("文件过大"));
        await manager.downloadAll();
        expect(native.downloadTranslationModel).toHaveBeenCalledTimes(1);
        expect(manager.state.failures.zh).toBe("文件过大");
        expect(manager.state.pending.zh).toBe(false);
        manager.setWifiOnly(false);
        await manager.download("zh");
        expect(native.downloadTranslationModel).toHaveBeenLastCalledWith("zh", false);
        expect(manager.state.failures.zh).toBe("");
    });
    it("deduplicates downloads and keeps state while a request is pending", async () => {
        let finish!: () => void;
        jest.mocked(native.downloadTranslationModel).mockReturnValueOnce(new Promise<void>(resolve => {
            finish = resolve; 
        }));
        const first = manager.download("ja");
        expect(manager.state.pending.ja).toBe(true);
        expect(await manager.download("ja")).toBe(false);
        expect(native.downloadTranslationModel).toHaveBeenCalledTimes(1);
        finish();
        expect(await first).toBe(true);
        expect(manager.state.pending.ja).toBe(false);
    });
    it("does not start downloads when model status cannot be read", async () => {
        jest.mocked(native.getTranslationModels).mockRejectedValue(new Error("状态不可用"));
        await manager.downloadAll();
        expect(native.downloadTranslationModel).not.toHaveBeenCalled();
        expect(manager.state.error).toBe("状态不可用");
        expect(manager.state.batch).toBe(false);
    });
});
