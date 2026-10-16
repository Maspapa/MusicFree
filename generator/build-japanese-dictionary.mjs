import fs from "node:fs";
import readline from "node:readline";
import { createGunzip } from "node:zlib";
import { DatabaseSync } from "node:sqlite";

// Source: EDRDG EDICT2 (UTF-8 edition), CC BY-SA 4.0. See LEARNING-MODE.md.
const [input, output = "android/app/src/main/assets/japanese_dictionary.db"] = process.argv.slice(2);
if (!input || fs.existsSync(output)) throw new Error("Pass edict2u.gz and a new output path");
const db = new DatabaseSync(output);
db.exec("CREATE TABLE entries(word TEXT, reading TEXT, definition TEXT); BEGIN;");
const insert = db.prepare("INSERT INTO entries VALUES (?, ?, ?)");
const lines = readline.createInterface({ input: fs.createReadStream(input).pipe(createGunzip()), crlfDelay: Infinity });
let count = 0;
for await (const line of lines) {
    const match = line.match(/^(.+?)\s+\/(.+)\/$/);
    if (!match || line.startsWith("　")) continue;
    const head = match[1];
    const reading = head.match(/\[([^\]]+)\]/)?.[1]?.split(";")[0]?.replace(/\([^)]*\)/g, "") ?? "";
    const forms = head.replace(/\s*\[[^\]]+\]/, "").split(";");
    const definition = match[2].replace(/\/EntL\d+X?$/, "").replaceAll("/", "; ").slice(0, 1600);
    for (const form of forms) {
        const word = form.replace(/\([^)]*\)/g, "").trim();
        if (!word) continue;
        insert.run(word, reading || word, definition);
        count += 1;
    }
}
db.exec("COMMIT; CREATE INDEX words ON entries(word); CREATE INDEX readings ON entries(reading); VACUUM;");
db.close();
if (count < 100000) throw new Error(`Dictionary unexpectedly small: ${count}`);
console.log(`Built ${count} Japanese dictionary forms`);
