export interface ILyricToken {
    text: string;
    isWord: boolean;
    pronunciation?: string;
}

const ENGLISH_WORD = /[A-Za-z]+(?:[’'][A-Za-z]+)*(?:-[A-Za-z]+)*/g;

/** 分词尚未就绪时仍可点选文字片段；不把它冒充为准确的日语分词。 */
export function tokenizeLyricFallback(line: string): ILyricToken[] {
    return line.split(/([A-Za-z]+(?:[’'-][A-Za-z]+)*|[\u3400-\u9fff\u3040-\u30ff]+)/g)
        .filter(Boolean)
        .map(text => ({ text, isWord: /[A-Za-z\u3400-\u9fff\u3040-\u30ff]/.test(text) }));
}

export function tokenizeLyricLine(line: string): ILyricToken[] {
    const result: ILyricToken[] = [];
    let offset = 0;

    for (const match of line.matchAll(ENGLISH_WORD)) {
        const index = match.index ?? 0;
        if (index > offset) {
            result.push({ text: line.slice(offset, index), isWord: false });
        }
        result.push({ text: match[0], isWord: true });
        offset = index + match[0].length;
    }
    if (offset < line.length) {
        result.push({ text: line.slice(offset), isWord: false });
    }
    return result;
}

export function normalizeLyricWord(word: string): string {
    return word
        .replace(/’/g, "'")
        .replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "")
        .toLowerCase();
}
