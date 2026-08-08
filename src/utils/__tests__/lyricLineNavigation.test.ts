import {
    getAdjacentLyricTime,
    getNavigableLyricTimes,
    hasNavigableLyrics,
} from "../lyricLineNavigation";
import { describe, expect, it } from "@jest/globals";

describe("lyric line navigation", () => {
    const lyrics = [
        { time: 0, lrc: "first", index: 0 },
        { time: 10, lrc: "second", index: 1 },
        { time: 10, lrc: "duplicate", index: 2 },
        { time: 20, lrc: "third", index: 3 },
        { time: 30, lrc: "", index: 4 },
    ];

    it("builds a unique timeline with the lyric offset", () => {
        expect(getNavigableLyricTimes(lyrics, 1.5)).toEqual([1.5, 11.5, 21.5]);
        expect(hasNavigableLyrics(lyrics)).toBe(true);
    });

    it("moves to the adjacent line and stays inside boundaries", () => {
        const times = [0, 10, 20];

        expect(getAdjacentLyricTime(times, 15, "previous")).toBe(0);
        expect(getAdjacentLyricTime(times, 15, "next")).toBe(20);
        expect(getAdjacentLyricTime(times, 0, "previous")).toBe(0);
        expect(getAdjacentLyricTime(times, 20, "next")).toBe(20);
    });

    it("rejects plain or single-timestamp lyrics", () => {
        const plainLyrics = [
            { time: 0, lrc: "first", index: 0 },
            { time: 0, lrc: "second", index: 1 },
        ];

        expect(hasNavigableLyrics(plainLyrics)).toBe(false);
        expect(getAdjacentLyricTime([0], 0, "next")).toBeNull();
    });
});
