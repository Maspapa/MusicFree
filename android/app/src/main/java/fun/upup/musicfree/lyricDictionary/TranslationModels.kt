package `fun`.upup.musicfree.lyricDictionary

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

// 英文模型内置，不可下载或删除；英译中只需中文，日译中需中文和日文。
class TranslationModels(private val context: Context) {
    private val manager = RemoteModelManager.getInstance()
    private val downloads = ConcurrentHashMap<String, Task<Void>>()
    private val failures = ConcurrentHashMap<String, String>()
    @Volatile private var closed = false

    fun snapshot(promise: Promise) {
        if (closed) { promise.reject("MODEL_MANAGER_CLOSED", "模型管理已关闭"); return }
        manager.getDownloadedModels(TranslateRemoteModel::class.java)
            .addOnSuccessListener { models ->
                val installed = models.map { it.language }.toSet()
                val result = Arguments.createArray()
                for (language in listOf("zh", "ja")) {
                    val ready = language in installed
                    result.pushMap(Arguments.createMap().apply {
                        putString("language", language)
                        putBoolean("downloaded", ready)
                        putBoolean("downloading", !ready && downloads[language]?.isComplete == false)
                        putString("error", if (ready) "" else failures[language] ?: "")
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
        val existing = downloads[language]
        if (existing != null && !existing.isComplete) {
            existing.addOnSuccessListener { promise.resolve(null) }
                .addOnFailureListener { error -> promise.reject("MODEL_DOWNLOAD_FAILED", failures[language] ?: describeFailure(error), error) }
            return
        }
        try {
            if (wifiOnly && !hasWifi()) {
                val message = "仅 Wi-Fi 下载已开启。请连接 Wi-Fi，或关闭该选项后重试（会使用流量）。"
                failures[language] = message
                promise.reject("MODEL_WIFI_REQUIRED", message)
                return
            }
            failures.remove(language)
            val conditions = DownloadConditions.Builder().apply { if (wifiOnly) requireWifi() }.build()
            val task = manager.download(TranslateRemoteModel.Builder(language).build(), conditions)
            downloads[language] = task
            task.addOnSuccessListener {
                downloads.remove(language, task)
                failures.remove(language)
                promise.resolve(null)
            }.addOnFailureListener { error ->
                val message = describeFailure(error)
                failures[language] = message
                downloads.remove(language, task)
                promise.reject("MODEL_DOWNLOAD_FAILED", message, error)
            }
        } catch (error: Exception) {
            val message = describeFailure(error)
            failures[language] = message
            promise.reject("MODEL_DOWNLOAD_FAILED", message, error)
        }
    }

    fun requireInstalled(source: String): Task<Void> {
        return manager.getDownloadedModels(TranslateRemoteModel::class.java).continueWith<Void> { task ->
            if (!task.isSuccessful) throw task.exception ?: Exception("无法读取模型状态")
            val installed = task.result.map { it.language }.toSet()
            if ("zh" !in installed || (source == "ja" && "ja" !in installed)) {
                throw IllegalStateException("翻译模型未下载，请到 设置 → 学习模型 下载${if (source == "ja") "中文和日文" else "中文"}模型。")
            }
            null
        }
    }

    private fun describeFailure(error: Exception): String {
        val details = generateSequence<Throwable>(error) { it.cause }.take(4)
            .mapNotNull { it.message }.distinct().joinToString("；").take(800)
        return "模型下载失败：${details.ifBlank { error.javaClass.simpleName }}。请检查网络、剩余存储和系统下载管理的大文件限制。"
    }

    fun close() { closed = true }
}
