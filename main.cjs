const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("fs");
const { spawn } = require("node:child_process");
const isDev = !app.isPackaged;
const LOCAL_AI_BASE_URL = "http://127.0.0.1:8080";
const LOCAL_AI_MODELS = {
  "qwen-4b": {
    id: "qwen-4b",
    name: "Recommended — Qwen 3.5 4B",
    size: "1.94 GB",
    fileName: "Qwen3.5-4B-UD-Q2_K_XL.gguf",
    downloadUrl:
      "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-UD-Q2_K_XL.gguf?download=true",
    advantage: "More accurate explanations and stronger context handling.",
    drawback: "Larger download and uses more memory.",
  },
  "qwen-0.8b": {
    id: "qwen-0.8b",
    name: "Lite — Qwen 3.5 0.8B",
    size: "812 MB",
    fileName: "Qwen3.5-0.8B-Q8_0.gguf",
    downloadUrl:
      "https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q8_0.gguf?download=true",
    advantage: "Much smaller download and faster to load.",
    drawback: "Less reliable with dense or ambiguous academic passages.",
  },
};
const DEFAULT_LOCAL_AI_MODEL_ID = "qwen-4b";

let localAIProcess = null;
let localAIStartupProgress = null;
let loadedLocalAIModelId = null;

function setLocalAIStartupProgress(progress) {
  localAIStartupProgress = progress;

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("local-ai-download-progress", progress);
  }
}

function getLlamaServerPath() {
  const target = `${process.platform}-${process.arch}`;
  const executableName = process.platform === "win32" ? "llama-server.exe" : "llama-server";
  const resourcesDirectory = isDev
    ? path.join(__dirname, "resources")
    : process.resourcesPath;
  const bundledServerPath = path.join(
    resourcesDirectory,
    "llama",
    target,
    executableName,
  );

  if (fs.existsSync(bundledServerPath)) {
    return bundledServerPath;
  }

  if (isDev) {
    return "llama-server";
  }

  throw new Error(`Folio's local AI runtime is missing: ${bundledServerPath}`);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (isDev) {
    win.loadURL("http://localhost:5173/");
  } else {
    win.loadFile(path.join(__dirname, "dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (localAIProcess && !localAIProcess.killed) {
    localAIProcess.kill("SIGTERM");
  }
});

ipcMain.handle("save-book", async (event, buffer, fileName) => {
  const booksDir = path.join(app.getPath("userData"), "books");
  if (!fs.existsSync(booksDir)) fs.mkdirSync(booksDir);
  const filePath = path.join(booksDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(buffer));
  return { success: true, path: filePath }; // return the path
});

ipcMain.handle("get-books", async () => {
  const booksDir = path.join(app.getPath("userData"), "books");
  if (!fs.existsSync(booksDir)) return [];
  const files = fs.readdirSync(booksDir).filter((f) => f.endsWith(".pdf"));
  return files.map((f) => ({ name: f, path: path.join(booksDir, f) }));
});
ipcMain.handle("save-page", async (event, fileName, pageNum) => {
  const progressPath = path.join(app.getPath("userData"), "progress.json");
  let progress = {};
  if (fs.existsSync(progressPath)) {
    progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));
  }
  progress[fileName] = pageNum;
  fs.writeFileSync(progressPath, JSON.stringify(progress));
  return { success: true };
});

ipcMain.handle("get-page", async (event, fileName) => {
  const progressPath = path.join(app.getPath("userData"), "progress.json");
  if (!fs.existsSync(progressPath)) return 1;
  const progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));
  return progress[fileName] || 1;
});

ipcMain.handle("save-image", async (event, buffer, fileName) => {
  // create an images folder in app data if it doesn't exist
  const imagesDir = path.join(app.getPath("userData"), "images");
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);

  // write the image bytes to disk
  fs.writeFileSync(path.join(imagesDir, fileName), Buffer.from(buffer));

  // return the path where it was saved
  return path.join(imagesDir, fileName);
});

ipcMain.handle("get-image", async (event, fileName) => {
  const imagePath = path.join(app.getPath("userData"), "images", fileName);
  if (!fs.existsSync(imagePath)) return null; // image doesn't exist yet
  const buffer = fs.readFileSync(imagePath); // read bytes from disk
  return Array.from(buffer); // convert to plain array for IPC
});

