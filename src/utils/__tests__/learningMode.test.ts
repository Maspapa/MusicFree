import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
jest.mock("react-native-track-player", () => ({ __esModule: true, default: { pause: jest.fn(async () => undefined), getProgress: jest.fn(async () => ({ position: 11 })), play: jest.fn(), seekTo: jest.fn() } }));
jest.mock("@/native/lyricDictionary", () => ({ __esModule: true, default: { speakText: jest.fn(async () => undefined), stopSpeaking: jest.fn(async () => undefined), tokenizeChinese: jest.fn(async () => [{ text: "海闊", isWord: true }, { text: "天空", isWord: true }]), tokenizeJapanese: jest.fn(async () => [{ text: "私", isWord: true, pronunciation: "ワタシ" }, { text: "は", isWord: true, pronunciation: "ワ" }]) } }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { warn: jest.fn() } }));
jest.mock("@/utils/persistStatus", () => ({ __esModule: true, default: { get: jest.fn(() => null), set: jest.fn() } }));

import LearningMode, { validLearningRate } from "@/core/learningMode";
import PersistStatus from "@/utils/persistStatus";
import speech from "@/native/lyricDictionary";
import player from "react-native-track-player";

const lyrics = [{ time: 0, index: 0, lrc: "Hello" }, { time: 10, index: 1, lrc: "Good morning" }];
const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
};

beforeEach(async () => {
    await LearningMode.exit();
    while (LearningMode.state.rate !== 0.5) await LearningMode.cycleRate();
    jest.clearAllMocks(); jest.useFakeTimers();
});
afterEach(async () => {
    await LearningMode.exit(); jest.useRealTimers();
});

