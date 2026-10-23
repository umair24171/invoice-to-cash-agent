import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const pattern =
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bsk-ant-[A-Za-z0-9_-]{20,}|\bAKIA[A-Z0-9]{16}\b/;
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const hits = [];
for (const file of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(file)) hits.push(file + ": env file");
  if (pattern.test(readFileSync(file, "utf8")))
    hits.push(file + ": credential pattern");
}
const objects = execFileSync("git", ["rev-list", "--objects", "--all"], {
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean);
let blobs = 0;
for (const row of objects) {
  const oid = row.split(" ")[0];
  if (
    execFileSync("git", ["cat-file", "-t", oid], {
      encoding: "utf8",
    }).trim() !== "blob"
  )
    continue;
  blobs++;
  if (
    pattern.test(
      execFileSync("git", ["cat-file", "blob", oid], {
        encoding: "utf8",
        maxBuffer: 10000000,
      }),
    )
  )
    hits.push("historical blob " + oid + ": credential pattern");
  if (/(?:^|\/)\.env(?:\.|$)/.test(row.slice(oid.length + 1)))
    hits.push("historical env file");
}
if (hits.length) {
  console.error(hits.join("\n"));
  process.exit(1);
}
console.log(
  `Scanned ${files.length} tracked files and ${blobs} historical blobs: no configured credential patterns or env files. Synthetic fixtures reviewed separately. This pattern scan is not proof of absence.`,
);
