const fs = require("fs");

console.log("[startup] node", process.version);
console.log("[startup] cwd", process.cwd());
console.log("[startup] PORT", process.env.PORT);
console.log("[startup] DATABASE_URL present", Boolean(process.env.DATABASE_URL));
console.log("[startup] BASIC_AUTH present", Boolean(process.env.BASIC_AUTH));
console.log("[startup] BASIC_AUTH_USER present", Boolean(process.env.BASIC_AUTH_USER));
console.log("[startup] BASIC_AUTH_PASS present", Boolean(process.env.BASIC_AUTH_PASS));
console.log("[startup] .next present", fs.existsSync(".next"));
console.log("[startup] package.json present", fs.existsSync("package.json"));
