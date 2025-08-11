// dev.js
const { spawn } = require("child_process");
const path = require("path");
// Get port and host from command line arguments, with defaults
const port = process.argv[2] || 3000;
const host = process.argv[3] || "0.0.0.0";

const nextBin = path.join(__dirname, "node_modules", ".bin", "next");

const child = spawn(
  nextBin,
  ["dev", "--turbopack", "-p", port, "-H", host],
  { stdio: "inherit", shell: process.platform === "win32" }
);

child.on("close", (code) => process.exit(code));
