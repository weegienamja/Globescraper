const fs = require("fs");

if (!fs.existsSync(".next")) {
  console.error("[startup] .next folder missing. Build did not run or artifacts not present.");
  process.exit(1);
}

console.log("[startup] .next folder present.");
