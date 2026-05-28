const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("fs");
const isDev = !app.isPackaged;
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