ipcMain.handle("read-book", async (event, filePath) => {
  const buffer = fs.readFileSync(filePath);
  return Array.from(buffer);
});

ipcMain.handle("delete-book", async (event, fileName) => {
  const booksDir = path.join(app.getPath("userData"), "books");
  fs.unlinkSync(path.join(booksDir, fileName));
});

ipcMain.handle("save-api-key", async (event, apiKey) => {
  const settingsPath = path.join(app.getPath("userData"), "settings.json");
  fs.writeFileSync(settingsPath, JSON.stringify({ apiKey }));
  return { success: true };
});

ipcMain.handle("get-api-key", async () => {
  const settingsPath = path.join(app.getPath("userData"), "settings.json");
  if (!fs.existsSync(settingsPath)) return null;
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  return settings.apiKey || null;
});

ipcMain.handle("delete-image", async (event, fileName) => {
  const imagePath = path.join(app.getPath("userData"), "images", fileName);
  if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  return { success: true };
});

ipcMain.handle("explain-text", async (_event, text, surrounding) => {
  console.log("Selected text:", text);
  console.log("Surrounding context:", surrounding);
  const response = await fetch(`${LOCAL_AI_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "local-model",
      messages: [
        {
          role: "system",
          content:
            "You are Folio's reading assistant. Explain the selected text in simple language. The Primary line contains the selected text and is the source of truth for its meaning. Nearby context is only supporting information and may be unrelated. Do not combine facts, people, or events from different lines unless the Primary line explicitly connects them. Do not invent examples, studies, student actions, qualities, outcomes, comparisons, or benefits. Do not infer that something replaces, bypasses, causes, improves, or leads to something else unless the passage explicitly says so. When the passage reports categories, percentages, or survey results, preserve what they state without assigning extra meaning to a category; for example, do not assume leisure time means non-academic use. Keep important numbers when they are central to the selected text. If the passage makes a general claim, keep your explanation general; do not turn it into a specific scenario. Start directly with what the passage means. Do not mention the selected text, the primary line, nearby context, or the process of explaining it. Do not add facts that the passage does not state. Respond in 2-3 sentences without markdown or bullet points.",
        },
        {
          role: "user",
          content: `Selected text:\n${text}\n\nStructured context:\n${surrounding}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 180,
    }),
  });

  if (!response.ok) {
    throw new Error(`Local AI returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const explanation = data.choices?.[0]?.message?.content;

  if (!explanation) {
    throw new Error("Local AI returned an empty response");
  }

  return explanation;
});

ipcMain.handle(
  "ask-follow-up",
  async (_event, text, surrounding, explanation, history, question) => {
    const recentHistory = Array.isArray(history) ? history.slice(-3) : [];
    const conversation = recentHistory
      .map(
        (turn) => `User: ${turn.question}\nAssistant: ${turn.answer}`,
      )
      .join("\n\n");

    const response = await fetch(`${LOCAL_AI_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "local-model",
        messages: [
          {
            role: "system",
            content:
              "You are Folio's reading assistant. Answer the user's follow-up about the selected passage. Use the selected text as the source of truth and nearby context only as support. Stay grounded in the passage. Do not invent examples, studies, people, actions, or outcomes that the passage does not state. Correct any misunderstanding gently, and answer clearly without markdown.",
          },
          {
            role: "user",
            content: `Selected text:\n${text}\n\nStructured context:\n${surrounding}\n\nFolio's initial explanation:\n${explanation}\n\nPrevious follow-ups:\n${conversation || "None"}\n\nNew follow-up question:\n${question}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 220,
      }),
    });

    if (!response.ok) {
      throw new Error(`Local AI returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    if (!answer) throw new Error("Local AI returned an empty response");

    return answer;
  },
);

function getLocalAIModelCacheDirectory() {
  return path.join(app.getPath("userData"), "models");
}

function getLocalAISettingsPath() {
  return path.join(app.getPath("userData"), "local-ai-settings.json");
}

function getSelectedLocalAIModelId() {
  try {
    const settings = JSON.parse(fs.readFileSync(getLocalAISettingsPath(), "utf8"));
    return LOCAL_AI_MODELS[settings.selectedModelId]
      ? settings.selectedModelId
      : DEFAULT_LOCAL_AI_MODEL_ID;
  } catch {
    return DEFAULT_LOCAL_AI_MODEL_ID;
  }
}

function setSelectedLocalAIModelId(modelId) {
  fs.writeFileSync(
    getLocalAISettingsPath(),
    JSON.stringify({ selectedModelId: modelId }),
  );
}

function getLocalAIModel(modelId) {
  const model = LOCAL_AI_MODELS[modelId];
  if (!model) throw new Error("Unknown local AI model.");
  return model;
}

function isLocalAIModelDownloaded(modelId) {
  const model = getLocalAIModel(modelId);
  return fs.existsSync(path.join(getLocalAIModelCacheDirectory(), model.fileName));
}

function getLocalAIStatus(modelId) {
  if (loadedLocalAIModelId === modelId) return "loaded";
  return isLocalAIModelDownloaded(modelId) ? "downloaded" : "none";
}

async function downloadLocalAIModel(model) {
  const modelsDirectory = getLocalAIModelCacheDirectory();
  const modelPath = path.join(modelsDirectory, model.fileName);
  const partialModelPath = `${modelPath}.download`;

  fs.mkdirSync(modelsDirectory, { recursive: true });
  fs.rmSync(partialModelPath, { force: true });

  const response = await fetch(model.downloadUrl);
  if (!response.ok || !response.body) {
    fs.rmSync(partialModelPath, { force: true });
    throw new Error(`Model download failed (HTTP ${response.status}).`);
  }

  const totalBytes =
    Number(
      response.headers.get("content-length") || response.headers.get("x-linked-size"),
    ) || null;
  const reader = response.body.getReader();
  const fileDescriptor = fs.openSync(partialModelPath, "w");
  let completedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      fs.writeSync(fileDescriptor, value);
      completedBytes += value.byteLength;
      setLocalAIStartupProgress({
        modelId: model.id,
        phase: "downloading",
        percent: totalBytes
          ? Math.min(100, Math.round((completedBytes / totalBytes) * 100))
          : null,
        completedBytes,
        totalBytes,
      });
    }
  } catch (error) {
    fs.closeSync(fileDescriptor);
    fs.rmSync(partialModelPath, { force: true });
    throw error;
  }

  fs.closeSync(fileDescriptor);
  fs.renameSync(partialModelPath, modelPath);
}

ipcMain.handle("get-local-ai-status", async () => {
  const modelId = getSelectedLocalAIModelId();
  if (await isLocalAIReady()) {
    return { status: getLocalAIStatus(modelId), startupProgress: null };
  }

  return { status: getLocalAIStatus(modelId), startupProgress: localAIStartupProgress };
});

ipcMain.handle("get-local-ai-models", async () => {
  const selectedModelId = getSelectedLocalAIModelId();
  return {
    selectedModelId,
    loadedModelId: loadedLocalAIModelId,
    startupProgress: localAIStartupProgress,
    models: Object.values(LOCAL_AI_MODELS).map((model) => ({
      ...model,
      downloaded: isLocalAIModelDownloaded(model.id),
      loaded: loadedLocalAIModelId === model.id,
    })),
  };
});

ipcMain.handle("set-selected-local-ai-model", async (_event, modelId) => {
  getLocalAIModel(modelId);
  setSelectedLocalAIModelId(modelId);
  return { selectedModelId: modelId };
});

async function isLocalAIReady() {
  try {
    const response = await fetch(`${LOCAL_AI_BASE_URL}/v1/models`);
    return response.ok;
  } catch {
    return false;
  }
}
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForLocalAIReady() {
  const deadline = Date.now() + 20 * 60_000;

  while (Date.now() < deadline) {
    if (await isLocalAIReady()) {
      return;
    }

    await wait(250);
  }

  throw new Error("Local AI took too long to start.");
}

ipcMain.handle("load-local-ai", async (_event, modelId) => {
  const model = getLocalAIModel(modelId || getSelectedLocalAIModelId());
  setSelectedLocalAIModelId(model.id);

  if (await isLocalAIReady()) {
    if (loadedLocalAIModelId === model.id) return { status: "loaded" };
    throw new Error("Unload the currently loaded model before loading another one.");
  }

  if (localAIProcess) {
    throw new Error("Local AI is already starting.");
  }

  const modelWasAlreadyDownloaded = isLocalAIModelDownloaded(model.id);

  if (!modelWasAlreadyDownloaded) {
    setLocalAIStartupProgress({
      modelId: model.id,
      phase: "downloading",
      percent: 0,
      completedBytes: 0,
      totalBytes: null,
    });
    try {
      await downloadLocalAIModel(model);
    } catch (error) {
      localAIStartupProgress = null;
      throw error;
    }
  }

  setLocalAIStartupProgress({
    modelId: model.id,
    phase: "loading",
    percent: 100,
    completedBytes: null,
    totalBytes: null,
  });

  localAIProcess = spawn(
    getLlamaServerPath(),
    [
      "-m",
      path.join(getLocalAIModelCacheDirectory(), model.fileName),
      "--no-mmproj",
      "--host",
      "127.0.0.1",
      "--port",
      "8080",
      "--ctx-size",
      "8192",
      "--n-gpu-layers",
      "99",
      "--reasoning",
      "off",
    ],
    {
      stdio: "pipe",
    },
  );

  localAIProcess.stderr.on("data", (data) => {
    console.log(`[Local AI] ${data}`);
  });

  localAIProcess.on("exit", () => {
    localAIProcess = null;
    loadedLocalAIModelId = null;
  });

  try {
    const processToStart = localAIProcess;
    const processFailure = new Promise((_, reject) => {
      processToStart.once("error", reject);
      processToStart.once("exit", (code) => {
        reject(new Error(`Local AI stopped before becoming ready (code ${code}).`));
      });
    });

    await Promise.race([waitForLocalAIReady(), processFailure]);
    setLocalAIStartupProgress({
      modelId: model.id,
      phase: "loading",
      percent: 100,
      completedBytes: null,
      totalBytes: null,
    });
    loadedLocalAIModelId = model.id;
    localAIStartupProgress = null;
    return { status: "loaded" };
  } catch (error) {
    if (localAIProcess && !localAIProcess.killed) {
      localAIProcess.kill("SIGTERM");
    }
    localAIProcess = null;
    loadedLocalAIModelId = null;
    localAIStartupProgress = null;
    throw error;
  }
});

async function stopLocalAIProcess() {
  if (!localAIProcess) return;
  const processToStop = localAIProcess;

  await new Promise((resolve) => {
    const forceStopTimer = setTimeout(() => {
      if (!processToStop.killed) {
        processToStop.kill("SIGKILL");
      }
    }, 5_000);

    processToStop.once("exit", () => {
      clearTimeout(forceStopTimer);
      resolve();
    });

    if (!processToStop.killed) {
      processToStop.kill("SIGTERM");
    }
  });
}

ipcMain.handle("unload-local-ai", async () => {
  if (!localAIProcess && (await isLocalAIReady())) {
    throw new Error("Local AI was not started by Folio and cannot be unloaded here.");
  }

  await stopLocalAIProcess();

  const selectedModelId = getSelectedLocalAIModelId();
  return { status: getLocalAIStatus(selectedModelId) };
});

ipcMain.handle("delete-local-ai-model", async (_event, modelId) => {
  const model = getLocalAIModel(modelId || getSelectedLocalAIModelId());
  const modelPath = path.join(getLocalAIModelCacheDirectory(), model.fileName);
  if (!localAIProcess && (await isLocalAIReady())) {
    throw new Error(
      "Local AI was not started by Folio. Stop that server before deleting its model.",
    );
  }

  if (loadedLocalAIModelId === model.id) {
    await stopLocalAIProcess();
  }
  fs.rmSync(modelPath, { force: true });

  if (fs.existsSync(modelPath)) {
    throw new Error(`Folio could not delete ${model.fileName}.`);
  }

  localAIStartupProgress = null;

  return { status: getLocalAIStatus(model.id) };
});
