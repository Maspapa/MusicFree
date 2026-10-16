package `fun`.upup.musicfree.lyricDictionary

import android.app.DownloadManager
import org.junit.Assert.*
import org.junit.Test

class ModelDownloadStatusTest {
    @Test fun waitingForWifiIsNotRunning() {
        assertEquals("waiting_wifi", ModelDownloadStatus.state(DownloadManager.STATUS_PAUSED, DownloadManager.PAUSED_QUEUED_FOR_WIFI))
        assertEquals("waiting_network", ModelDownloadStatus.state(DownloadManager.STATUS_PAUSED, DownloadManager.PAUSED_WAITING_FOR_NETWORK))
        assertEquals("retrying", ModelDownloadStatus.state(DownloadManager.STATUS_PAUSED, DownloadManager.PAUSED_WAITING_TO_RETRY))
        assertEquals("pending", ModelDownloadStatus.state(DownloadManager.STATUS_PENDING, 0))
        assertEquals("running", ModelDownloadStatus.state(DownloadManager.STATUS_RUNNING, 0))
        assertEquals("installing", ModelDownloadStatus.state(DownloadManager.STATUS_SUCCESSFUL, 0))
        assertEquals("failed", ModelDownloadStatus.state(DownloadManager.STATUS_FAILED, 1006))
        assertTrue(ModelDownloadStatus.message("waiting_wifi").contains("系统限制"))
    }

    @Test fun onlyRecognizesOurOfficialTranslationModelUrls() {
        assertEquals("zh", ModelDownloadStatus.languageForUrl("https://redirector.gvt1.com/edgedl/translate/offline/v5/high/r29/en_zh.zip"))
        assertEquals("ja", ModelDownloadStatus.languageForUrl("https://dl.google.com/translate/offline/v5/high/r29/en_ja.zip"))
        listOf("https://dl.google.com/download/app.apk", "https://evil.com/translate/offline/v5/high/r29/en_zh.zip", "https://dl.google.com.evil.com/translate/offline/v5/high/r29/en_zh.zip", "https://user@dl.google.com/translate/offline/v5/high/r29/en_zh.zip", "http://dl.google.com/translate/offline/v5/high/r29/en_zh.zip", "https://dl.google.com/translate/offline/v5/high/r29/en_fr.zip").forEach { assertNull(ModelDownloadStatus.languageForUrl(it)) }
    }
}
