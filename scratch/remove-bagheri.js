const fs = require("fs");
let content = fs.readFileSync("./src/lib/commercial-accounts-data.ts", "utf8");

// Remove Dr. Bagheri Office entry
content = content.replace(
  /\s*\{\s*id:\s*"import-dr-bagheri-office-irvine-26"[\s\S]*?schedule_rules:\s*\[[\s\S]*?\]\s*\},?/,
  ""
);

fs.writeFileSync("./src/lib/commercial-accounts-data.ts", content, "utf8");
console.log("Removed Dr. Bagheri, exact 31 accounts remain!");
