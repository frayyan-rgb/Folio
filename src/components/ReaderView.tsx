import { useCallback, useEffect, useState, useRef } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import SaveHighlighted from "./SaveHighlighted";
import { getNextPage, getPreviousPage } from "@/lib/reader";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type Props = {
  file: File;
  onBack: () => void;
};

export default function ReaderView({ file, onBack }: Props) {
  const [pageNum, setPageNum] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageText, setPageText] = useState("");
  const [isDocumentLoading, setIsDocumentLoading] = useState(true);
  const [isPageRendering, setIsPageRendering] = useState(true);
  const [readerError, setReaderError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => setContainerWidth(container.clientWidth);
    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    window.electron.getPage(file.name).then((page) => {
      setPageNum(page);
      setPageInput(String(page));
      setPageLoaded(true);
    });
  }, [file.name]);

  useEffect(() => {
    if (pageLoaded && pageNum > 0) {
      window.electron.savePage(file.name, pageNum);
    }
  }, [file.name, pageNum, pageLoaded]);

  const goToPrevPage = useCallback(
    () => {
      const nextPage = getPreviousPage(pageNum);
      setPageText("");
      setIsPageRendering(true);
      setPageNum(nextPage);
      setPageInput(String(nextPage));
    },
    [pageNum],
  );
  const goToNextPage = useCallback(
    () => {
      const nextPage = getNextPage(pageNum, totalPages);
      setPageText("");
      setIsPageRendering(true);
      setPageNum(nextPage);
      setPageInput(String(nextPage));
    },
    [pageNum, totalPages],
  );

  const commitPageInput = () => {
    const requestedPage = Number(pageInput);
    if (!pageInput || !Number.isInteger(requestedPage) || requestedPage < 1) {
      setPageInput(String(pageNum));
      return;
    }

    const nextPage = Math.min(requestedPage, totalPages);
    setPageText("");
    setIsPageRendering(true);
    setPageNum(nextPage);
    setPageInput(String(nextPage));
  };
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevPage();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNextPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [goToNextPage, goToPrevPage]);

  return (
    <div
      className="folio-shell min-h-screen flex flex-col"
    >
      {!readerError && (
        <SaveHighlighted
          key={`${file.name}:${pageNum}`}
          pageText={pageText}
          bookId={file.name}
          pageNumber={pageNum}
        />
      )}

      {/* Header */}
      <div
        className="folio-reader-header fixed top-0 left-0 right-0 z-30 flex flex-col"
      >
        {/* Title row */}
        <div className="px-6 py-2 flex items-center gap-4 min-w-0">
          <button
            onClick={onBack}
            type="button"
            className="inline-flex flex-shrink-0 items-center gap-1.5 text-sm font-medium text-[var(--folio-accent-strong)] hover:text-[var(--folio-accent)]"
          >
            <ArrowLeft size={15} />
            Library
          </button>
          <h1
            className="folio-heading truncate text-xl font-semibold"
            style={{ color: "var(--folio-text)" }}
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen size={18} className="text-[var(--folio-accent)]" />
              {file.name.replace(/_/g, " ").replace(".pdf", "")}
            </span>
          </h1>
        </div>

        {/* Page controls */}
        <div
          className="flex items-center justify-center gap-3 py-2 border-t"
          style={{ borderColor: "var(--folio-border)" }}
        >
          <button
            onClick={goToPrevPage}
            type="button"
            aria-label="Previous page"
            disabled={isDocumentLoading || pageNum <= 1}
            className="folio-secondary-button rounded-lg px-3 py-1 text-sm disabled:opacity-40 transition"
            style={{
              color: "var(--folio-text)",
            }}
          >
            <span className="inline-flex items-center gap-1">
              <ChevronLeft size={15} /> Prev
            </span>
          </button>
          <span
            className="text-sm flex items-center gap-2"
            style={{ color: "var(--folio-text)" }}
          >
            Page
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              disabled={isDocumentLoading}
              onChange={(e) => {
                const value = e.target.value;
                if (!/^\d*$/.test(value)) return;
                setPageInput(value);

                const val = Number(value);
                if (value && val >= 1 && val <= totalPages) {
                  setPageText("");
                  setIsPageRendering(true);
                  setPageNum(val);
                }
              }}
              onBlur={commitPageInput}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="w-12 text-center rounded px-1 py-0.5 text-sm"
              style={{
                backgroundColor: "var(--folio-surface-raised)",
                color: "var(--folio-text)",
                border: "1px solid var(--folio-border)",
              }}
            />
            of {totalPages}
          </span>
          <button
            onClick={goToNextPage}
            type="button"
            aria-label="Next page"
            disabled={isDocumentLoading || pageNum >= totalPages}
            className="folio-secondary-button rounded-lg px-3 py-1 text-sm disabled:opacity-40 transition"
            style={{
              color: "var(--folio-text)",
            }}
          >
            <span className="inline-flex items-center gap-1">
              Next <ChevronRight size={15} />
            </span>
          </button>
          <button
            onClick={() => setScale((s) => Math.min(s + 0.1, 3))}
            type="button"
            aria-label="Zoom in"
            className="folio-secondary-button rounded-lg px-3 py-1 text-sm transition"
            style={{
              color: "var(--folio-text)",
            }}
          >
            <ZoomIn size={16} />
          </button>
          <span className="text-sm" style={{ color: "var(--folio-muted)" }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
            type="button"
            aria-label="Zoom out"
            className="folio-secondary-button rounded-lg px-3 py-1 text-sm transition"
            style={{
              color: "var(--folio-text)",
            }}
          >
            <ZoomOut size={16} />
          </button>
        </div>
      </div>
      {/* PDF */}
      <div
        ref={containerRef}
        className="flex-1 flex justify-center items-start overflow-auto"
        style={{ backgroundColor: "var(--folio-bg)", paddingTop: "96px" }}
      >
        {readerError ? (
          <div className="mt-28 max-w-md rounded-2xl border border-[var(--folio-border)] bg-[var(--folio-surface)] p-8 text-center">
            <div className="mb-3 text-3xl">⚠️</div>
            <h2 className="text-lg font-semibold text-[var(--folio-text)]">
              This PDF could not be opened
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--folio-muted)]">
              The file may be damaged, password-protected, or use a format that
              Folio cannot read yet.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="folio-primary-button mt-6 rounded-xl px-4 py-2 text-sm font-medium transition"
            >
              Return to library
            </button>
          </div>
        ) : (
          <Document
            file={file}
            loading={
              <div className="mt-28 text-sm text-[var(--folio-muted)]">
                Opening PDF…
              </div>
            }
            onLoadSuccess={({ numPages }) => {
              setTotalPages(numPages);
              setIsDocumentLoading(false);
            }}
            onLoadError={() => {
              setReaderError("document-load-failed");
              setIsDocumentLoading(false);
            }}
          >
            <Page
              pageNumber={pageNum}
              width={containerWidth ? containerWidth * 0.85 : undefined}
              scale={scale}
              loading={
                <div className="mt-28 text-sm text-[var(--folio-muted)]">
                  Rendering page…
                </div>
              }
              onRenderSuccess={() => setIsPageRendering(false)}
              onRenderError={() => setReaderError("page-render-failed")}
              onGetTextSuccess={({ items }) => {
                const text = items
                  .flatMap((item) => ("str" in item ? [item.str] : []))
                  .join(" ");
                setPageText(text);
              }}
            />
            {isPageRendering && !isDocumentLoading && (
              <span className="sr-only">Rendering page</span>
            )}
          </Document>
        )}
      </div>
    </div>
  );
}
