package `fun`.upup.musicfree.lyricDictionary

import android.database.sqlite.SQLiteDatabase
import com.atilika.kuromoji.ipadic.Tokenizer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import java.io.File
import java.util.concurrent.Executors

class LearningLanguageTools(private val context: ReactApplicationContext) {
    private val executor = Executors.newSingleThreadExecutor()
    private val tokenizer by lazy { Tokenizer() }
    private var dictionary: SQLiteDatabase? = null
    private val translators = mutableMapOf<String, Translator>()
    @Volatile private var closed = false

    fun tokenize(text: String, promise: Promise) {
        executor.execute {
            try {
                val result = Arguments.createArray()
                var offset = 0
                for (token in tokenizer.tokenize(text)) {
                    if (token.position > offset) result.pushMap(Arguments.createMap().apply {
                        putString("text", text.substring(offset, token.position)); putBoolean("isWord", false)
                    })
                    result.pushMap(Arguments.createMap().apply {
                        putString("text", token.surface)
                        putString("pronunciation", token.pronunciation.takeIf { it != "*" } ?: token.surface)
                        putBoolean("isWord", token.surface.any { it.isLetter() })
                    })
                    offset = token.position + token.surface.length
                }
                if (offset < text.length) result.pushMap(Arguments.createMap().apply {
                    putString("text", text.substring(offset)); putBoolean("isWord", false)
                })
                promise.resolve(result)
            } catch (error: Exception) { promise.reject("TOKENIZE_FAILED", error.message, error) }
        }
    }

    private fun database(): SQLiteDatabase {
        dictionary?.let { return it }
        val file = File(context.filesDir, "japanese_dictionary_v1.db")
        if (!file.exists()) {
            val temporary = File(context.filesDir, "japanese_dictionary.tmp")
            context.assets.open("japanese_dictionary.db").use { input -> temporary.outputStream().use { input.copyTo(it) } }
            check(temporary.renameTo(file)) { "Cannot install Japanese dictionary" }
        }
        return SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY).also { dictionary = it }
    }

    fun lookup(word: String, promise: Promise) {
        executor.execute {
            try {
                val tokens = tokenizer.tokenize(word)
                val base = tokens.singleOrNull()?.baseForm?.takeIf { it != "*" }
                for (candidate in listOfNotNull(word, base).distinct()) {
                    database().rawQuery("SELECT word, reading, definition FROM entries WHERE word = ? OR reading = ? LIMIT 1", arrayOf(candidate, candidate)).use { cursor ->
                        if (cursor.moveToFirst()) {
                            promise.resolve(Arguments.createMap().apply {
                                putString("word", word); putString("matchedWord", cursor.getString(0))
                                putString("phonetic", cursor.getString(1)); putString("definition", cursor.getString(2))
                            })
                            return@execute
                        }
                    }
                }
                promise.resolve(null)
            } catch (error: Exception) { promise.reject("DICTIONARY_LOOKUP_FAILED", error.message, error) }
        }
    }

    @Synchronized fun translate(text: String, language: String, promise: Promise) {
        if (closed) { promise.reject("TRANSLATOR_CLOSED", "Translator closed"); return }
        val source = if (language == "ja") TranslateLanguage.JAPANESE else TranslateLanguage.ENGLISH
        val translator = translators.getOrPut(source) {
            Translation.getClient(TranslatorOptions.Builder().setSourceLanguage(source).setTargetLanguage(TranslateLanguage.CHINESE).build())
        }
        val cache = context.getSharedPreferences("learning_translations_v1", 0)
        val key = java.security.MessageDigest.getInstance("SHA-256").digest("$source:$text".toByteArray()).joinToString("") { "%02x".format(it) }
        cache.getString(key, null)?.let { promise.resolve(it); return }
        // Model downloads stay on Wi-Fi; translated lyric text stays on the phone.
        translator.downloadModelIfNeeded(DownloadConditions.Builder().requireWifi().build())
            .continueWithTask { task ->
                if (!task.isSuccessful) throw task.exception ?: Exception("Model download failed")
                if (closed) throw Exception("Translator closed")
                translator.translate(text)
            }.addOnSuccessListener { translated ->
                cache.edit().putString(key, translated).apply()
                promise.resolve(translated)
            }.addOnFailureListener { error -> promise.reject("TRANSLATION_FAILED", "Connect to Wi-Fi to download translation models, then retry", error) }
    }

    @Synchronized fun close() {
        closed = true
        translators.values.forEach { it.close() }
        translators.clear()
        executor.execute { dictionary?.close(); dictionary = null }
        executor.shutdown()
    }
}
