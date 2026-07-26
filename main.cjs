const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("fs");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const {
  deleteBookData,
  getAnnotationsPath: getStoredAnnotationsPath,
  getReadingProgress,
  saveBookFile,
  saveReadingProgress,
} = require("./electron/book-storage.cjs");
const isDev = !app.isPackaged;
const LOCAL_AI_BASE_URL = "http://127.0.0.1:8080";
const LOCAL_AI_MODELS = {
  "gemma-4-e4b": {
    id: "gemma-4-e4b",
    name: "Recommended — Gemma 4 E4B QAT",
    size: "4.2 GB",
    fileName: "gemma-4-E4B-it-qat-UD-Q4_K_XL.gguf",
    downloadUrl:
      "https://huggingface.co/unsloth/gemma-4-E4B-it-qat-GGUF/resolve/main/gemma-4-E4B-it-qat-UD-Q4_K_XL.gguf?download=true",
    advantage: "Best explanation quality with a smaller QAT download.",
    drawback: "Larger download and needs more memory.",
  },
  "gemma-4-e2b": {
    id: "gemma-4-e2b",
    name: "Lite — Gemma 4 E2B",
    size: "2.8 GB",
    fileName: "gemma-4-E2B-it-Q4_0.gguf",
    downloadUrl:
      "https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_0.gguf?download=true",
    advantage: "Smaller download with solid everyday explanations.",
    drawback: "Less reliable with dense or ambiguous academic passages.",
  },
};
const DEFAULT_LOCAL_AI_MODEL_ID = "gemma-4-e4b";

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
    title: "Folio",
    icon: path.join(__dirname, "assets", "folio-icon.png"),
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

function getAnnotationsPath(bookId) {
  return getStoredAnnotationsPath(app.getPath("userData"), bookId);
}

function readAnnotations(bookId) {
  const annotationsPath = getAnnotationsPath(bookId);
  if (!fs.existsSync(annotationsPath)) return [];

  try {
    const annotations = JSON.parse(fs.readFileSync(annotationsPath, "utf8"));
    return Array.isArray(annotations) ? annotations : [];
  } catch {
    return [];
  }
}

function writeAnnotations(bookId, annotations) {
  const annotationsPath = getAnnotationsPath(bookId);
  fs.mkdirSync(path.dirname(annotationsPath), { recursive: true });
  fs.writeFileSync(annotationsPath, JSON.stringify(annotations, null, 2));
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
  const filePath = saveBookFile(app.getPath("userData"), buffer, fileName);
  return { success: true, path: filePath };
});

ipcMain.handle("get-books", async () => {
  const booksDir = path.join(app.getPath("userData"), "books");
  if (!fs.existsSync(booksDir)) return [];
  const files = fs.readdirSync(booksDir).filter((f) => f.endsWith(".pdf"));
  return files.map((f) => ({ name: f, path: path.join(booksDir, f) }));
});
ipcMain.handle("save-page", async (event, fileName, pageNum) => {
  saveReadingProgress(app.getPath("userData"), fileName, pageNum);
  return { success: true };
});

ipcMain.handle("get-page", async (event, fileName) => {
  return getReadingProgress(app.getPath("userData"), fileName);
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
  deleteBookData(app.getPath("userData"), fileName);
  return { success: true };
});

ipcMain.handle("save-annotation", async (_event, bookId, annotation) => {
  if (!bookId || typeof bookId !== "string") {
    throw new Error("A book ID is required to save an annotation.");
  }

  const requiredFields = [
    "pageNumber",
    "selectedText",
    "explanation",
    "startItemIndex",
    "startOffset",
    "endItemIndex",
    "endOffset",
  ];
  if (
    !annotation ||
    requiredFields.some((field) => annotation[field] === undefined || annotation[field] === null)
  ) {
    throw new Error("Annotation is missing required fields.");
  }

  const record = {
    id: randomUUID(),
    bookId,
    pageNumber: annotation.pageNumber,
    selectedText: annotation.selectedText,
    explanation: annotation.explanation,
    contextEnabled: Boolean(annotation.contextEnabled),
    startItemIndex: annotation.startItemIndex,
    startOffset: annotation.startOffset,
    endItemIndex: annotation.endItemIndex,
    endOffset: annotation.endOffset,
    createdAt: new Date().toISOString(),
  };
  const annotations = readAnnotations(bookId);
  annotations.push(record);
  writeAnnotations(bookId, annotations);
  return record;
});

ipcMain.handle("get-annotations", async (_event, bookId) => {
  if (!bookId || typeof bookId !== "string") return [];
  return readAnnotations(bookId);
});

ipcMain.handle("delete-annotation", async (_event, bookId, annotationId) => {
  const annotations = readAnnotations(bookId);
  const remainingAnnotations = annotations.filter(
    (annotation) => annotation.id !== annotationId,
  );
  writeAnnotations(bookId, remainingAnnotations);
  return { success: true };
});

ipcMain.handle("delete-image", async (event, fileName) => {
  const imagePath = path.join(app.getPath("userData"), "images", fileName);
  if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  return { success: true };
});

ipcMain.handle("explain-text", async (_event, text, surrounding, contextEnabled) => {
  const contextualMode = Boolean(contextEnabled);
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
            "You are Folio's reading assistant. Explain the Primary text in simple language. When a Usage sentence is supplied, contextual mode is enabled. In contextual mode, explain what the Primary text means in that specific sentence, what role it plays in the author's point, and how the nearby sentences help clarify or develop that point. Preserve concrete details, distinctions, and relationships stated in the passage. Do not give a generic dictionary definition, repeat the passage without explaining it, or add unrelated facts and examples. Keep every contextual claim grounded in the supplied passage evidence. Respond to contextual requests in 3-4 cohesive sentences. When no Usage sentence is supplied, give a clear, accurate general definition or explanation using reliable general knowledge in 1-2 sentences. Start directly with the explanation. Do not mention the selected text, the primary text, usage sentence, nearby sentences, context mode, or the process of explaining it. Do not use markdown or bullet points.",
        },
        {
          role: "user",
          content: contextualMode
            ? `Task: Give a context-specific explanation. Use the Usage sentence to explain what the selected expression means or does in this passage. Your answer must describe its role in that sentence, not give a standalone dictionary definition.\n\nSelected text:\n${text}\n\nPassage evidence:\n${surrounding}`
            : `Task: Give a concise, accurate definition or explanation of the selected text. You may use general knowledge because no passage context is enabled.\n\nSelected text:\n${text}`,
        },
      ],
      temperature: 0.2,
      max_tokens: contextualMode ? 320 : 180,
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
      "--jinja",
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
