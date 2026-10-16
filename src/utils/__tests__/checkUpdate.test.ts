import { beforeEach, describe, expect, it, jest } from "@jest/globals";
jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("react-native-device-info", () => ({ __esModule: true, default: { getVersion: jest.fn(() => "0.6.2-maspapa.6"), supportedAbis: jest.fn(async () => ["arm64-v8a"]) } }));
import axios from "axios";
import DeviceInfo from "react-native-device-info";
import checkUpdate, { RELEASES_URL } from "../checkUpdate";
function release(version = "0.6.2-maspapa.7") {
    return { tag_name: `v${version}`, draft: false, prerelease: false, body: "更新说明", assets: ["arm64-v8a", "universal"].map(arch => ({ name: `MusicFree-${version}-${arch}.apk`, state: "uploaded", browser_download_url: `https://github.com/Maspapa/MusicFree/releases/download/v${version}/MusicFree-${version}-${arch}.apk` })) };
}
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(DeviceInfo.getVersion).mockReturnValue("0.6.2-maspapa.6");
    jest.mocked(DeviceInfo.supportedAbis).mockResolvedValue(["arm64-v8a"]);
    jest.mocked(axios.get).mockResolvedValue({ data: release() });
});
describe("Maspapa APK updates", () => {
    it("checks only our GitHub and selects the ARM64 direct APK link", async () => {
        const result = await checkUpdate();
        expect(axios.get).toHaveBeenCalledWith("https://api.github.com/repos/Maspapa/MusicFree/releases/latest", expect.objectContaining({ timeout: 12000 }));
        expect(result.needUpdate).toBe(true);
        expect(result.data.download[0]).toContain("maspapa.7-arm64-v8a.apk");
        expect(result.data.download[1]).toBe(RELEASES_URL);
    });
    it("compares numeric fork versions correctly", async () => {
        jest.mocked(DeviceInfo.getVersion).mockReturnValue("0.6.2-maspapa.9");
        jest.mocked(axios.get).mockResolvedValue({ data: release("0.6.2-maspapa.10") });
        expect((await checkUpdate()).needUpdate).toBe(true);
    });
    it("does not downgrade or reoffer the installed version", async () => {
        jest.mocked(DeviceInfo.getVersion).mockReturnValue("0.6.2-maspapa.7");
        expect((await checkUpdate()).needUpdate).toBe(false);
        jest.mocked(DeviceInfo.getVersion).mockReturnValue("0.6.2-maspapa.8");
        expect((await checkUpdate()).needUpdate).toBe(false);
    });
    it("selects universal on other architectures or failed ABI detection", async () => {
        jest.mocked(DeviceInfo.supportedAbis).mockResolvedValue(["x86_64"]);
        expect((await checkUpdate()).data.download[0]).toContain("-universal.apk");
        jest.mocked(DeviceInfo.supportedAbis).mockRejectedValue(Error("unknown ABI"));
        expect((await checkUpdate()).data.download[0]).toContain("-universal.apk");
    });
    it("falls back to universal when ARM64 is missing", async () => {
        const data = release(); data.assets.shift();
        jest.mocked(axios.get).mockResolvedValue({ data });
        expect((await checkUpdate()).data.download[0]).toContain("-universal.apk");
    });
    it("rejects untrusted APK URLs and missing build artifacts", async () => {
        const data = release();
        data.assets.forEach(asset => {
            asset.browser_download_url = "https://example.com/untrusted.apk";
        });
        jest.mocked(axios.get).mockResolvedValue({ data });
        await expect(checkUpdate()).rejects.toThrow("no compatible APK");
    });
    it("does not mistake failed requests for already up to date", async () => {
        jest.mocked(axios.get).mockRejectedValue(Error("network unavailable"));
        await expect(checkUpdate()).rejects.toThrow("network unavailable");
    });
    it("rejects upstream, draft and prerelease metadata", async () => {
        for (const data of [{ ...release(), tag_name: "v0.6.3" }, { ...release(), draft: true }, { ...release(), prerelease: true }]) {
            jest.mocked(axios.get).mockResolvedValue({ data });
            await expect(checkUpdate()).rejects.toThrow("Invalid Maspapa release");
        }
    });
});
