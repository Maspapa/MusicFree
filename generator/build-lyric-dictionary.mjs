import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? path.resolve("android/app/src/main/assets/lyric_dictionary.db");
if (!inputPath) {
    throw new Error("Usage: node generator/build-lyric-dictionary.mjs <ecdict.csv> [output.db]");
}

function parseCsvLine(line) {
    const fields = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
        const character = line[i];
        if (character === '"') {
            if (quoted && line[i + 1] === '"') {
                value += '"';
                i += 1;
            } else {
                quoted = !quoted;
            }
        } else if (character === "," && !quoted) {
            fields.push(value);
            value = "";
        } else {
            value += character;
        }
    }
    fields.push(value);
    return fields;
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.rmSync(outputPath, { force: true });
const database = new DatabaseSync(outputPath);
database.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    CREATE TABLE entries (
        word TEXT PRIMARY KEY COLLATE NOCASE,
        phonetic TEXT,
        translation TEXT,
        definition TEXT
    ) WITHOUT ROWID;
    BEGIN;
`);
const insert = database.prepare(
    "INSERT OR IGNORE INTO entries(word, phonetic, translation, definition) VALUES (?, ?, ?, ?)",
);

const stream = fs.createReadStream(inputPath, { encoding: "utf8" });
const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
let inserted = 0;
let lineNumber = 0;
for await (const line of lines) {
    lineNumber += 1;
    if (lineNumber === 1) continue;
    const fields = parseCsvLine(line);
    if (fields.length < 11) continue;
    const [word, phonetic, definition, translation, , collins, oxford, tag, bnc, frq] = fields;
    if (!/^[A-Za-z]+(?:['-][A-Za-z]+)*$/.test(word)) continue;
    const ranked = Number(collins) > 0 || Number(oxford) > 0 || Number(bnc) > 0 || Number(frq) > 0;
    const usefulTag = /\b(?:zk|gk|cet4|cet6|ky|toefl|ielts|gre)\b/i.test(tag);
    if (!ranked && !usefulTag) continue;
    insert.run(
        word.toLowerCase(),
        phonetic?.slice(0, 160) ?? "",
        translation?.replaceAll("\\n", "\n").slice(0, 1200) ?? "",
        definition?.replaceAll("\\n", "\n").slice(0, 800) ?? "",
    );
    inserted += 1;
}
database.exec("COMMIT; VACUUM; PRAGMA optimize;");
database.close();
console.log(`Created ${outputPath} with ${inserted} entries`);
