import { atom, getDefaultStore, useAtomValue } from "jotai";
import RNTrackPlayer from "react-native-track-player";
import LyricDictionary from "@/native/lyricDictionary";
import { hasJapanese, learningLanguage, learningLines } from "@/utils/learningLyrics";
import type { IParsedLrcItem } from "@/utils/lrcParser";
import Toast from "@/utils/toast";

const stateAtom = atom({ enabled: false, speaking: false, index: 0, loop: false, error: "" });
let lines: IParsedLrcItem[] = [];
let songLanguage: "en" | "ja" = "en";
let generation = 0;
let loopTimer: ReturnType<typeof setTimeout> | undefined;
const state = () => getDefaultStore().get(stateAtom);
const patch = (value: Partial<ReturnType<typeof state>>) => getDefaultStore().set(stateAtom, { ...state(), ...value });

async function pause() {
    generation += 1;
    clearTimeout(loopTimer);
    loopTimer = undefined;
    patch({ speaking: false });
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
        await LyricDictionary.speakText(line.lrc, learningLanguage(line.lrc, songLanguage), 0.5);
        if (sequence !== generation) return;
        patch({ speaking: state().loop });
        if (state().enabled && state().loop) {
            loopTimer = setTimeout(() => {
                loopTimer = undefined; if (sequence === generation) void play();
            }, 2000);
        }
    } catch {
        if (sequence !== generation) return;
        const error = "朗读不可用，请在安卓系统的文字转语音设置中安装英语／日语语音";
        patch({ speaking: false, error });
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
    async enter(lyrics: IParsedLrcItem[], offset = 0) {
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
        songLanguage = lyrics.some(item => hasJapanese(item.lrc)) ? "ja" : "en";
        let index = 0;
        for (let i = 0; i < lines.length; i++) if (lines[i].time + offset <= progress.position) index = i;
        patch({ enabled: true, speaking: false, index, loop: false, error: "" });
        void play();
    },
    async exit() {
        patch({ enabled: false, speaking: false, loop: false, error: "" });
        lines = [];
        await pause();
    },
    play, pause,
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
    async speakWord(word: string) {
        const stopping = pause();
        const sequence = generation;
        await stopping;
        if (sequence !== generation || !state().enabled) return;
        await LyricDictionary.speakText(word, learningLanguage(word, songLanguage), 1);
    },
};

export const useLearningMode = () => useAtomValue(stateAtom);
export default LearningMode;