describe("learning playback", () => {
    it("点词按该词语言发音，日语汉字不再误走英语", async () => {
        await LearningMode.enter(lyrics); await flush();
        await LearningMode.speakWord("天空", "ja");
        expect(speech.speakText).toHaveBeenLastCalledWith("天空", "ja", 1);
    });
    it("cycles through the three speeds and saves the selection without starting paused speech", async () => {
        expect(LearningMode.state.rate).toBe(0.5);
        await LearningMode.cycleRate();
        expect(LearningMode.state.rate).toBe(1);
        expect(PersistStatus.set).toHaveBeenLastCalledWith("lyric.learningRate", 1);
        await LearningMode.cycleRate();
        expect(LearningMode.state.rate).toBe(0.75);
        await LearningMode.cycleRate();
        expect(LearningMode.state.rate).toBe(0.5);
        expect(speech.speakText).not.toHaveBeenCalled();
        expect(validLearningRate(0.75)).toBe(0.75);
        expect(validLearningRate(2)).toBe(0.5);
        expect(validLearningRate("1")).toBe(0.5);
        expect(validLearningRate(null)).toBe(0.5);
    });
    it("restarts an active line at the selected speed and cancels old pending words", async () => {
        await LearningMode.enter(lyrics); await flush();
        const switching = LearningMode.cycleRate(); await flush();
        expect(speech.speakText).toHaveBeenLastCalledWith("Good", "en", 1);
        jest.advanceTimersByTime(400); await flush(); await switching;
        expect(speech.speakText).toHaveBeenLastCalledWith("morning", "en", 1);
        expect(speech.speakText).not.toHaveBeenCalledWith("morning", "en", 0.5);
        await LearningMode.speakWord("Good");
        expect(speech.speakText).toHaveBeenLastCalledWith("Good", "en", 1);
        await LearningMode.exit();
        await LearningMode.enter([{ time: 0, index: 0, lrc: "Hello" }]); await flush();
        expect(speech.speakText).toHaveBeenLastCalledWith("Hello", "en", 1);
    });
    it("does not restart a paused sentence when changing speed", async () => {
        await LearningMode.enter(lyrics); await flush(); await LearningMode.pause();
        jest.mocked(speech.speakText).mockClear();
        await LearningMode.cycleRate();
        expect(speech.speakText).not.toHaveBeenCalled();
        expect(LearningMode.state.speaking).toBe(false);
    });
    it("uses the latest speed after rapid taps without reviving the old word sequence", async () => {
        await LearningMode.enter(lyrics); await flush();
        const first = LearningMode.cycleRate();
        const second = LearningMode.cycleRate();
        await flush();
        expect(LearningMode.state.rate).toBe(0.75);
        expect(speech.speakText).toHaveBeenLastCalledWith("Good", "en", 0.75);
        jest.advanceTimersByTime(400); await flush();
        await Promise.all([first, second]);
        expect(speech.speakText).toHaveBeenLastCalledWith("morning", "en", 0.75);
        expect(speech.speakText).not.toHaveBeenCalledWith("morning", "en", 0.5);
        await LearningMode.speakWord("morning");
        expect(speech.speakText).toHaveBeenLastCalledWith("morning", "en", 1);
    });
    it("starts untimed lyrics from the first line rather than the last", async () => {
        await LearningMode.enter(lyrics.map(line => ({ ...line, time: 0 }))); await flush();
        expect(LearningMode.currentLine?.lrc).toBe("Hello");
    });
    it("reads independent words at half speed with a 400ms gap and preserves song position", async () => {
        await LearningMode.enter(lyrics); await flush();
        expect(speech.speakText).toHaveBeenCalledWith("Good", "en", 0.5);
        expect(LearningMode.state.activeToken).toBe(0);
        jest.advanceTimersByTime(399); await flush();
        expect(speech.speakText).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(1); await flush();
        expect(speech.speakText).toHaveBeenLastCalledWith("morning", "en", 0.5);
        expect(speech.speakText).not.toHaveBeenCalledWith("Good morning", "en", 0.5);
        expect(LearningMode.state.activeToken).toBe(-1);
        expect(player.pause).toHaveBeenCalled();
        expect(player.play).not.toHaveBeenCalled();
        expect(player.seekTo).not.toHaveBeenCalled();
        expect(LearningMode.state.enabled).toBe(true);
        expect(LearningMode.state.loop).toBe(false);
    });
    it("navigates lines without moving the song and stops at boundaries", async () => {
        await LearningMode.enter(lyrics); await flush();
        await LearningMode.navigate("previous");
        await LearningMode.navigate("previous");
        expect(LearningMode.currentLine?.lrc).toBe("Hello");
        expect(player.seekTo).not.toHaveBeenCalled();
    });
    it("repeats after two seconds and cancels the pending repeat when paused", async () => {
        await LearningMode.enter(lyrics); await flush();
        jest.advanceTimersByTime(400); await flush();
        LearningMode.toggleLoop();
        const playing = LearningMode.play(); await flush();
        jest.advanceTimersByTime(400); await flush(); await playing;
        const calls = jest.mocked(speech.speakText).mock.calls.length;
        jest.advanceTimersByTime(1999); await flush();
        expect(speech.speakText).toHaveBeenCalledTimes(calls);
        jest.advanceTimersByTime(1); await flush();
        expect(speech.speakText).toHaveBeenCalledTimes(calls + 1);
        await LearningMode.pause();
        jest.advanceTimersByTime(5000); await flush();
        expect(speech.speakText).toHaveBeenCalledTimes(calls + 1);
    });
    it("reads a tapped word at normal speed and does not resume the song", async () => {
        await LearningMode.enter(lyrics); await flush();
        await LearningMode.speakWord("morning");
        expect(speech.speakText).toHaveBeenLastCalledWith("morning", "en", 1);
        expect(LearningMode.state.speaking).toBe(false);
        expect(player.play).not.toHaveBeenCalled();
    });
    it("cancels an in-flight start when learning mode is exited", async () => {
        await LearningMode.enter(lyrics); await flush();
        const calls = jest.mocked(speech.speakText).mock.calls.length;
        const start = LearningMode.play();
        await LearningMode.exit(); await start;
        expect(speech.speakText).toHaveBeenCalledTimes(calls);
        expect(LearningMode.state.enabled).toBe(false);
    });
    it("cancels a word gap on pause and cannot start the next word later", async () => {
        await LearningMode.enter(lyrics); await flush();
        expect(speech.speakText).toHaveBeenCalledTimes(1);
        await LearningMode.pause();
        jest.advanceTimersByTime(5000); await flush();
        expect(speech.speakText).toHaveBeenCalledTimes(1);
        expect(LearningMode.state.activeToken).toBe(-1);
    });
    it("cancels the old word sequence when switching lines", async () => {
        await LearningMode.enter(lyrics); await flush();
        await LearningMode.navigate("previous"); await flush();
        jest.advanceTimersByTime(5000); await flush();
        expect(speech.speakText).not.toHaveBeenCalledWith("morning", "en", 0.5);
        expect(speech.speakText).toHaveBeenLastCalledWith("Hello", "en", 0.5);
    });
    it("uses Japanese context pronunciation rather than individual kanji", async () => {
        await LearningMode.enter([{ time: 0, index: 0, lrc: "私は" }]); await flush();
        expect(speech.speakText).toHaveBeenLastCalledWith("ワタシ", "ja", 0.5);
        jest.advanceTimersByTime(400); await flush();
        expect(speech.speakText).toHaveBeenLastCalledWith("ワ", "ja", 0.5);
    });
    it("uses a Cantonese voice and Chinese word segmentation for a manually selected song", async () => {
        await LearningMode.enter([{ time: 0, index: 0, lrc: "海闊天空" }], 0, "yue"); await flush();
        expect(speech.tokenizeChinese).toHaveBeenCalledWith("海闊天空");
        expect(speech.tokenizeJapanese).not.toHaveBeenCalled();
        expect(speech.speakText).toHaveBeenLastCalledWith("海闊", "yue", 0.5);
        jest.advanceTimersByTime(400); await flush();
        expect(speech.speakText).toHaveBeenLastCalledWith("天空", "yue", 0.5);
        await LearningMode.speakWord("天空");
        expect(speech.speakText).toHaveBeenLastCalledWith("天空", "yue", 1);
    });
    it("cancels the old sequence on language changes and can switch back to automatic", async () => {
        await LearningMode.enter([{ time: 0, index: 0, lrc: "海闊天空" }], 0, "yue"); await flush();
        void LearningMode.setLanguage("zh"); await flush();
        jest.advanceTimersByTime(400); await flush();
        expect(speech.speakText).not.toHaveBeenCalledWith("天空", "yue", 0.5);
        expect(speech.speakText).toHaveBeenLastCalledWith("天空", "zh", 0.5);
        void LearningMode.setLanguage("auto"); await flush();
        expect(LearningMode.state.languageChoice).toBe("auto");
        expect(speech.speakText).toHaveBeenLastCalledWith("海闊", "zh", 0.5);
    });
    it("shows missing Cantonese voice errors without retrying in Mandarin", async () => {
        jest.mocked(speech.speakText).mockRejectedValueOnce(new Error("未安装粤语，不会改用普通话"));
        await LearningMode.enter([{ time: 0, index: 0, lrc: "海闊天空" }], 0, "yue"); await flush();
        jest.advanceTimersByTime(5000); await flush();
        expect(speech.speakText).toHaveBeenCalledTimes(1);
        expect(LearningMode.state.error).toBe("未安装粤语，不会改用普通话");
        expect(LearningMode.state.speaking).toBe(false);
    });
});
