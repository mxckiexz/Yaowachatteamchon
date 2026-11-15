import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Makes sure the demo accounts exist before the browser tests run.
export default async function globalSetup() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync("server/.env", "utf8").split("\n")) {
      const match = line.match(/^([A-Z_]+)="?(.*?)"?$/);
      if (match && !(match[1] in env)) env[match[1]] = match[2];
    }
  } catch {
    // .env is optional when the variables are already in the environment
  }
  execSync("npm run prisma:seed", { cwd: "server", env, stdio: "inherit" });
}
