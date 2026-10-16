import { ITranslationModel, ModelDownloadState } from "@/native/lyricDictionary";

const labels: Record<ModelDownloadState, string> = {
    idle: "未下载", ready: "已就绪", running: "下载中", pending: "等待开始", preparing: "准备中",
    waiting_wifi: "等待 Wi-Fi", waiting_network: "等待网络", retrying: "等待重试", paused: "已暂停",
    installing: "校验／安装中", failed: "下载失败", unknown: "状态未知", resetting: "取消中", cancelled: "已取消",
};
export function modelDownloadPresentation(model: ITranslationModel, pending: boolean) {
    const status: ModelDownloadState = model.downloaded ? "ready" : pending && (!model.status || ["idle", "cancelled", "failed"].includes(model.status)) ? "preparing" : model.status ?? (model.error ? "failed" : "idle");
    const bytes = Number.isFinite(model.downloadedBytes) ? Math.max(0, model.downloadedBytes!) : 0;
    const total = Number.isFinite(model.totalBytes) && model.totalBytes! > 0 ? model.totalBytes! : undefined;
    const percent = total ? Math.min(100, Math.floor(bytes / total * 100)) : undefined;
    const mb = (value: number) => `${(value / 1024 / 1024).toFixed(1)} MB`;
    return {
        status, label: labels[status] ?? "状态未知",
        active: !model.downloaded && (pending || model.active || model.downloading || false),
        // 只有 Android 确认传输中才播放动画，暂停/排队/未知状态不能伪装成下载。
        animate: status === "running" && total === undefined,
        percent,
        progressText: total ? `${mb(bytes)} / ${mb(total)} · ${percent}%` : bytes > 0 ? `已传输 ${mb(bytes)}，总大小未知` : "",
    };
}
