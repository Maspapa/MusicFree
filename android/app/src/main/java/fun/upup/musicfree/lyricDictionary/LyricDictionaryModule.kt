package `fun`.upup.musicfree.lyricDictionary

import android.database.sqlite.SQLiteDatabase
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

class LyricDictionaryModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

    companion object {
        private const val ASSET_NAME = "lyric_dictionary.db"
        private const val DATABASE_VERSION = 1
    }

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val utterancePromises = ConcurrentHashMap<String, Promise>()
    @Volatile private var database: SQLiteDatabase? = null
    @Volatile private var textToSpeech: TextToSpeech? = null
    private var ttsReady = false
    private var pendingInitialSpeech: (() -> Unit)? = null
    private var pendingInitialPromise: Promise? = null
    private val learning = LearningLanguageTools(context)

    override fun getName() = "LyricDictionary"

    private fun normalize(rawWord: String): String = rawWord
        .replace('’', '\'')
        .trim()
        .replace(Regex("^[^A-Za-z]+|[^A-Za-z]+$"), "")
        .lowercase(Locale.US)

    private fun lookupCandidates(word: String): List<String> {
        val candidates = linkedSetOf(word)
        val contractions = mapOf(
            "can't" to "can", "won't" to "will", "ain't" to "be",
            "n't" to "", "'re" to "", "'ve" to "", "'ll" to "",
            "'d" to "", "'m" to "", "'s" to ""
        )
        contractions.forEach { (suffix, replacement) ->
            if (word.endsWith(suffix) && word.length > suffix.length) {
                candidates.add(word.dropLast(suffix.length) + replacement)
            }
        }
        when {
            word.endsWith("ies") && word.length > 4 -> candidates.add(word.dropLast(3) + "y")
            word.endsWith("ves") && word.length > 4 -> {
                candidates.add(word.dropLast(3) + "f")
                candidates.add(word.dropLast(3) + "fe")
            }
            word.endsWith("es") && word.length > 3 -> {
                candidates.add(word.dropLast(2))
                candidates.add(word.dropLast(1))
            }
            word.endsWith("s") && word.length > 3 -> candidates.add(word.dropLast(1))
        }
        if (word.endsWith("ied") && word.length > 4) candidates.add(word.dropLast(3) + "y")
        if (word.endsWith("ed") && word.length > 3) {
            candidates.add(word.dropLast(2))
            candidates.add(word.dropLast(1))
        }
        if (word.endsWith("ing") && word.length > 5) {
            val stem = word.dropLast(3)
            candidates.add(stem)
            candidates.add(stem + "e")
            if (stem.length > 2 && stem.last() == stem[stem.lastIndex - 1]) {
                candidates.add(stem.dropLast(1))
            }
        }
        return candidates.toList()
    }

    @Synchronized
    private fun openDatabase(): SQLiteDatabase {
        database?.let { if (it.isOpen) return it }
        val directory = File(context.filesDir, "dictionary").apply { mkdirs() }
        val dbFile = File(directory, ASSET_NAME)
        val preferences = context.getSharedPreferences("lyric_dictionary", 0)
        if (!dbFile.exists() || dbFile.length() == 0L ||
            preferences.getInt("version", 0) != DATABASE_VERSION) {
            val temporary = File(directory, "$ASSET_NAME.tmp")
            context.assets.open(ASSET_NAME).use { input ->
                temporary.outputStream().use { output -> input.copyTo(output) }
            }
            if (!temporary.renameTo(dbFile)) {
                temporary.copyTo(dbFile, overwrite = true)
                temporary.delete()
            }
            preferences.edit().putInt("version", DATABASE_VERSION).apply()
        }
        return SQLiteDatabase.openDatabase(dbFile.absolutePath, null, SQLiteDatabase.OPEN_READONLY).also {
            database = it
        }
    }

    @ReactMethod
    fun lookup(rawWord: String, promise: Promise) {
        executor.execute {
            try {
                val normalized = normalize(rawWord)
                if (normalized.isBlank()) {
                    promise.resolve(null)
                    return@execute
                }
                val db = openDatabase()
                for (candidate in lookupCandidates(normalized)) {
                    db.query(
                        "entries",
                        arrayOf("word", "phonetic", "translation", "definition"),
                        "word = ? COLLATE NOCASE",
                        arrayOf(candidate), null, null, null, "1"
                    ).use { cursor ->
                        if (cursor.moveToFirst()) {
                            val result = Arguments.createMap().apply {
                                putString("word", normalized)
                                putString("matchedWord", cursor.getString(0))
                                putString("phonetic", cursor.getString(1))
                                putString("translation", cursor.getString(2))
                                putString("definition", cursor.getString(3))
                            }
                            promise.resolve(result)
                            return@execute
                        }
                    }
                }
                promise.resolve(null)
            } catch (error: Exception) {
                promise.reject("DICTIONARY_LOOKUP_FAILED", error.message, error)
            }
        }
    }

    private fun performSpeak(word: String, language: String, rate: Float, promise: Promise) {
        val engine = textToSpeech
        if (engine == null) {
            promise.reject("TTS_INIT_FAILED", "Speech engine did not initialize")
            return
        }
        val locale = when (language) { "ja" -> Locale.JAPAN; "yue" -> Locale.forLanguageTag("yue-HK"); "zh" -> Locale.SIMPLIFIED_CHINESE; else -> Locale.US }
        // 不能只用 setLanguage(zh-HK)：部分引擎会退回普通话。必须找到并选中明确的粤语 Voice。
        if (language == "yue") {
            val voice = cantoneseVoices(engine).sortedWith(compareBy<Voice> { it.isNetworkConnectionRequired }.thenByDescending { it.quality }).firstOrNull()
            if (voice == null || engine.setVoice(voice) != TextToSpeech.SUCCESS || engine.voice?.let { isCantonese(it.locale) } != true) {
                promise.reject("TTS_CANTONESE_UNAVAILABLE", "当前语音引擎没有可用的粤语声音。请在系统文字转语音设置安装粤语／香港中文语音包或切换支持粤语的引擎；不会改用普通话。")
                return
            }
        } else if (engine.setLanguage(locale) < TextToSpeech.LANG_AVAILABLE) {
            promise.reject("TTS_LANGUAGE_UNAVAILABLE", "Install $language voice data in Android text-to-speech settings")
            return
        }
        engine.setSpeechRate(rate)
        engine.setPitch(1.0f)
        utterancePromises.entries.forEach { (_, pending) -> pending.reject("TTS_INTERRUPTED", "Speech interrupted") }
        utterancePromises.clear()
        val utteranceId = UUID.randomUUID().toString()
        utterancePromises[utteranceId] = promise
        if (engine.speak(word, TextToSpeech.QUEUE_FLUSH, null, utteranceId) == TextToSpeech.ERROR) {
            utterancePromises.remove(utteranceId)
            promise.reject("TTS_SPEAK_FAILED", "Speech engine rejected the utterance")
        }
    }

    @ReactMethod
    fun speak(rawWord: String, promise: Promise) {
        val word = normalize(rawWord)
        speakText(word, "en", 1.0, promise)
    }

    @ReactMethod
    fun tokenizeJapanese(text: String, promise: Promise) = learning.tokenize(text, promise)

    @ReactMethod
    fun tokenizeChinese(text: String, promise: Promise) = learning.tokenizeChinese(text, promise)

    private fun isCantonese(locale: Locale): Boolean = locale.language == "yue" || (locale.language == "zh" && locale.country == "HK")

    private fun cantoneseVoices(engine: TextToSpeech): List<Voice> = (engine.voices ?: emptySet()).filter {
        isCantonese(it.locale) && !it.features.orEmpty().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)
    }

    @ReactMethod
    fun getSpeechVoices(language: String, promise: Promise) {
        withSpeechEngine(promise) {
            try {
                val engine = textToSpeech ?: throw IllegalStateException("语音引擎未就绪")
                val voices = if (language == "yue") cantoneseVoices(engine) else (engine.voices ?: emptySet()).toList()
                val result = Arguments.createArray()
                voices.forEach { voice -> result.pushMap(Arguments.createMap().apply {
                    putString("name", voice.name)
                    putString("locale", voice.locale.toLanguageTag())
                    putBoolean("network", voice.isNetworkConnectionRequired)
                }) }
                promise.resolve(result)
            } catch (error: Exception) { promise.reject("TTS_VOICES_FAILED", error.message, error) }
        }
    }

    @ReactMethod
    fun lookupJapanese(word: String, promise: Promise) = learning.lookup(word, promise)

    @ReactMethod
    fun translate(text: String, language: String, promise: Promise) = learning.translate(text, language, promise)

    @ReactMethod
    fun getTranslationModels(promise: Promise) = learning.models.snapshot(promise)

    @ReactMethod
    fun downloadTranslationModel(language: String, wifiOnly: Boolean, promise: Promise) = learning.models.download(language, wifiOnly, promise)

    @ReactMethod
    fun cancelTranslationModel(language: String, promise: Promise) = learning.models.cancel(language, promise)

    @ReactMethod
    fun openModelDownloads(promise: Promise) {
        try {
            context.startActivity(Intent(android.app.DownloadManager.ACTION_VIEW_DOWNLOADS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject("DOWNLOAD_SETTINGS_UNAVAILABLE", "无法打开下载管理，请从通知栏或系统设置打开下载管理。", error)
        }
    }

    @ReactMethod
    fun openSpeechSettings(promise: Promise) {
        try {
            context.startActivity(Intent("com.android.settings.TTS_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject("SPEECH_SETTINGS_UNAVAILABLE", "无法打开文字转语音设置，请手动在系统设置搜索文字转语音", error)
        }
    }

    @ReactMethod
    fun speakText(word: String, language: String, rate: Double, promise: Promise) {
        if (word.isBlank()) {
            promise.reject("TTS_INVALID_WORD", "No pronounceable word")
            return
        }
        withSpeechEngine(promise) { performSpeak(word, language, rate.toFloat().coerceIn(0.25f, 2.0f), promise) }
    }

    private fun withSpeechEngine(promise: Promise, action: () -> Unit) {
        val safeAction = {
            try { action() } catch (error: Exception) { promise.reject("TTS_FAILED", error.message, error) }
        }
        mainHandler.post {
            if (ttsReady) {
                safeAction()
                return@post
            }
            pendingInitialPromise?.reject("TTS_INTERRUPTED", "Speech interrupted")
            pendingInitialPromise = promise
            pendingInitialSpeech = safeAction
            if (textToSpeech != null) return@post
            textToSpeech = TextToSpeech(context.applicationContext) { status ->
                if (status != TextToSpeech.SUCCESS) {
                    textToSpeech = null
                    pendingInitialPromise?.reject("TTS_INIT_FAILED", "Speech engine initialization failed")
                    pendingInitialPromise = null
                    pendingInitialSpeech = null
                    return@TextToSpeech
                }
                ttsReady = true
                textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) = Unit
                    override fun onDone(utteranceId: String?) {
                        utteranceId?.let { utterancePromises.remove(it)?.resolve(null) }
                    }
                    @Deprecated("Deprecated by Android")
                    override fun onError(utteranceId: String?) {
                        utteranceId?.let {
                            utterancePromises.remove(it)?.reject("TTS_SPEAK_FAILED", "Speech failed")
                        }
                    }
                    override fun onError(utteranceId: String?, errorCode: Int) = onError(utteranceId)
                    override fun onStop(utteranceId: String?, interrupted: Boolean) {
                        utteranceId?.let { utterancePromises.remove(it)?.reject("TTS_INTERRUPTED", "Speech interrupted") }
                    }
                })
                val start = pendingInitialSpeech
                pendingInitialSpeech = null
                pendingInitialPromise = null
                start?.invoke()
            }
        }
    }

    @ReactMethod
    fun stopSpeaking(promise: Promise) {
        mainHandler.post {
            textToSpeech?.stop()
            pendingInitialPromise?.reject("TTS_INTERRUPTED", "Speech interrupted")
            pendingInitialPromise = null
            pendingInitialSpeech = null
            utterancePromises.entries.forEach { (_, pending) -> pending.reject("TTS_INTERRUPTED", "Speech interrupted") }
            utterancePromises.clear()
            promise.resolve(null)
        }
    }

    override fun invalidate() {
        learning.close()
        database?.close()
        database = null
        executor.shutdownNow()
        mainHandler.post {
            textToSpeech?.stop()
            textToSpeech?.shutdown()
            textToSpeech = null
        }
        super.invalidate()
    }
}
