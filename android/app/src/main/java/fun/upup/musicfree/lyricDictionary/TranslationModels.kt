package `fun`.upup.musicfree.lyricDictionary

import android.app.DownloadManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.google.android.gms.tasks.Task
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateRemoteModel
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.ForkJoinPool

class TranslationModels(private val context: Context) {
    private val manager = RemoteModelManager.getInstance()
    private class Job(val waiters: CopyOnWriteArrayList<Promise> = CopyOnWriteArrayList())
    private data class Transfer(val id: Long, val state: String, val reason: Int, val bytes: Long, val total: Long)
    private val jobs = ConcurrentHashMap<String, Job>()
    private val resetting = ConcurrentHashMap.newKeySet<String>()
    private val failures = ConcurrentHashMap<String, String>()
    private val cancelled = ConcurrentHashMap.newKeySet<String>()
    @Volatile private var closed = false

    private fun transfers(): Map<String, Transfer> {
        val result = mutableMapOf<String, Transfer>()
        val service = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        // query 默认仅返回本应用 UID 所有的下载；再按官方模型 URL 白名单过滤。
        service.query(DownloadManager.Query())?.use { cursor ->
            while (cursor.moveToNext()) {
                val url = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_URI)) ?: continue
                val language = ModelDownloadStatus.languageForUrl(url) ?: continue
                val id = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_ID))
                if ((result[language]?.id ?: -1L) > id) continue
                val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                result[language] = Transfer(id, ModelDownloadStatus.state(status, reason), reason,
                    cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)).coerceAtLeast(0),
                    cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)))
            }
        }
        return result
    }

    fun snapshot(promise: Promise) {
        if (closed) { promise.reject("MODEL_MANAGER_CLOSED", "模型管理已关闭"); return }
        manager.getDownloadedModels(TranslateRemoteModel::class.java).addOnSuccessListener(ForkJoinPool.commonPool()) { models ->
            val installed = models.map { it.language }.toSet()
            var inspectionError = ""
            val records = try { transfers() } catch (_: Exception) {
                inspectionError = "无法读取系统传输状态，请打开系统下载管理查看。"
                emptyMap()
            }
            val result = Arguments.createArray()
            for (language in listOf("zh", "ja")) {
                val ready = language in installed
                val transfer = records[language]
                val status = when {
                    ready -> "ready"
                    language in resetting -> "resetting"
                    language in cancelled -> "cancelled"
                    failures.containsKey(language) -> "failed"
                    transfer != null -> transfer.state
                    jobs.containsKey(language) -> "preparing"
                    inspectionError.isNotEmpty() -> "unknown"
                    else -> "idle"
                }
                val active = status !in listOf("ready", "idle", "cancelled", "failed")
                result.pushMap(Arguments.createMap().apply {
                    putString("language", language)
                    putBoolean("downloaded", ready)
                    putBoolean("downloading", status == "running")
                    putBoolean("active", active)
                    putString("status", status)
                    putString("statusMessage", when (status) {
                        "ready" -> "模型已就绪，可离线翻译。"
                        "idle" -> "尚未下载"
                        "cancelled" -> "已取消，可以按当前网络设置重新下载。"
                        "resetting" -> "正在取消并清理未完成的模型任务…"
                        else -> failures[language] ?: inspectionError.ifEmpty { ModelDownloadStatus.message(status, transfer?.reason ?: 0) }
                    })
                    putDouble("downloadedBytes", if (ready) 0.0 else transfer?.bytes?.toDouble() ?: 0.0)
                    putDouble("totalBytes", if (ready) -1.0 else transfer?.total?.toDouble() ?: -1.0)
                    putString("error", if (status == "failed") failures[language] ?: ModelDownloadStatus.message(status, transfer?.reason ?: 0) else "")
                })
            }
            promise.resolve(result)
        }.addOnFailureListener { error -> promise.reject("MODEL_STATUS_FAILED", error.message, error) }
    }

    private fun hasWifi(): Boolean {
        val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        return connectivity.allNetworks.any { network ->
            val capabilities = connectivity.getNetworkCapabilities(network)
            capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        }
    }

    @Synchronized fun download(language: String, wifiOnly: Boolean, promise: Promise) {
        if (closed) { promise.reject("MODEL_MANAGER_CLOSED", "模型管理已关闭"); return }
        if (language !in listOf("zh", "ja")) { promise.reject("INVALID_MODEL", "仅支持中文和日文模型，英文已内置"); return }
        if (language in resetting) { promise.reject("MODEL_RESETTING", "正在取消旧任务，请稍后再试"); return }
        jobs[language]?.let { it.waiters.add(promise); return }
        val job = Job(CopyOnWriteArrayList(listOf(promise)))
        try {
            if (wifiOnly && !hasWifi()) {
                val message = "仅 Wi-Fi 下载已开启。请连接 Wi-Fi，或关闭该选项后重试（会使用流量）。"
                failures[language] = message
                promise.reject("MODEL_WIFI_REQUIRED", message)
                return
            }
            cancelled.remove(language)
            failures.remove(language)
            jobs[language] = job
            val conditions = DownloadConditions.Builder().apply { if (wifiOnly) requireWifi() }.build()
            manager.download(TranslateRemoteModel.Builder(language).build(), conditions).addOnCompleteListener { task ->
                synchronized(this@TranslationModels) {
                    if (!jobs.remove(language, job)) return@synchronized
                    if (task.isSuccessful) {
                        failures.remove(language)
                        job.waiters.forEach { it.resolve(null) }
                    } else {
                        val message = if (task.isCanceled) "模型下载已取消" else describeFailure(task.exception ?: Exception("未知下载错误"))
                        failures[language] = message
                        job.waiters.forEach { it.reject(if (task.isCanceled) "MODEL_CANCELLED" else "MODEL_DOWNLOAD_FAILED", message) }
                    }
                }
            }
        } catch (error: Exception) {
            jobs.remove(language, job)
            val message = describeFailure(error)
            failures[language] = message
            promise.reject("MODEL_DOWNLOAD_FAILED", message, error)
        }
    }

    @Synchronized fun cancel(language: String, promise: Promise) {
        if (closed) { promise.reject("MODEL_MANAGER_CLOSED", "模型管理已关闭"); return }
        if (language !in listOf("zh", "ja")) { promise.reject("INVALID_MODEL", "仅能重置中文或日文翻译模型任务"); return }
        if (!resetting.add(language)) { promise.reject("MODEL_RESETTING", "正在取消旧任务，请稍后再试"); return }
        // 旧回调用 job 身份校验，不能覆盖重试后的新任务。
        jobs.remove(language)?.waiters?.forEach { it.reject("MODEL_CANCELLED", "模型下载已取消") }
        val model = TranslateRemoteModel.Builder(language).build()
        try {
            manager.isModelDownloaded(model).continueWithTask { task ->
                if (!task.isSuccessful) throw task.exception ?: Exception("无法确认模型是否就绪")
                // 已安装模型不删除。SDK 公共接口会取消未就绪模型的排队任务并清理半成品。
                if (task.result == true) com.google.android.gms.tasks.Tasks.forResult<Void>(null)
                else manager.deleteDownloadedModel(model)
            }.addOnCompleteListener { task ->
                synchronized(this@TranslationModels) {
                    resetting.remove(language)
                    if (task.isSuccessful) {
                        failures.remove(language)
                        cancelled.add(language)
                        promise.resolve(null)
                    } else {
                        val message = "取消任务失败：${task.exception?.message ?: "未知错误"}，请打开系统下载管理处理。"
                        failures[language] = message
                        promise.reject("MODEL_CANCEL_FAILED", message)
                    }
                }
            }
        } catch (error: Exception) {
            resetting.remove(language)
            failures[language] = "取消任务失败：${error.message}"
            promise.reject("MODEL_CANCEL_FAILED", failures[language], error)
        }
    }

    fun requireInstalled(source: String): Task<Void> = manager.getDownloadedModels(TranslateRemoteModel::class.java).continueWith<Void> { task ->
        if (!task.isSuccessful) throw task.exception ?: Exception("无法读取模型状态")
        val installed = task.result.map { it.language }.toSet()
        if ("zh" !in installed || (source == "ja" && "ja" !in installed)) {
            throw IllegalStateException("翻译模型未下载，请到 设置 → 学习模型 下载${if (source == "ja") "中文和日文" else "中文"}模型。")
        }
        null
    }

    private fun describeFailure(error: Exception): String {
        val details = generateSequence<Throwable>(error) { it.cause }.take(4).mapNotNull { it.message }.distinct().joinToString("；").take(800)
        return "模型下载失败：${details.ifBlank { error.javaClass.simpleName }}。请检查网络、剩余存储和系统下载管理的大文件限制。"
    }

    fun close() { closed = true }
}
