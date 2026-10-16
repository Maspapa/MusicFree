import axios from "axios";
import { compare } from "compare-versions";
import DeviceInfo from "react-native-device-info";

export const RELEASES_URL = "https://github.com/Maspapa/MusicFree/releases/latest";
const RELEASES_API = "https://api.github.com/repos/Maspapa/MusicFree/releases/latest";
interface IReleaseAsset { name: string; state: string; browser_download_url: string }

interface IUpdateInfo {
    needUpdate: boolean;
    data: {
        version: string;
        changeLog: string[];
        download: string[];
    };
}

export default async function checkUpdate(): Promise<IUpdateInfo> {
    const { data: release } = await axios.get(RELEASES_API, { timeout: 12000, headers: { Accept: "application/vnd.github+json" } });
    const tag = typeof release?.tag_name === "string" ? release.tag_name : "";
    if (release?.draft || release?.prerelease || !/^v\d+\.\d+\.\d+-maspapa\.\d+$/.test(tag)) throw new Error("Invalid Maspapa release");
    const version = tag.slice(1);
    const needUpdate = compare(version, DeviceInfo.getVersion(), ">");
    const changeLog = typeof release.body === "string" && release.body.trim()
        ? release.body.trim().slice(0, 6000).split(/\r?\n/).filter(Boolean) : ["Maspapa 歌词学习版更新"];
    if (!needUpdate) return { needUpdate: false, data: { version, changeLog, download: [] } };
    const abis = await DeviceInfo.supportedAbis().catch(() => [] as string[]);
    const preferred = abis[0] === "arm64-v8a" ? "arm64-v8a" : "universal";
    const assets: IReleaseAsset[] = Array.isArray(release.assets) ? release.assets : [];
    const findApk = (architecture: string) => {
        const name = `MusicFree-${version}-${architecture}.apk`;
        const url = `https://github.com/Maspapa/MusicFree/releases/download/${tag}/${name}`;
        return assets.find(asset => asset?.name === name && asset.state === "uploaded" && asset.browser_download_url === url)?.browser_download_url;
    };
    const apk = findApk(preferred) || findApk("universal");
    if (!apk) throw new Error("Latest release has no compatible APK");
    return { needUpdate: true, data: { version, changeLog, download: [apk, RELEASES_URL] } };
}
