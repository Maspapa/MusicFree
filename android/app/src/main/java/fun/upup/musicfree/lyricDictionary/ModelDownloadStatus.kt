package `fun`.upup.musicfree.lyricDictionary

import android.app.DownloadManager
import java.net.URI

// 仅识别锁定版本 SDK 使用的官方翻译模型地址，不碰其他下载。
internal object ModelDownloadStatus {
    fun languageForUrl(raw: String): String? = try {
        val uri = URI(raw)
        val prefix = when (uri.host) {
            "redirector.gvt1.com" -> "/edgedl/translate/offline/"
            "dl.google.com" -> "/translate/offline/"
            else -> ""
        }
        if (uri.scheme != "https" || uri.userInfo != null || uri.port != -1 || prefix.isEmpty() || !uri.path.startsWith(prefix)) null
        else Regex("v[0-9]+/high/r[0-9]+/(en_zh|zh_en|en_ja|ja_en)\\.zip").matchEntire(uri.path.removePrefix(prefix))?.groupValues?.get(1)?.let {
            if (it.contains("zh")) "zh" else "ja"
        }
    } catch (_: Exception) { null }

    fun state(status: Int, reason: Int): String = when (status) {
        DownloadManager.STATUS_PENDING -> "pending"
        DownloadManager.STATUS_RUNNING -> "running"
        DownloadManager.STATUS_SUCCESSFUL -> "installing"
        DownloadManager.STATUS_FAILED -> "failed"
        DownloadManager.STATUS_PAUSED -> when (reason) {
            DownloadManager.PAUSED_QUEUED_FOR_WIFI -> "waiting_wifi"
            DownloadManager.PAUSED_WAITING_FOR_NETWORK -> "waiting_network"
            DownloadManager.PAUSED_WAITING_TO_RETRY -> "retrying"
            else -> "paused"
        }
        else -> "unknown"
    }

    fun message(state: String, reason: Int = 0): String = when (state) {
        "running" -> "正在传输模型文件"
        "waiting_wifi" -> "系统因移动网络文件大小限制暂停，正在等待 Wi-Fi。关闭应用内仅 Wi-Fi 不能绕过系统限制；请连接可用 Wi-Fi，或在系统下载管理中允许继续。"
        "waiting_network" -> "系统正在等待可用网络；尚未进行文件传输。"
        "retrying" -> "网络请求失败，系统等待稍后重试。"
        "pending" -> "已加入系统下载队列，等待开始。"
        "installing" -> "文件传输完成，正在校验／安装模型，尚未就绪。"
        "paused" -> "系统已暂停下载，请打开系统下载管理查看原因。"
        "failed" -> "系统下载失败（错误码 $reason），可重试。"
        else -> "正在准备或检查模型，暂时无法确认传输状态；若长期无变化，可取消并按当前设置重试。"
    }
}
