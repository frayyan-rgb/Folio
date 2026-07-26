import { useEffect, useRef, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { hasDuplicateBookName } from "@/lib/books";
import {
  BookOpen,
  FileText,
  ImagePlus,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";

type Book = { name: string; path: string; image?: string; page?: number };
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
  const [selectedModelId, setSelectedModelId] = useState("gemma-4-e4b");
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [isUnloadingModel, setIsUnloadingModel] = useState(false);
  const [isDeletingModel, setIsDeletingModel] = useState(false);
  const [localAIError, setLocalAIError] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [modelLoadPhase, setModelLoadPhase] = useState<
    "downloading" | "loading" | null
  >(null);
  const [downloadSize, setDownloadSize] = useState<{
    completedBytes: number | null;
    totalBytes: number | null;
  }>({ completedBytes: null, totalBytes: null });
  const [showSettings, setShowSettings] = useState(false);
  const settingsCloseButtonRef = useRef<HTMLButtonElement>(null);
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
      const booksWithDetails = await Promise.all(
        savedBooks.map(async (book) => {
          const [imageBuffer, page] = await Promise.all([
            window.electron.getImage(book.name),
            window.electron.getPage(book.name),
          ]);
          if (!imageBuffer) return { ...book, page };
          const imageUrl = URL.createObjectURL(
            new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" }),
          );
          return { ...book, image: imageUrl, page };
        }),
      );

      setBooks(booksWithDetails);
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

  useEffect(() => {
    if (!showSettings) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusFrame = window.requestAnimationFrame(() => {
      settingsCloseButtonRef.current?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowSettings(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [showSettings]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setLibraryError(null);
    const isDuplicate = hasDuplicateBookName(books, file.name);
    if (isDuplicate) {
      setLibraryError("A PDF with this filename is already in your library.");
      input.value = "";
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));
      const result = await window.electron.saveBook(buffer, file.name);
      setBooks((prev) => [
        ...prev,
        { name: file.name, path: result.path, page: 1 },
      ]);
    } catch (error) {
      console.error("Could not add PDF:", error);
      const message = error instanceof Error ? error.message : "";
      setLibraryError(
        message.includes("already in your library")
          ? "A PDF with this filename is already in your library."
          : "Folio could not add this PDF. Check the file and try again.",
      );
    } finally {
      input.value = "";
    }
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
    const confirmed = window.confirm(
      `Remove “${fileName}” and all of its saved data from your library?`,
    );
    if (!confirmed) return;
    setLibraryError(null);
    try {
      await window.electron.deleteBook(fileName);
      setBooks((currentBooks) =>
        currentBooks.filter((book) => book.name !== fileName),
      );
    } catch (error) {
      console.error("Could not delete PDF:", error);
      setLibraryError("Folio could not remove this PDF. Please try again.");
    }
  };

  return (
    <div className="folio-shell min-h-screen p-6 sm:p-8">
      <div className="folio-glass mb-8 flex items-center justify-between gap-4 rounded-2xl px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--folio-border)] bg-[var(--folio-accent-soft)] text-[var(--folio-accent-strong)] shadow-sm">
            <BookOpen size={21} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--folio-accent)]">
              Folio
            </p>
            <h1 className="folio-heading text-2xl font-semibold text-[var(--folio-text)]">
              My Library
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="folio-primary-button inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition">
            <Plus size={16} />
            Add Book
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="folio-secondary-button inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition"
          >
            {loadedModel ? (
              <span className="h-2 w-2 rounded-full bg-[var(--folio-success)]" />
            ) : (
              <Settings size={16} />
            )}
            {loadedModel ? "Local AI ready" : "Settings"}
          </button>
        </div>
      </div>

      {libraryError && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-[var(--folio-danger)]/30 bg-white/35 px-4 py-3 text-sm text-[var(--folio-danger)]"
        >
          {libraryError}
        </div>
      )}

      {localAIError && (
        <p className="-mt-5 mb-5 text-sm text-[var(--folio-danger)]">{localAIError}</p>
      )}


      {books.length === 0 ? (
        <section className="folio-glass flex min-h-80 items-center justify-center rounded-3xl border-dashed px-6 py-12 text-center">
          <div className="max-w-md">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--folio-border)] bg-[var(--folio-surface-raised)] text-[var(--folio-accent-strong)]">
              <BookOpen size={28} strokeWidth={1.7} />
            </div>
            <h2 className="folio-heading text-2xl font-semibold text-[var(--folio-text)]">
              Start your library
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--folio-muted)]">
              Add a PDF to read, save your place, and get private explanations
              for highlighted passages.
            </p>
            <label className="folio-primary-button mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition">
              <Plus size={16} />
              Add your first PDF
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {books.map((book, i) => (
          <Card
            key={i}
            className="folio-book-card group relative cursor-pointer transition duration-200"
            onClick={() => handleOpenBook(book.path, book.name)}
            role="button"
            tabIndex={0}
            aria-label={`Open ${book.name}`}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void handleOpenBook(book.path, book.name);
              }
            }}
          >
            {/* Delete button - subtle, hover only */}
            <button
              type="button"
              aria-label={`Remove ${book.name} from library`}
              onClick={(e) => {
                e.stopPropagation();
                deleteCard(book.name);
              }}
              className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity bg-black/50 hover:bg-red-500/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs cursor-pointer"
            >
              <Trash2 size={13} />
            </button>

            <CardHeader className="p-3 overflow-hidden">
              {/* Cover image area */}
              <div
                className="rounded-md h-48 mb-3 overflow-hidden"
                style={{ backgroundColor: "var(--folio-surface-raised)" }}
              >
                {book.image ? (
                  <div className="relative w-full h-full group/img">
                    <img
                      src={book.image}
                      alt={`Cover for ${book.name}`}
                      className="w-full h-full object-cover rounded-md"
                    />
                    <button
                      type="button"
                      aria-label={`Remove cover image for ${book.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteImage(book.name);
                      }}
                      className="absolute top-1 right-1 opacity-0 group-hover/img:opacity-100 focus-visible:opacity-100 transition-opacity bg-black/60 hover:bg-red-500/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <div
                    className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#a47a62] via-[#78484a] to-[#432f32] px-4 text-center"
                    role="button"
                    tabIndex={0}
                    aria-label={`Add a cover image for ${book.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById(`cover-input-${i}`)?.click();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        document.getElementById(`cover-input-${i}`)?.click();
                      }
                    }}
                  >
                    <FileText className="mb-3 text-[#fff5e7]" size={34} strokeWidth={1.6} />
                    <span className="line-clamp-3 text-sm font-semibold text-white">
                      {book.name.replace(/_/g, " ").replace(".pdf", "")}
                    </span>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#ead9c5]">
                      <ImagePlus size={13} />
                      Add cover image
                    </span>
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
                  style={{ color: "var(--folio-text)" }}
                >
                  {book.name.replace(/_/g, " ").replace(".pdf", "")}
                </p>
                <p className="mt-1 text-xs text-[var(--folio-muted)]">
                  {book.page && book.page > 1
                    ? `Continue on page ${book.page}`
                    : "Not started"}
                </p>
              </div>
            </CardHeader>
          </Card>
          ))}
        </div>
      )}

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#392c23]/35 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowSettings(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="local-ai-settings-title"
            className="folio-glass-strong max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="local-ai-settings-title"
                  className="folio-heading text-2xl font-semibold text-[var(--folio-text)]"
                >
                  Local AI settings
                </h2>
                <p className="mt-1 text-sm text-[var(--folio-muted)]">
                  Models run privately on this Mac. Download one before using
                  explanations.
                </p>
              </div>
              <button
                ref={settingsCloseButtonRef}
                type="button"
                onClick={() => setShowSettings(false)}
                className="rounded-lg px-2 py-1 text-xl leading-none text-[var(--folio-muted)] transition hover:bg-[var(--folio-accent-soft)] hover:text-[var(--folio-accent-strong)]"
                aria-label="Close settings"
              >
                ×
              </button>
            </div>

            {localAIError && (
              <p className="mb-4 text-sm text-[var(--folio-danger)]">{localAIError}</p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-sm font-medium text-[var(--folio-text)]">
                Model
                <select
                  value={selectedModelId}
                  onChange={(event) => handleModelSelection(event.target.value)}
                  disabled={isLoadingModel || isUnloadingModel || isDeletingModel}
                  className="mt-2 block w-full rounded-xl border border-[var(--folio-border)] bg-[var(--folio-surface-raised)] px-3 py-2 text-sm text-[var(--folio-text)] shadow-inner disabled:opacity-50 sm:w-80"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} — {model.size}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                {loadedModel ? (
                  <>
                    <button
                      type="button"
                      onClick={handleUnloadModel}
                      disabled={isUnloadingModel || isDeletingModel}
                      className="folio-primary-button rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50"
                    >
                      {isUnloadingModel ? "Unloading…" : "Unload model"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteModel}
                      disabled={isDeletingModel || isUnloadingModel}
                      className="rounded-xl bg-[var(--folio-danger)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      {isDeletingModel ? "Deleting…" : "Delete model"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleLoadModel}
                      disabled={isLoadingModel || isDeletingModel}
                      className="folio-primary-button rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50"
                    >
                      {isLoadingModel
                        ? localAIStatus === "downloaded"
                          ? "Loading…"
                          : "Downloading…"
                        : localAIStatus === "downloaded"
                          ? "Load model"
                          : "Download model"}
                    </button>
                    {localAIStatus === "downloaded" && (
                      <button
                        type="button"
                        onClick={handleDeleteModel}
                        disabled={isDeletingModel || isLoadingModel}
                        className="rounded-xl bg-[var(--folio-danger)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
                      >
                        {isDeletingModel ? "Deleting…" : "Delete model"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {selectedModel && (
              <div className="mt-5 rounded-xl border border-[var(--folio-border)] bg-[var(--folio-surface-raised)] p-4 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[var(--folio-text)]">
                  <span className="font-medium">{selectedModel.name}</span>
                  <span className="text-[var(--folio-muted)]">{selectedModel.size}</span>
                  <span className={selectedModel.loaded ? "text-[var(--folio-success)]" : selectedModel.downloaded ? "text-[var(--folio-accent)]" : "text-[var(--folio-muted)]"}>
                    {selectedModel.loaded
                      ? "Loaded"
                      : selectedModel.downloaded
                        ? "Downloaded"
                        : "Not downloaded"}
                  </span>
                </div>
                <p className="text-[var(--folio-text)]">Best for: {selectedModel.advantage}</p>
                <p className="mt-1 text-[var(--folio-muted)]">Tradeoff: {selectedModel.drawback}</p>
              </div>
            )}

            {isLoadingModel && modelLoadPhase && (
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-sm text-[var(--folio-text)]">
                  <span>
                    {modelLoadPhase === "downloading"
                      ? "Downloading local AI model"
                      : "Loading local AI model"}
                  </span>
                  {downloadProgress !== null && <span>{downloadProgress}%</span>}
                </div>
                {downloadSize.completedBytes !== null &&
                  downloadSize.totalBytes !== null && (
                    <p className="mb-2 text-xs text-[var(--folio-muted)]">
                      {formatBytes(downloadSize.completedBytes)} / {formatBytes(downloadSize.totalBytes)}
                    </p>
                  )}
                <div className="h-2 overflow-hidden rounded-full bg-[var(--folio-accent-soft)]">
                  <div
                    className="h-full rounded-full bg-[var(--folio-accent-strong)] transition-all duration-300"
                    style={{ width: `${downloadProgress ?? 0}%` }}
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      )}

    </div>
  );
}
