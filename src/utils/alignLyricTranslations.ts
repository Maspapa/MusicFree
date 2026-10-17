import type { IParsedLrcItem } from "./lrcParser";

/** 仅修正轻微时间误差；不猜测不同版本的歌词，不复用同一行译文。 */
export function alignLyricTranslations(original: IParsedLrcItem[], translated: IParsedLrcItem[], originalOffset = 0, translatedOffset = 0) {
    const matches = new Map<number, number>();
    const used = new Set<number>();
    const distance = (i: number, j: number) => Math.abs(original[i].time + originalOffset - translated[j].time - translatedOffset);
    const attach = (i: number, j: number) => {
        matches.set(i, j);
        used.add(j);
    };
    // 精确匹配优先，避免临近的一行提前抢走准确译文。
    original.forEach((_, i) => {
        const j = translated.findIndex((line, index) => !used.has(index) && !!line.lrc.trim() && distance(i, index) < 0.000001);
        if (j >= 0) attach(i, j);
    });
    original.forEach((line, i) => {
        if (matches.has(i)) return;
        const gap = Math.min(
            i > 0 ? line.time - original[i - 1].time : Infinity,
            i + 1 < original.length ? original[i + 1].time - line.time : Infinity,
        );
        const tolerance = Math.min(0.2, gap / 2);
        const candidates = translated.map((_, j) => j).filter(j => {
            if (used.has(j) || !translated[j].lrc.trim() || distance(i, j) + 0.000001 >= tolerance) return false;
            return [...matches].every(([other, match]) => other < i ? match < j : match > j);
        }).sort((a, b) => distance(i, a) - distance(i, b));
        if (candidates.length && (candidates.length === 1 || Math.abs(distance(i, candidates[0]) - distance(i, candidates[1])) > 0.000001)) attach(i, candidates[0]);
    });
    for (const [i, j] of matches) original[i].translation = translated[j].lrc;
    return matches.size > 0;
}
