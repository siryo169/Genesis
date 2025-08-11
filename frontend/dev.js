// dev.js
const { spawn } = require("child_process");

// Get port and host from command line arguments, with defaults
const port = process.argv[2] || 3000;
const host = process.argv[3] || "0.0.0.0";

const child = spawn(
  "next",
  ["dev", "--turbopack", "-p", port, "-H", host],
  { stdio: "inherit" }
);

child.on("close", (code) => process.exit(code));
