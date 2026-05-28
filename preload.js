const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  saveBook: (buffer, fileName) =>
    ipcRenderer.invoke("save-book", buffer, fileName),
  getBooks: () => ipcRenderer.invoke("get-books"),
  readBook: (filePath) => ipcRenderer.invoke("read-book", filePath),
  savePage: (fileName, pageNum) =>
    ipcRenderer.invoke("save-page", fileName, pageNum),
  getPage: (fileName) => ipcRenderer.invoke("get-page", fileName),
  saveImage: (buffer, fileName) =>
    ipcRenderer.invoke("save-image", buffer, fileName),
  getImage: (fileName) => ipcRenderer.invoke("get-image", fileName),
  deleteBook: (fileName) => ipcRenderer.invoke("delete-book", fileName),
});
