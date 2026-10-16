import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
jest.mock("react-native-track-player", () => ({ __esModule: true, default: { pause: jest.fn(async () => undefined), getProgress: jest.fn(async () => ({ position: 11 })), play: jest.fn(), seekTo: jest.fn() } }));
jest.mock("@/native/lyricDictionary", () => ({ __esModule: true, default: { speakText: jest.fn(async () => undefined), stopSpeaking: jest.fn(async () => undefined) } }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { warn: jest.fn() } }));

import LearningMode from "@/core/learningMode";
import speech from "@/native/lyricDictionary";
import player from "react-native-track-player";

const lyrics = [{ time: 0, index: 0, lrc: "Hello" }, { time: 10, index: 1, lrc: "Good morning" }];
const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
};

beforeEach(async () => {
    await LearningMode.exit(); jest.clearAllMocks(); jest.useFakeTimers();
});
afterEach(async () => {
    await LearningMode.exit(); jest.useRealTimers();
});

describe("learning playback", () => {
    it("pauses the song, reads the current line at half speed, and preserves song position", async () => {
        await LearningMode.enter(lyrics); await flush();
        expect(speech.speakText).toHaveBeenCalledWith("Good morning", "en", 0.5);
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
        LearningMode.toggleLoop();
        await LearningMode.play();
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
});
