package `fun`.upup.musicfree.lyricDictionary

import android.database.sqlite.SQLiteDatabase
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
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

    private fun performSpeak(word: String, promise: Promise) {
        val engine = textToSpeech
        if (engine == null) {
            promise.reject("TTS_INIT_FAILED", "Speech engine did not initialize")
            return
        }
        if (engine.setLanguage(Locale.US) < TextToSpeech.LANG_AVAILABLE) {
            promise.reject("TTS_LANGUAGE_UNAVAILABLE", "English speech data is unavailable")
            return
        }
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
        if (word.isBlank()) {
            promise.reject("TTS_INVALID_WORD", "No pronounceable word")
            return
        }
        mainHandler.post {
            if (textToSpeech != null) {
                performSpeak(word, promise)
                return@post
            }
            textToSpeech = TextToSpeech(context.applicationContext) { status ->
                if (status != TextToSpeech.SUCCESS) {
                    textToSpeech = null
                    promise.reject("TTS_INIT_FAILED", "Speech engine initialization failed")
                    return@TextToSpeech
                }
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
                })
                performSpeak(word, promise)
            }
        }
    }

    @ReactMethod
    fun stopSpeaking(promise: Promise) {
        mainHandler.post {
            textToSpeech?.stop()
            utterancePromises.entries.forEach { (_, pending) -> pending.reject("TTS_INTERRUPTED", "Speech interrupted") }
            utterancePromises.clear()
            promise.resolve(null)
        }
    }

    override fun invalidate() {
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
