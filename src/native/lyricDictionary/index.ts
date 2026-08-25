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
}

const nativeModule = NativeModules.LyricDictionary as
    | ILyricDictionaryModule
    | undefined;

const LyricDictionary = {
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
