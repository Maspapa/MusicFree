import { IParsedLrcItem } from "./lrcParser";

export type LyricLineDirection = "previous" | "next";

const SAME_TIMESTAMP_TOLERANCE = 0.01;

/** Build the seekable timeline used by lyric-line navigation. */
export function getNavigableLyricTimes(
    lyrics: IParsedLrcItem[],
    offset = 0,
): number[] {
    const times: number[] = [];

    for (const item of lyrics) {
        if (!item.lrc.trim() || !Number.isFinite(item.time)) {
            continue;
        }

        const time = Math.max(0, item.time + offset);
        const lastTime = times[times.length - 1];
        if (
            lastTime === undefined ||
            Math.abs(time - lastTime) > SAME_TIMESTAMP_TOLERANCE
        ) {
            times.push(time);
        }
    }

    return times;
}

export function hasNavigableLyrics(
    lyrics: IParsedLrcItem[],
    offset = 0,
): boolean {
    return getNavigableLyricTimes(lyrics, offset).length >= 2;
}

/** Returns the adjacent lyric timestamp. Boundaries stay on the first/last line. */
export function getAdjacentLyricTime(
    times: number[],
    position: number,
    direction: LyricLineDirection,
): number | null {
    if (times.length < 2) {
        return null;
    }

    let currentIndex = -1;
    for (let index = 0; index < times.length; index += 1) {
        if (times[index] <= position + SAME_TIMESTAMP_TOLERANCE) {
            currentIndex = index;
        } else {
            break;
        }
    }

    if (direction === "next") {
        return times[Math.min(currentIndex + 1, times.length - 1)];
    }

    return times[Math.max(currentIndex - 1, 0)];
}
