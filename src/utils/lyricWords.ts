export interface ILyricToken {
    text: string;
    isWord: boolean;
}

const ENGLISH_WORD = /[A-Za-z]+(?:[’'][A-Za-z]+)*(?:-[A-Za-z]+)*/g;

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
