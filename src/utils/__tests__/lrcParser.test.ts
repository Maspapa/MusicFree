import { describe, expect, it } from "@jest/globals";
import LyricParser from "../lrcParser";

const parse = (raw: string, translation: string, extra?: Record<string, number>) => new LyricParser(raw, { translation, extra });

describe("已有歌词译文对齐", () => {
    it("允许 50 毫秒误差，并保留原歌词时间", () => {
        const parser = parse("[00:10.00]Hello\n[00:12.00]World", "[00:10.05]你好\n[00:11.95]世界");
        expect(parser.getLyricItems().map(line => [line.time, line.translation])).toEqual([[10, "你好"], [12, "世界"]]);
        expect(parser.hasTranslation).toBe(true);
    });
    it("空白译文不崩溃，也不声称有译文", () => {
        const parser = parse("[00:10.00]Hello", "  \n ");
        expect(parser.hasTranslation).toBe(false);
        expect(parse("[00:10.00]Hello", "[ar:Someone]").hasTranslation).toBe(false);
    });
    it("不把不同时间的译文强行挂到歌词上", () => {
        expect(parse("[00:10.00]Hello", "[00:12.00]你好").hasTranslation).toBe(false);
    });
    it("优先保护精确匹配，且一条译文只使用一次", () => {
        const parser = parse("[00:10.00]One\n[00:10.10]Two", "[00:10.10]二");
        expect(parser.getLyricItems().map(line => line.translation)).toEqual([undefined, "二"]);
    });
    it("相邻密集歌词间正好居中的译文不猜测归属", () => {
        expect(parse("[00:10.00]One\n[00:10.10]Two", "[00:10.05]不确定").hasTranslation).toBe(false);
    });
    it("处理文件自身 offset，但用户的播放偏移不改变译文归属", () => {
        const parser = parse("[offset:1000]\n[00:10.00]Hello", "[00:11.05]你好", { offset: 3 });
        expect(parser.getLyricItems()[0].translation).toBe("你好");
        expect(parser.getMeta().offset).toBe(4);
    });
    it("两份均无时间戳且行数相同的歌词按顺序对齐", () => {
        expect(parse("Hello\nWorld", "你好\n世界").getLyricItems().map(line => line.translation)).toEqual(["你好", "世界"]);
    });
    it("不把无时间戳译文当成零秒歌词匹配", () => {
        expect(parse("[00:00.00]Hello", "你好").hasTranslation).toBe(false);
    });
});
