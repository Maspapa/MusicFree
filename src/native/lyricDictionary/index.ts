import { NativeModules } from "react-native";
export interface ITranslationModel {
    language: "zh" | "ja";
    downloaded: boolean;
    downloading: boolean;
    error: string;
}

export interface ILyricDictionaryEntry {
    source?: "edict" | "ecdict";
    word: string;
    matchedWord: string;
    phonetic?: string;
    translation?: string;
    definition?: string;
}

interface ILyricDictionaryModule {
    getSpeechVoices(language: string): Promise<Array<{ name: string; locale: string; network: boolean }>>;
    tokenizeChinese(text: string): Promise<Array<{ text: string; isWord: boolean }>>;
    lookup(word: string): Promise<ILyricDictionaryEntry | null>;
    speak(word: string): Promise<void>;
    stopSpeaking(): Promise<void>;
    speakText(text: string, language: string, rate: number): Promise<void>;
    tokenizeJapanese(text: string): Promise<Array<{ text: string; isWord: boolean; pronunciation?: string }>>;
    lookupJapanese(word: string): Promise<ILyricDictionaryEntry | null>;
    translate(text: string, language: string): Promise<string>;
    getTranslationModels(): Promise<ITranslationModel[]>;
    downloadTranslationModel(language: "zh" | "ja", wifiOnly: boolean): Promise<void>;
    openSpeechSettings(): Promise<void>;
}

const nativeModule = NativeModules.LyricDictionary as
    | ILyricDictionaryModule
    | undefined;

const LyricDictionary = {
    getSpeechVoices(language: string) {
        return nativeModule?.getSpeechVoices(language) ?? Promise.reject(new Error("语音检测不可用，请更新应用"));
    },
    tokenizeChinese(text: string) {
        return nativeModule?.tokenizeChinese(text) ?? Promise.reject(new Error("中文分词不可用，请更新应用"));
    },
    getTranslationModels() {
        return nativeModule?.getTranslationModels() ?? Promise.reject(new Error("模型管理不可用，请更新应用"));
    },
    downloadTranslationModel(language: "zh" | "ja", wifiOnly: boolean) {
        return nativeModule?.downloadTranslationModel(language, wifiOnly) ?? Promise.reject(new Error("模型管理不可用，请更新应用"));
    },
    openSpeechSettings() {
        return nativeModule?.openSpeechSettings() ?? Promise.reject(new Error("系统语音设置不可用"));
    },
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
