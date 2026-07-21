import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";

type Book = { name: string; path: string; image?: string };
type LocalAIStatus = "loaded" | "downloaded" | "none";
type LocalAIModel = {
  id: string;
  name: string;
  size: string;
  advantage: string;
  drawback: string;
  downloaded: boolean;
  loaded: boolean;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
};

type Props = {
  onSelectBook: (file: File) => void;
};

export default function HomeScreen({ onSelectBook }: Props) {
  const [books, setBooks] = useState<Book[]>([]);
  const [localAIStatus, setLocalAIStatus] = useState<LocalAIStatus>("none");
  const [models, setModels] = useState<LocalAIModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("qwen-4b");
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [isUnloadingModel, setIsUnloadingModel] = useState(false);
  const [isDeletingModel, setIsDeletingModel] = useState(false);
  const [localAIError, setLocalAIError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [modelLoadPhase, setModelLoadPhase] = useState<
    "downloading" | "loading" | null
  >(null);
  const [downloadSize, setDownloadSize] = useState<{
    completedBytes: number | null;
    totalBytes: number | null;
  }>({ completedBytes: null, totalBytes: null });
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const handleSaveApiKey = async () => {
    await window.electron.saveApiKey(apiKey);
    setShowApiModal(false);
  };

  const deleteImage = async (fileName: string) => {
    await window.electron.deleteImage(fileName);
    setBooks(
      books.map((book) =>
        book.name === fileName ? { ...book, image: undefined } : book,
      ),
    );
  };

  const refreshLocalAIState = async () => {
    const [statusResult, modelsResult] = await Promise.all([
      window.electron.getLocalAIStatus(),
      window.electron.getLocalAIModels(),
    ]);

    setLocalAIStatus(statusResult.status);
    setModels(modelsResult.models);
    setSelectedModelId(modelsResult.selectedModelId);
  };

  const handleLoadModel = async () => {
    const currentStatus = await window.electron.getLocalAIStatus();
    setLocalAIStatus(currentStatus.status);

    if (currentStatus.status === "loaded") return;
    if (currentStatus.startupProgress) return;

    setIsLoadingModel(true);
    setModelLoadPhase(
      currentStatus.status === "downloaded" ? "loading" : "downloading",
    );
    setDownloadProgress(currentStatus.status === "downloaded" ? 100 : 0);
    setDownloadSize({ completedBytes: null, totalBytes: null });

    try {
      const result = await window.electron.loadLocalAI(selectedModelId);
      setLocalAIStatus(result.status);
      await refreshLocalAIState();
    } catch (error) {
      console.error("Failed to load local AI:", error);
    } finally {
      setIsLoadingModel(false);
      setModelLoadPhase(null);
      setDownloadProgress(null);
      setDownloadSize({ completedBytes: null, totalBytes: null });
    }
  };

  const handleUnloadModel = async () => {
    setIsUnloadingModel(true);

    try {
      const result = await window.electron.unloadLocalAI();
      setLocalAIStatus(result.status);
      await refreshLocalAIState();
    } catch (error) {
      console.error("Failed to unload local AI:", error);
    } finally {
      setIsUnloadingModel(false);
    }
  };

  const handleDeleteModel = async () => {
    const confirmed = window.confirm(
      "Delete the downloaded local AI model? You will need to download it again before using Explain.",
    );

    if (!confirmed) return;

    setIsDeletingModel(true);
    setLocalAIError(null);

    try {
      const result = await window.electron.deleteLocalAIModel(selectedModelId);
      setLocalAIStatus(result.status);
      await refreshLocalAIState();
    } catch (error) {
      console.error("Failed to delete local AI model:", error);
      setLocalAIError(
        error instanceof Error ? error.message : "Folio could not delete the model.",
      );
    } finally {
      setIsDeletingModel(false);
    }
  };

  const handleModelSelection = async (modelId: string) => {
    try {
      await window.electron.setSelectedLocalAIModel(modelId);
      setSelectedModelId(modelId);
      const status = await window.electron.getLocalAIStatus();
      setLocalAIStatus(status.status);
    } catch (error) {
      console.error("Failed to select local AI model:", error);
    }
  };

  useEffect(() => {
    const loadBooks = async () => {
      const savedBooks = await window.electron.getBooks();

      // load image for each book
      const booksWithImages = await Promise.all(
        savedBooks.map(async (book) => {
          const imageBuffer = await window.electron.getImage(book.name);
          if (!imageBuffer) return book;
          const blob = new Blob([new Uint8Array(imageBuffer)], {
            type: "image/jpeg",
          });
          const imageUrl = URL.createObjectURL(blob);
          return { ...book, image: imageUrl };
        }),
      );

      setBooks(booksWithImages);
    };

    const loadLocalAIStatus = async () => {
      try {
        const result = await window.electron.getLocalAIStatus();
        setLocalAIStatus(result.status);

        if (result.startupProgress) {
          setIsLoadingModel(true);
          setModelLoadPhase(result.startupProgress.phase);
          setDownloadProgress(result.startupProgress.percent);
          setDownloadSize({
            completedBytes: result.startupProgress.completedBytes,
            totalBytes: result.startupProgress.totalBytes,
          });
        }
      } catch (error) {
        console.error("Failed to check local AI status:", error);
      }
    };

    const loadLocalAIModels = async () => {
      try {
        const result = await window.electron.getLocalAIModels();
        setModels(result.models);
        setSelectedModelId(result.selectedModelId);
      } catch (error) {
        console.error("Failed to load local AI models:", error);
      }
    };

    const removeDownloadProgressListener =
      window.electron.onLocalAIDownloadProgress(
        ({ phase, percent, completedBytes, totalBytes }) => {
        setModelLoadPhase(phase);
        setDownloadProgress(percent);
        setDownloadSize({ completedBytes, totalBytes });
        },
      );

    loadBooks();
    loadLocalAIStatus();
    loadLocalAIModels();

    return removeDownloadProgressListener;
  }, []);

  const selectedModel = models.find((model) => model.id === selectedModelId);
  const loadedModel = models.find((model) => model.loaded);

  useEffect(() => {
    if (!isLoadingModel) return;

    const checkWhenReady = async () => {
      try {
        const result = await window.electron.getLocalAIStatus();

        if (result.status === "loaded") {
          setLocalAIStatus("loaded");
          setIsLoadingModel(false);
          setModelLoadPhase(null);
          setDownloadProgress(null);
          setDownloadSize({ completedBytes: null, totalBytes: null });
          const modelsResult = await window.electron.getLocalAIModels();
          setModels(modelsResult.models);
          setSelectedModelId(modelsResult.selectedModelId);
        }
      } catch (error) {
        console.error("Failed to refresh local AI status:", error);
      }
    };

    checkWhenReady();
    const interval = window.setInterval(checkWhenReady, 500);

    return () => window.clearInterval(interval);
  }, [isLoadingModel]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Array.from(new Uint8Array(arrayBuffer));
    const result = await window.electron.saveBook(buffer, file.name);
    console.log("save result:", result); // add here
    setBooks((prev) => [...prev, { name: file.name, path: result.path }]); // use real path
  };
  const handleImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    bookIndex: number,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Array.from(new Uint8Array(arrayBuffer));
    await window.electron.saveImage(buffer, books[bookIndex].name); // changed this line
    const imageUrl = URL.createObjectURL(file);
    setBooks((prev) =>
      prev.map((book, i) =>
        i === bookIndex ? { ...book, image: imageUrl } : book,
      ),
    );
  };

  const handleOpenBook = async (bookPath: string, bookName: string) => {
    const buffer = await window.electron.readBook(bookPath);
    const file = new File([new Uint8Array(buffer)], bookName, {
      type: "application/pdf",
    });
    onSelectBook(file);
  };
  const deleteCard = async (fileName: string) => {
    await window.electron.deleteBook(fileName);
    setBooks(books.filter((book) => book.name !== fileName));
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[#f0f0f0]">My Library</h1>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer bg-white hover:bg-gray-100 text-gray-900 text-sm font-medium px-4 py-2 rounded-lg transition">
            + Add Book
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {loadedModel ? (
            <>
              <span className="text-sm text-green-400">{loadedModel.name} Loaded</span>
              <button
                type="button"
                onClick={handleUnloadModel}
                disabled={isUnloadingModel || isDeletingModel}
                className="bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-900 text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                {isUnloadingModel ? "Unloading Model..." : "Unload Model"}
              </button>
              <button
                type="button"
                onClick={handleDeleteModel}
                disabled={isDeletingModel || isUnloadingModel}
                className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                {isDeletingModel ? "Deleting Model..." : "Delete Model"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleLoadModel}
                disabled={isLoadingModel || isDeletingModel}
                className="bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-900 text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                {isLoadingModel
                  ? localAIStatus === "downloaded"
                    ? "Loading Model..."
                    : "Downloading Model..."
                  : localAIStatus === "downloaded"
                    ? "Load Model"
                    : "Download Model"}
              </button>
              {localAIStatus === "downloaded" && (
                <button
                  type="button"
                  onClick={handleDeleteModel}
                  disabled={isDeletingModel || isLoadingModel}
                  className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                  {isDeletingModel ? "Deleting Model..." : "Delete Model"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {localAIError && (
        <p className="-mt-5 mb-5 text-sm text-red-400">{localAIError}</p>
      )}

      <section className="mb-6 max-w-2xl rounded-xl border border-[#3a3a3a] bg-[#242424] p-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#f0f0f0]">Local AI model</h2>
            <p className="text-xs text-[#9f9f9f]">Choose which private model Folio uses for explanations.</p>
          </div>
          <select
            value={selectedModelId}
            onChange={(event) => handleModelSelection(event.target.value)}
            disabled={isLoadingModel || isUnloadingModel || isDeletingModel}
            className="rounded-lg border border-[#555] bg-[#333] px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} — {model.size}
              </option>
            ))}
          </select>
        </div>

        {selectedModel && (
          <div className="rounded-lg bg-[#2e2e2e] p-3 text-sm">
            <div className="mb-2 flex items-center gap-2 text-[#f0f0f0]">
              <span className="font-medium">{selectedModel.name}</span>
              <span className="text-[#aaa]">{selectedModel.size}</span>
              {selectedModel.loaded ? (
                <span className="text-green-400">Loaded</span>
              ) : selectedModel.downloaded ? (
                <span className="text-blue-300">Downloaded</span>
              ) : (
                <span className="text-[#aaa]">Not downloaded</span>
              )}
            </div>
            <p className="text-[#d0d0d0]">Best for: {selectedModel.advantage}</p>
            <p className="mt-1 text-[#aaa]">Tradeoff: {selectedModel.drawback}</p>
          </div>
        )}

        <div className="mt-3 space-y-1 text-xs text-[#aaa]">
          {models.map((model) => (
            <div key={model.id} className="flex items-center justify-between">
              <span>{model.name} · {model.size}</span>
              <span className={model.loaded ? "text-green-400" : model.downloaded ? "text-blue-300" : "text-[#888]"}>
                {model.loaded ? "Loaded" : model.downloaded ? "Downloaded" : "Not downloaded"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {isLoadingModel && modelLoadPhase && (
        <div className="mb-6 max-w-sm">
          <div className="mb-2 flex justify-between text-sm text-[#cfcfcf]">
            <span>
              {modelLoadPhase === "downloading"
                ? "Downloading local AI model"
                : "Loading local AI model"}
            </span>
            {downloadProgress !== null && <span>{downloadProgress}%</span>}
          </div>
          {downloadSize.completedBytes !== null &&
            downloadSize.totalBytes !== null && (
              <p className="mb-2 text-xs text-[#9f9f9f]">
                {formatBytes(downloadSize.completedBytes)} /{" "}
                {formatBytes(downloadSize.totalBytes)}
              </p>
            )}
          <div className="h-2 overflow-hidden rounded-full bg-[#3a3a3a]">
            <div
              className="h-full rounded-full bg-white transition-all duration-300"
              style={{ width: `${downloadProgress ?? 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {books.map((book, i) => (
          <Card
            key={i}
            className="cursor-pointer transition group relative"
            style={{ backgroundColor: "#2a2a2a", border: "1px solid #333" }}
            onClick={() => handleOpenBook(book.path, book.name)}
          >
            {/* Delete button - subtle, hover only */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteCard(book.name);
              }}
              className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-red-500/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs cursor-pointer "
            >
              ✕
            </button>

            <CardHeader className="p-3 overflow-hidden">
              {/* Cover image area */}
              <div
                className="rounded-md h-48 mb-3 overflow-hidden"
                style={{ backgroundColor: "#3a3a3a" }}
              >
                {book.image ? (
                  <div className="relative w-full h-full group/img">
                    <img
                      src={book.image}
                      className="w-full h-full object-cover rounded-md"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteImage(book.name);
                      }}
                      className="absolute top-1 right-1 opacity-0 group-hover/img:opacity-50 transition-opacity bg-black/60 hover:bg-red-500/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs cursor-pointer"
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center gap-2 text-sm font-normal text-white cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById(`cover-input-${i}`)?.click();
                    }}
                  >
                    📄 Choose Image
                    <input
                      id={`cover-input-${i}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleImageChange(e, i)}
                    />
                  </div>
                )}
              </div>

              {/* Title - underscores replaced with spaces */}
              <div className="w-full overflow-hidden">
                <p
                  className="break-words text-sm font-medium"
                  style={{ color: "#f0f0f0" }}
                >
                  {book.name.replace(/_/g, " ").replace(".pdf", "")}
                </p>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {showApiModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="rounded-2xl p-6 w-96"
            style={{ backgroundColor: "#2a2a2a", border: "1px solid #444" }}
          >
            <h2
              className="text-lg font-semibold mb-1"
              style={{ color: "#f0f0f0" }}
            >
              OpenRouter API Key
            </h2>
            <p className="text-xs mb-4" style={{ color: "#888" }}>
              Your key is saved locally and never leaves your device.
            </p>
            <input
              type="password"
              placeholder="sk-or-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm mb-4 outline-none"
              style={{
                backgroundColor: "#3a3a3a",
                color: "#f0f0f0",
                border: "1px solid #555",
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowApiModal(false)}
                className="px-4 py-2 text-sm rounded-lg"
                style={{ backgroundColor: "#3a3a3a", color: "#888" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 text-sm rounded-lg font-medium"
                style={{ backgroundColor: "#fff", color: "#111" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
