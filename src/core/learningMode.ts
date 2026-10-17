import { atom, getDefaultStore, useAtomValue } from "jotai";
import RNTrackPlayer from "react-native-track-player";
import LyricDictionary from "@/native/lyricDictionary";
import { hasJapanese, learningLanguage, learningLines, LearningLanguage, LearningLanguageChoice } from "@/utils/learningLyrics";
import type { IParsedLrcItem } from "@/utils/lrcParser";
import Toast from "@/utils/toast";
import { tokenizeLearningLine } from "@/utils/learningTokens";
import PersistStatus from "@/utils/persistStatus";

export const LEARNING_RATES = [1, 0.75, 0.5] as const;
export type LearningRate = typeof LEARNING_RATES[number];
export function validLearningRate(value: unknown): LearningRate {
    return LEARNING_RATES.includes(value as LearningRate) ? value as LearningRate : 0.5;
}
const stateAtom = atom({ enabled: false, speaking: false, index: 0, loop: false, error: "", activeToken: -1, languageChoice: "auto" as LearningLanguageChoice, rate: validLearningRate(PersistStatus.get("lyric.learningRate")) });
let lines: IParsedLrcItem[] = [];
let songLanguage: LearningLanguage = "en";
let detectedLanguage: LearningLanguage = "en";
let generation = 0;
let loopTimer: ReturnType<typeof setTimeout> | undefined;
let wordTimer: ReturnType<typeof setTimeout> | undefined;
let finishWordGap: (() => void) | undefined;
const state = () => getDefaultStore().get(stateAtom);
const patch = (value: Partial<ReturnType<typeof state>>) => getDefaultStore().set(stateAtom, { ...state(), ...value });

async function pause() {
    generation += 1;
    clearTimeout(loopTimer);
    loopTimer = undefined;
    clearTimeout(wordTimer);
    wordTimer = undefined;
    const finish = finishWordGap;
    finishWordGap = undefined;
    finish?.();
    patch({ speaking: false, activeToken: -1 });
    await LyricDictionary.stopSpeaking();
}

async function play() {
    if (!state().enabled || !lines.length) return;
    const stopping = pause();
    const sequence = generation;
    await stopping;
    if (sequence !== generation) return;
    const line = lines[state().index];
    if (!state().enabled || !line) return;
    patch({ speaking: true, error: "" });
    try {
        await RNTrackPlayer.pause();
        if (sequence !== generation) return;
        const language = learningLanguage(line.lrc, songLanguage);
        const tokens = await tokenizeLearningLine(line.lrc, language);
        if (sequence !== generation) return;
        const words = tokens.map((token, index) => ({ ...token, index })).filter(token => token.isWord);
        for (let i = 0; i < words.length; i++) {
            if (sequence !== generation) return;
            const word = words[i];
            patch({ activeToken: word.index });
            const wordLanguage = language === "yue" || language === "zh" ? learningLanguage(word.text, language) : language;
            await LyricDictionary.speakText(language === "ja" ? word.pronunciation || word.text : word.text, wordLanguage, state().rate);
            if (sequence !== generation) return;
            if (i < words.length - 1) await new Promise<void>(resolve => {
                finishWordGap = resolve;
                wordTimer = setTimeout(() => {
                    wordTimer = undefined;
                    finishWordGap = undefined;
                    resolve();
                }, 400);
            });
        }
        if (sequence !== generation) return;
        patch({ speaking: state().loop, activeToken: -1 });
        if (state().enabled && state().loop) {
            loopTimer = setTimeout(() => {
                loopTimer = undefined; if (sequence === generation) void play();
            }, 2000);
        }
    } catch (cause) {
        if (sequence !== generation) return;
        const error = cause instanceof Error ? cause.message : "朗读不可用，请检查系统文字转语音设置中的对应语言语音包";
        patch({ speaking: false, activeToken: -1, error });
        Toast.warn(error);
    }
}

const LearningMode = {
    get state() {
        return state();
    },
    get currentLine() {
        return lines[state().index];
    },
    get language() {
        return songLanguage;
    },
    get count() {
        return lines.length;
    },
    async enter(lyrics: IParsedLrcItem[], offset = 0, languageChoice: LearningLanguageChoice = "auto") {
        const nextLines = learningLines(lyrics);
        if (!nextLines.length) {
            Toast.warn("需要歌词才能开启学习模式"); return;
        }
        const stopping = pause();
        const sequence = generation;
        await stopping;
        await RNTrackPlayer.pause();
        const progress = await RNTrackPlayer.getProgress();
        if (sequence !== generation) return;
        lines = nextLines;
        detectedLanguage = lyrics.some(item => hasJapanese(item.lrc)) ? "ja" : "en";
        songLanguage = languageChoice === "auto" ? detectedLanguage : languageChoice;
        let index = 0;
        const timed = new Set(lines.map(line => line.time)).size > 1;
        if (timed) {
            for (let i = 0; i < lines.length; i++) if (lines[i].time + offset <= progress.position) index = i;
        }
        patch({ enabled: true, speaking: false, index, loop: false, error: "", languageChoice });
        void play();
    },
    async exit() {
        patch({ enabled: false, speaking: false, loop: false, error: "" });
        lines = [];
        await pause();
    },
    play, pause,
    async cycleRate() {
        const rate = LEARNING_RATES[(LEARNING_RATES.indexOf(state().rate) + 1) % LEARNING_RATES.length];
        PersistStatus.set("lyric.learningRate", rate);
        patch({ rate });
        if (state().enabled && state().speaking) await play();
    },
    async setLanguage(languageChoice: LearningLanguageChoice) {
        const stopping = pause();
        const sequence = generation;
        patch({ languageChoice, error: "" });
        songLanguage = languageChoice === "auto" ? detectedLanguage : languageChoice;
        await stopping;
        if (sequence === generation && state().enabled) await play();
    },
    toggle: () => state().speaking || loopTimer ? pause() : play(),
    async select(index: number) {
        const target = lines.findIndex(item => item.index === index);
        if (target < 0 || !state().enabled) return;
        patch({ index: target });
        await play();
    },
    async navigate(direction: "previous" | "next") {
        patch({ index: Math.max(0, Math.min(lines.length - 1, state().index + (direction === "next" ? 1 : -1))) });
        await play();
    },
    toggleLoop() {
        patch({ loop: !state().loop });
        if (!state().loop && loopTimer) {
            clearTimeout(loopTimer); loopTimer = undefined; patch({ speaking: false });
        }
    },
    async speakWord(word: string, language = learningLanguage(word, songLanguage)) {
        const stopping = pause();
        const sequence = generation;
        await stopping;
        if (sequence !== generation || !state().enabled) return;
        await LyricDictionary.speakText(word, language, 1);
    },
};

export const useLearningMode = () => useAtomValue(stateAtom);
export default LearningMode;
