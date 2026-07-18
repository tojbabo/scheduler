import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const cargoBin = join(homedir(), ".cargo", "bin");
process.env.PATH = `${cargoBin}${delimiter}${process.env.PATH ?? ""}`;

const args = process.argv.slice(2);
const quote = (value) => `"${String(value).replaceAll('"', '\\"')}"`;
const command = ["tauri", ...args].map(quote).join(" ");

const child = spawn(command, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
