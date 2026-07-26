const { spawn } = require("node:child_process");
const path = require("node:path");

const projectDirectory = path.join(__dirname, "..");
const childEnvironment = { ...process.env };
delete childEnvironment.ELECTRON_RUN_AS_NODE;

const spawnLocalTool = (toolName, arguments_) =>
  spawn(path.join(projectDirectory, "node_modules", ".bin", toolName), arguments_, {
    cwd: projectDirectory,
    env: childEnvironment,
    stdio: "inherit",
  });

const viteProcess = spawnLocalTool("vite", [
  "--host",
  "127.0.0.1",
  "--port",
  "5173",
  "--strictPort",
]);
let forgeProcess = null;
let isShuttingDown = false;

const stopChildren = () => {
  if (forgeProcess && !forgeProcess.killed) forgeProcess.kill("SIGTERM");
  if (!viteProcess.killed) viteProcess.kill("SIGTERM");
};

const shutdown = (exitCode) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  stopChildren();
  process.exitCode = exitCode;
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", stopChildren);

viteProcess.on("error", (error) => {
  console.error("Could not start Vite:", error);
  shutdown(1);
});

viteProcess.on("exit", (code) => {
  if (!isShuttingDown && !forgeProcess) shutdown(code ?? 1);
});

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForVite() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:5173/");
      if (response.ok) return;
    } catch {
      // Vite has not opened its port yet.
    }
    await wait(100);
  }
  throw new Error("Vite did not become ready within 30 seconds.");
}

async function start() {
  try {
    await waitForVite();
    forgeProcess = spawnLocalTool("electron-forge", ["start"]);
    forgeProcess.on("error", (error) => {
      console.error("Could not start Electron Forge:", error);
      shutdown(1);
    });
    forgeProcess.on("exit", (code) => shutdown(code ?? 0));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    shutdown(1);
  }
}

void start();
