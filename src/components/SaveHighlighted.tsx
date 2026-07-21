import { useEffect, useState } from "react";
import ExplainButton from "./ExplainButton";

type Props = {
  pageLines: string[];
};

const normaliseText = (text: string) => text.replace(/\s+/g, " ").trim();

const getSurroundingText = (selectedText: string, pageLines: string[]) => {
  const cleaned = selectedText.replace(/\s+/g, " ").trim();
  const firstWord = cleaned.split(" ")[0];
  const selectedLineIndex = pageLines.findIndex((line) => {
    const normalisedLine = normaliseText(line);
    return normalisedLine.includes(cleaned) || normalisedLine.includes(firstWord);
  });

  if (selectedLineIndex === -1) return cleaned;

  const linesBefore = 4;
  const linesAfter = 4;
  const start = Math.max(0, selectedLineIndex - linesBefore);
  const end = Math.min(pageLines.length, selectedLineIndex + linesAfter + 1);
  const primaryLine = pageLines[selectedLineIndex];
  const nearbyLines = pageLines
    .slice(start, end)
    .filter((_, index) => start + index !== selectedLineIndex);

  return `Primary line:\n${primaryLine}\n\nNearby context:\n${nearbyLines.join("\n")}`;
};

const SaveHighlighted = ({ pageLines }: Props) => {
  const [popup, setPopup] = useState<{
    text: string;
    x: number;
    y: number;
    surrounding: string;
  } | null>(null);

  useEffect(() => {
    const isInsideExplainPopup = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(".folio-explain-popup"));

    const handleMouseUp = (event: MouseEvent) => {
      if (isInsideExplainPopup(event.target)) return;

      const selection = window.getSelection();
      const text = selection?.toString().replace(/\s+/g, " ").trim();
      if (text && text.length > 0) {
        if (selection) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const surrounding = getSurroundingText(text, pageLines);
          setPopup({ text, x: rect.x, y: rect.y, surrounding });
        }
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (isInsideExplainPopup(event.target)) return;

      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || text.length === 0) {
        setPopup(null);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("click", handleClick);
    };
  }, [pageLines]);

  return (
    <>
      {popup && (
        <ExplainButton
          text={popup.text}
          x={popup.x}
          y={popup.y}
          surrounding={popup.surrounding}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  );
};

export default SaveHighlighted;
