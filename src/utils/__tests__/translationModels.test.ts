import { beforeEach, describe, expect, it, jest } from "@jest/globals";
jest.mock("@/native/lyricDictionary", () => ({ __esModule: true, default: { getTranslationModels: jest.fn(), downloadTranslationModel: jest.fn(), cancelTranslationModel: jest.fn() } }));
jest.mock("jotai", () => {
    const actual = jest.requireActual<typeof import("jotai")>("jotai");
    return { ...actual, getDefaultStore: actual.createStore };
});
import LyricDictionary from "@/native/lyricDictionary";
import { modelDownloadPresentation } from "../modelDownloadPresentation";

let manager: typeof import("@/core/translationModels").default;
let native: typeof LyricDictionary;
const models = (zh = false, ja = false) => [
    { language: "zh" as const, downloaded: zh, downloading: false, error: "", status: "idle" as const },
    { language: "ja" as const, downloaded: ja, downloading: false, error: "", status: "idle" as const },
];
beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.isolateModules(() => {
        const bridge = require("@/native/lyricDictionary").default;
        native = bridge;
        bridge.getTranslationModels.mockResolvedValue(models());
        bridge.downloadTranslationModel.mockResolvedValue(undefined);
        bridge.cancelTranslationModel.mockResolvedValue(undefined);
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
    it("does not let an old failed download overwrite the retried request", async () => {
        let failOld!: (error: Error) => void;
        let finishNew!: () => void;
        jest.mocked(native.downloadTranslationModel)
            .mockReturnValueOnce(new Promise<void>((_, reject) => {
                failOld = reject;
            }))
            .mockReturnValueOnce(new Promise<void>(resolve => {
                finishNew = resolve;
            }));
        const old = manager.download("zh");
        const retry = manager.retry("zh");
        for (let i = 0; i < 20; i++) await Promise.resolve();
        expect(native.cancelTranslationModel).toHaveBeenCalledWith("zh");
        expect(native.downloadTranslationModel).toHaveBeenCalledTimes(2);
        failOld(new Error("旧任务失败"));
        await old;
        expect(manager.state.pending.zh).toBe(true);
        expect(manager.state.failures.zh).toBe("");
        finishNew();
        expect(await retry).toBe(true);
    });
    it("stops the rest of a batch after cancellation", async () => {
        let finish!: () => void;
        jest.mocked(native.downloadTranslationModel).mockReturnValueOnce(new Promise<void>(resolve => {
            finish = resolve;
        }));
        const batch = manager.downloadAll();
        for (let i = 0; i < 20; i++) await Promise.resolve();
        await manager.cancel("zh");
        finish();
        await batch;
        expect(native.downloadTranslationModel).toHaveBeenCalledTimes(1);
        expect(manager.state.batch).toBe(false);
        expect(manager.state.pending.zh).toBe(false);
    });
    it("rebuilds an active request with the new network preference", async () => {
        let finish!: () => void;
        jest.mocked(native.downloadTranslationModel).mockReturnValueOnce(new Promise<void>(resolve => {
            finish = resolve;
        }));
        const old = manager.download("zh");
        await manager.setWifiOnly(false);
        for (let i = 0; i < 20; i++) await Promise.resolve();
        expect(native.cancelTranslationModel).toHaveBeenCalledWith("zh");
        expect(native.downloadTranslationModel).toHaveBeenLastCalledWith("zh", false);
        expect(manager.state.changingNetwork).toBe(false);
        finish(); await old;
    });
    it("will not start a replacement if cancelling the old task fails", async () => {
        jest.mocked(native.cancelTranslationModel).mockRejectedValue(new Error("取消失败"));
        expect(await manager.retry("ja")).toBe(false);
        expect(native.downloadTranslationModel).not.toHaveBeenCalled();
        expect(manager.state.failures.ja).toBe("取消失败");
        expect(manager.state.controls.ja).toBe(false);
    });
    it("does not animate queued Wi-Fi downloads and only shows real byte progress", () => {
        const model = { ...models()[0], status: "waiting_wifi" as const, active: true, downloadedBytes: 1024 * 1024, totalBytes: 4 * 1024 * 1024 };
        const view = modelDownloadPresentation(model, true);
        expect(view.label).toBe("等待 Wi-Fi");
        expect(view.animate).toBe(false);
        expect(view.percent).toBe(25);
        expect(view.progressText).toBe("1.0 MB / 4.0 MB · 25%");
        expect(modelDownloadPresentation({ ...model, status: "running", totalBytes: -1 }, true).animate).toBe(true);
        expect(modelDownloadPresentation({ ...model, status: "pending", totalBytes: -1 }, true).animate).toBe(false);
        expect(modelDownloadPresentation({ ...model, totalBytes: NaN }, true).percent).toBeUndefined();
        expect(modelDownloadPresentation({ ...model, downloaded: true, status: "ready" }, false).label).toBe("已就绪");
    });
});
