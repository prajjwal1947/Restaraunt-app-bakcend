const { existsSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

const serverPath = join(__dirname, "dist", "server.js");

if (!existsSync(serverPath)) {
	execFileSync("npm", ["run", "build"], { cwd: __dirname, stdio: "inherit" });
}

require(serverPath);