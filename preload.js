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
  saveAnnotation: (bookId, annotation) =>
    ipcRenderer.invoke("save-annotation", bookId, annotation),
  getAnnotations: (bookId) => ipcRenderer.invoke("get-annotations", bookId),
  deleteAnnotation: (bookId, annotationId) =>
    ipcRenderer.invoke("delete-annotation", bookId, annotationId),
  deleteImage: (fileName) => ipcRenderer.invoke("delete-image", fileName),
  explainText: (text, surrounding, contextEnabled) =>
    ipcRenderer.invoke("explain-text", text, surrounding, contextEnabled),
  askFollowUp: (text, surrounding, explanation, history, question) =>
    ipcRenderer.invoke(
      "ask-follow-up",
      text,
      surrounding,
      explanation,
      history,
      question,
    ),
  getLocalAIStatus: () => ipcRenderer.invoke("get-local-ai-status"),
  getLocalAIModels: () => ipcRenderer.invoke("get-local-ai-models"),
  setSelectedLocalAIModel: (modelId) =>
    ipcRenderer.invoke("set-selected-local-ai-model", modelId),
  loadLocalAI: (modelId) => ipcRenderer.invoke("load-local-ai", modelId),
  unloadLocalAI: () => ipcRenderer.invoke("unload-local-ai"),
  deleteLocalAIModel: (modelId) =>
    ipcRenderer.invoke("delete-local-ai-model", modelId),
  onLocalAIDownloadProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("local-ai-download-progress", listener);

    return () => ipcRenderer.removeListener("local-ai-download-progress", listener);
  },
});
