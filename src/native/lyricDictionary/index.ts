import { NativeModules } from "react-native";

export interface ILyricDictionaryEntry {
    word: string;
    matchedWord: string;
    phonetic?: string;
    translation?: string;
    definition?: string;
}

interface ILyricDictionaryModule {
    lookup(word: string): Promise<ILyricDictionaryEntry | null>;
    speak(word: string): Promise<void>;
    stopSpeaking(): Promise<void>;
    speakText(text: string, language: string, rate: number): Promise<void>;
    tokenizeJapanese(text: string): Promise<Array<{ text: string; isWord: boolean; pronunciation?: string }>>;
    lookupJapanese(word: string): Promise<ILyricDictionaryEntry | null>;
    translate(text: string, language: string): Promise<string>;
}

const nativeModule = NativeModules.LyricDictionary as
    | ILyricDictionaryModule
    | undefined;

const LyricDictionary = {
    speakText(text: string, language: string, rate = 0.5) {
        return nativeModule?.speakText(text, language, rate) ?? Promise.reject(new Error("Speech module unavailable"));
    },
    tokenizeJapanese(text: string) {
        return nativeModule?.tokenizeJapanese(text) ?? Promise.reject(new Error("Japanese tokenizer unavailable"));
    },
    lookupJapanese(word: string) {
        return nativeModule?.lookupJapanese(word) ?? Promise.reject(new Error("Japanese dictionary unavailable"));
    },
    translate(text: string, language: string) {
        return nativeModule?.translate(text, language) ?? Promise.reject(new Error("Translation module unavailable"));
    },
    lookup(word: string) {
        if (!nativeModule) {
            return Promise.reject(new Error("LyricDictionary is unavailable"));
        }
        return nativeModule.lookup(word);
    },
    speak(word: string) {
        if (!nativeModule) {
            return Promise.reject(new Error("LyricDictionary is unavailable"));
        }
        return nativeModule.speak(word);
    },
    stopSpeaking() {
        return nativeModule?.stopSpeaking() ?? Promise.resolve();
    },
};

export default LyricDictionary;
