import { useEffect, useState } from "react";
import ExplainButton from "./ExplainButton";

const getSurroundingText = (selectedText: string) => {
  const cleaned = selectedText.replace(/\s+/g, " ").trim();
  const spans = document.querySelectorAll(".textLayer span");
  const uniqueTexts = [
    ...new Set(Array.from(spans).map((s) => s.textContent || "")),
  ];
  const pageText = uniqueTexts.join(" ").replace(/\s+/g, " ").trim();

  let start = 0;
  let end = pageText.length;

  const index = pageText.indexOf(cleaned);
  if (index !== -1) {
    start = Math.max(0, index - 300);
    end = Math.min(pageText.length, index + cleaned.length + 300);
  } else {
    const firstWord = cleaned.split(" ")[0];
    const fallbackIndex = pageText.indexOf(firstWord);
    if (fallbackIndex !== -1) {
      start = Math.max(0, fallbackIndex - 300);
      end = Math.min(pageText.length, fallbackIndex + 600);
    } else {
      return cleaned;
    }
  }

  let chunk = pageText.slice(start, end);

  // trim to nearest sentence start — find ". " and start after it
  const sentenceStartMatch = chunk.search(/[.!?]\s*[A-Z]/);
  if (sentenceStartMatch !== -1 && sentenceStartMatch < 300) {
    const capitalPos = chunk.slice(sentenceStartMatch).search(/[A-Z]/);
    chunk = chunk.slice(sentenceStartMatch + capitalPos);
  }

  return chunk;
};

const SaveHighlighted = () => {
  const [popup, setPopup] = useState<{
    text: string;
    x: number;
    y: number;
    surrounding: string;
  } | null>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().replace(/\s+/g, " ").trim();
      if (text && text.length > 0) {
        if (selection) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const surrounding = getSurroundingText(text);
          setPopup({ text, x: rect.x, y: rect.y, surrounding });
        }
      }
    };

    const handleClick = () => {
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
  }, []);

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
