import { useEffect, useState, useRef } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import SaveHighlighted from "./SaveHighlighted";

type Props = {
  file: File;
  onBack: () => void;
};

export default function ReaderView({ file, onBack }: Props) {
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }
  }, []);

  useEffect(() => {
    window.electron.getPage(file.name).then((page) => {
      setPageNum(page);
      setPageLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (pageLoaded && pageNum > 0) {
      window.electron.savePage(file.name, pageNum);
    }
  }, [pageNum, pageLoaded]);

  const goToPrevPage = () => setPageNum((p) => Math.max(p - 1, 1));
  const goToNextPage = () => setPageNum((p) => Math.min(p + 1, totalPages));
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrevPage();
      if (e.key === "ArrowRight") goToNextPage();
    };

    window.addEventListener("keydown", handleKeyDown); // this basically means that everytime a user presses a key the function handleKeyDown runs
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pageNum, totalPages]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#1a1a1a" }}
    >
      <SaveHighlighted />

      {/* Header */}
      <div
        className="fixed top-0 left-0 right-0 z-30 flex flex-col"
        style={{ backgroundColor: "#2a2a2a", borderBottom: "1px solid #333" }}
      >
        {/* Title row */}
        <div className="px-6 py-2 flex items-center gap-4 min-w-0">
          <button
            onClick={onBack}
            className="text-sm text-blue-400 hover:underline flex-shrink-0"
          >
            ← Library
          </button>
          <h1
            className="text-lg font-semibold truncate"
            style={{ color: "#f0f0f0" }}
          >
            📖 {file.name.replace(/_/g, " ").replace(".pdf", "")}
          </h1>
        </div>

        {/* Page controls */}
        <div
          className="flex items-center justify-center gap-3 py-2 border-t"
          style={{ borderColor: "#333" }}
        >
          <button
            onClick={goToPrevPage}
            disabled={pageNum <= 1}
            className="px-3 py-1 text-sm rounded-md disabled:opacity-40 transition"
            style={{ backgroundColor: "#3a3a3a", color: "#f0f0f0" }}
          >
            ← Prev
          </button>
          <span
            className="text-sm flex items-center gap-2"
            style={{ color: "#f0f0f0" }}
          >
            Page
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageNum}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 1 && val <= totalPages) setPageNum(val);
              }}
              className="w-12 text-center rounded px-1 py-0.5 text-sm"
              style={{
                backgroundColor: "#3a3a3a",
                color: "#f0f0f0",
                border: "1px solid #555",
              }}
            />
            of {totalPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNum >= totalPages}
            className="px-3 py-1 text-sm rounded-md disabled:opacity-40 transition"
            style={{ backgroundColor: "#3a3a3a", color: "#f0f0f0" }}
          >
            Next →
          </button>
          <button
            onClick={() => setScale((s) => Math.min(s + 0.1, 3))}
            className="px-3 py-1 text-sm rounded-md transition"
            style={{ backgroundColor: "#3a3a3a", color: "#f0f0f0" }}
          >
            +
          </button>
          <span className="text-sm" style={{ color: "#888" }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
            className="px-3 py-1 text-sm rounded-md transition"
            style={{ backgroundColor: "#3a3a3a", color: "#f0f0f0" }}
          >
            -
          </button>
        </div>
      </div>
      {/* PDF */}
      <div
        ref={containerRef}
        className="flex-1 flex justify-center items-start overflow-auto"
        style={{ backgroundColor: "#1a1a1a", paddingTop: "96px" }}
      >
        <Document
          file={file}
          onLoadSuccess={({ numPages }) => setTotalPages(numPages)}
        >
          <Page
            pageNumber={pageNum}
            width={containerWidth ? containerWidth * 0.85 : undefined}
            scale={scale}
          />
        </Document>
      </div>
    </div>
  );
}
