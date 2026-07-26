import { useEffect, useState } from "react";
import ExplainButton from "./ExplainButton";

const normaliseText = (text: string) => text.replace(/\s+/g, " ").trim();

const getSelectionOnlyContext = (selectedText: string) => {
  const cleaned = normaliseText(selectedText);
  return `Primary text:\n${cleaned}\n\nSupporting context:\nNone`;
};

const getContextualText = (
  selectedText: string,
  pageText: string,
  occurrenceIndex: number,
) => {
  const cleanedSelection = normaliseText(selectedText);
  const cleanedPageText = normaliseText(pageText);
  const normalisedPageText = cleanedPageText.toLocaleLowerCase();
  const normalisedSelection = cleanedSelection.toLocaleLowerCase();
  const matches: number[] = [];
  let matchStart = normalisedPageText.indexOf(normalisedSelection);

  while (matchStart !== -1) {
    matches.push(matchStart);
    matchStart = normalisedPageText.indexOf(
      normalisedSelection,
      matchStart + normalisedSelection.length,
    );
  }
  const selectionStart = matches[occurrenceIndex] ?? -1;

  if (selectionStart === -1) return getSelectionOnlyContext(cleanedSelection);

  const selectionEnd = selectionStart + cleanedSelection.length;
  const sentences = Array.from(cleanedPageText.matchAll(/[^.!?]+(?:[.!?]+|$)/g))
    .map((match) => ({ text: match[0].trim(), start: match.index ?? 0 }))
    .filter((sentence) => sentence.text.length > 0);
  const firstSentenceIndex = sentences.findIndex(
    (sentence, index) =>
      selectionStart >= sentence.start &&
      selectionStart < (sentences[index + 1]?.start ?? cleanedPageText.length + 1),
  );
  const lastSentenceIndex = sentences.findIndex(
    (sentence, index) =>
      selectionEnd > sentence.start &&
      selectionEnd <= (sentences[index + 1]?.start ?? cleanedPageText.length + 1),
  );

  if (firstSentenceIndex === -1 || lastSentenceIndex === -1) {
    return getSelectionOnlyContext(cleanedSelection);
  }

  const before = sentences
    .slice(Math.max(0, firstSentenceIndex - 2), firstSentenceIndex)
    .map((sentence) => sentence.text);
  const usageSentences = sentences
    .slice(firstSentenceIndex, lastSentenceIndex + 1)
    .map((sentence) => sentence.text);
  const after = sentences
    .slice(lastSentenceIndex + 1, lastSentenceIndex + 3)
    .map((sentence) => sentence.text);
  const nearbyText = [...before, ...after].join(" ") || "None";

  return `Primary text:\n${cleanedSelection}\n\nUsage sentence:\n${usageSentences.join(" ")}\n\nNearby sentences:\n${nearbyText}`;
};

const getContextualTextFromRange = (
  selectedText: string,
  range: Range,
  fallbackPageText: string,
) => {
  const textLayer =
    (range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement
    )?.closest(".react-pdf__Page__textContent");

  if (!textLayer) {
    return getContextualText(
      selectedText,
      fallbackPageText,
      getSelectionOccurrence(range, selectedText),
    );
  }

  const beforeRange = range.cloneRange();
  beforeRange.selectNodeContents(textLayer);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  const afterRange = range.cloneRange();
  afterRange.selectNodeContents(textLayer);
  afterRange.setStart(range.endContainer, range.endOffset);

  const before = normaliseText(beforeRange.toString());
  const after = normaliseText(afterRange.toString());
  const lastBoundary = Math.max(
    before.lastIndexOf("."),
    before.lastIndexOf("!"),
    before.lastIndexOf("?"),
  );
  const afterBoundaryMatch = after.match(/[.!?]/);
  const afterBoundary = afterBoundaryMatch?.index ?? after.length;
  const usagePrefix = before.slice(lastBoundary + 1).trim();
  const usageSuffix = after.slice(0, afterBoundary + 1).trim();
  const usageSentence = normaliseText(
    `${usagePrefix} ${selectedText} ${usageSuffix}`,
  );
  const beforeSentences =
    before
      .slice(0, lastBoundary + 1)
      .match(/[^.!?]+(?:[.!?]+|$)/g)
      ?.map(normaliseText)
      .filter(Boolean)
      .slice(-2) ?? [];
  const afterSentences =
    after
      .slice(afterBoundary + 1)
      .match(/[^.!?]+(?:[.!?]+|$)/g)
      ?.map(normaliseText)
      .filter(Boolean)
      .slice(0, 2) ?? [];
  const nearbyText = [...beforeSentences, ...afterSentences].join(" ") || "None";

  return `Primary text:\n${normaliseText(selectedText)}\n\nUsage sentence:\n${usageSentence}\n\nNearby sentences:\n${nearbyText}`;
};

const getSelectionOccurrence = (range: Range, selectedText: string) => {
  const textLayer =
    (range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement
    )?.closest(".react-pdf__Page__textContent");

  if (!textLayer) return 0;

  const textBeforeSelection = range.cloneRange();
  textBeforeSelection.selectNodeContents(textLayer);
  textBeforeSelection.setEnd(range.startContainer, range.startOffset);

  const normalisedBefore = normaliseText(
    textBeforeSelection.toString(),
  ).toLocaleLowerCase();
  const normalisedSelection = normaliseText(selectedText).toLocaleLowerCase();
  if (!normalisedSelection) return 0;

  let occurrenceCount = 0;
  let matchStart = normalisedBefore.indexOf(normalisedSelection);
  while (matchStart !== -1) {
    occurrenceCount += 1;
    matchStart = normalisedBefore.indexOf(
      normalisedSelection,
      matchStart + normalisedSelection.length,
    );
  }

  return occurrenceCount;
};

type Props = {
  pageText: string;
  bookId: string;
  pageNumber: number;
};

type RangeAnchor = Pick<
  NewAnnotation,
  "startItemIndex" | "startOffset" | "endItemIndex" | "endOffset"
>;

const getTextSpans = () =>
  Array.from(document.querySelectorAll(".react-pdf__Page__textContent span"));

const getAnchor = (range: Range): RangeAnchor | null => {
  const spans = getTextSpans();
  const getBoundary = (container: Node, offset: number) => {
    const element = container instanceof Element ? container : container.parentElement;
    const span = element?.closest(".react-pdf__Page__textContent span");
    const itemIndex = span ? spans.indexOf(span) : -1;
    if (!span || itemIndex === -1) return null;
    const before = range.cloneRange();
    before.selectNodeContents(span);
    before.setEnd(container, offset);
    return { itemIndex, offset: before.toString().length };
  };
  const start = getBoundary(range.startContainer, range.startOffset);
  const end = getBoundary(range.endContainer, range.endOffset);
  return start && end
    ? { startItemIndex: start.itemIndex, startOffset: start.offset, endItemIndex: end.itemIndex, endOffset: end.offset }
    : null;
};

const getTextNodeAtOffset = (span: Element | undefined, offset: number) => {
  if (!span || !Number.isInteger(offset) || offset < 0) return null;

  const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let remaining = offset;
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) return { node, offset: remaining };
    remaining -= length;
    node = walker.nextNode();
  }
  return null;
};

const getRangeFromAnchor = (anchor: RangeAnchor) => {
  const spans = getTextSpans();
  if (
    anchor.startItemIndex < 0 ||
    anchor.endItemIndex < 0 ||
    anchor.startItemIndex >= spans.length ||
    anchor.endItemIndex >= spans.length
  ) {
    return null;
  }

  const start = getTextNodeAtOffset(spans[anchor.startItemIndex], anchor.startOffset);
  const end = getTextNodeAtOffset(spans[anchor.endItemIndex], anchor.endOffset);
  if (!start || !end) return null;

  try {
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range;
  } catch {
    return null;
  }
};

const SaveHighlighted = ({ pageText, bookId, pageNumber }: Props) => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);
  const [popup, setPopup] = useState<{
    text: string;
    x: number;
    y: number;
    selectionOnlyContext: string;
    contextualText: string;
    anchor: RangeAnchor;
    selectionRects: DOMRect[];
    initialExplanation?: string;
    annotationId?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    window.electron.getAnnotations(bookId).then((saved) => {
      if (!cancelled) {
        setAnnotations(
          saved.filter((annotation) => annotation.pageNumber === pageNumber),
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bookId, pageNumber]);

  useEffect(() => {
    const renderHighlights = () => {
      const HighlightConstructor = (window as Window & {
        Highlight?: new (...ranges: Range[]) => unknown;
      }).Highlight;
      const highlights = (CSS as typeof CSS & {
        highlights?: { set: (name: string, value: unknown) => void; delete: (name: string) => void };
      }).highlights;
      if (!HighlightConstructor || !highlights) return;
      const ranges = annotations
        .map((annotation) => getRangeFromAnchor(annotation))
        .filter((range): range is Range => Boolean(range));
      highlights.delete("folio-annotation");
      if (ranges.length) highlights.set("folio-annotation", new HighlightConstructor(...ranges));
    };
    const frame = requestAnimationFrame(renderHighlights);
    return () => cancelAnimationFrame(frame);
  }, [annotations, pageText]);

  useEffect(() => {
    const HighlightConstructor = (window as Window & {
      Highlight?: new (...ranges: Range[]) => unknown;
    }).Highlight;
    const highlights = (CSS as typeof CSS & {
      highlights?: { set: (name: string, value: unknown) => void; delete: (name: string) => void };
    }).highlights;
    if (!HighlightConstructor || !highlights) return;
    highlights.delete("folio-drop-target");
    highlights.delete("folio-drop-target-active");
    if (!popup || popup.initialExplanation) return;
    const range = getRangeFromAnchor(popup.anchor);
    if (!range) return;
    highlights.set(
      isDropTargetActive ? "folio-drop-target-active" : "folio-drop-target",
      new HighlightConstructor(range),
    );
  }, [isDropTargetActive, pageText, popup]);

  useEffect(() => {
    const isInsideExplainPopup = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(".folio-explain-popup"));

    const handlePointerDown = (event: PointerEvent) => {
      if (!isInsideExplainPopup(event.target)) {
        setPopup(null);
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (isInsideExplainPopup(event.target)) return;

      const selection = window.getSelection();
      const text = selection?.toString().replace(/\s+/g, " ").trim();
      if (text && text.length > 0) {
        if (selection) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const anchor = getAnchor(range);
          if (!anchor) return;
          setPopup({
            text,
            x: rect.x,
            y: rect.y,
            selectionOnlyContext: getSelectionOnlyContext(text),
            contextualText: getContextualTextFromRange(
              text,
              range,
              pageText,
            ),
            anchor,
            selectionRects: Array.from(range.getClientRects()),
          });
        }
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [pageText]);

  useEffect(() => {
    const handleSavedHighlightClick = (event: MouseEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (!target || (event.target instanceof Element && event.target.closest(".folio-explain-popup"))) return;
      const annotation = annotations.find((item) => {
        const range = getRangeFromAnchor(item);
        if (!range) return false;
        return Array.from(range.getClientRects()).some(
          (rect) =>
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom,
        );
      });
      if (!annotation) return;
      const range = getRangeFromAnchor(annotation);
      const rect = range?.getBoundingClientRect();
      if (!rect) return;
      setPopup({
        text: annotation.selectedText,
        x: rect.x,
        y: rect.y,
        selectionOnlyContext: getSelectionOnlyContext(annotation.selectedText),
        contextualText: getSelectionOnlyContext(annotation.selectedText),
        anchor: annotation,
        selectionRects: [],
        initialExplanation: annotation.explanation,
        annotationId: annotation.id,
      });
    };
    document.addEventListener("click", handleSavedHighlightClick);
    return () => document.removeEventListener("click", handleSavedHighlightClick);
  }, [annotations]);

  return (
    <>
      {popup && (
        <ExplainButton
          text={popup.text}
          x={popup.x}
          y={popup.y}
          selectionOnlyContext={popup.selectionOnlyContext}
          contextualText={popup.contextualText}
          initialExplanation={popup.initialExplanation}
          selectionRects={popup.selectionRects}
          getSelectionRects={() => {
            const range = getRangeFromAnchor(popup.anchor);
            return range ? Array.from(range.getClientRects()) : [];
          }}
          onSave={popup.initialExplanation ? undefined : async (explanation, contextEnabled) => {
            const record = await window.electron.saveAnnotation(bookId, {
              pageNumber,
              selectedText: popup.text,
              explanation,
              contextEnabled,
              ...popup.anchor,
            });
            setAnnotations((current) => [...current, record]);
          }}
          onDelete={
            popup.annotationId
              ? async () => {
                  await window.electron.deleteAnnotation(bookId, popup.annotationId!);
                  setAnnotations((current) =>
                    current.filter(
                      (annotation) => annotation.id !== popup.annotationId,
                    ),
                  );
                  setPopup(null);
                }
              : undefined
          }
          onDragTargetChange={setIsDropTargetActive}
          onClose={() => {
            setIsDropTargetActive(false);
            setPopup(null);
          }}
        />
      )}
      <style>{`
        ::highlight(folio-annotation) {
          background-color: rgba(213, 174, 78, 0.42);
          color: inherit;
          cursor: pointer;
        }
        ::highlight(folio-drop-target) {
          background-color: rgba(213, 174, 78, 0.25);
          text-shadow: 0 0 8px rgba(164, 126, 70, 0.72);
        }
        ::highlight(folio-drop-target-active) {
          background-color: rgba(177, 117, 63, 0.48);
          text-shadow: 0 0 14px rgba(138, 90, 68, 0.82);
        }
      `}</style>
    </>
  );
};

export default SaveHighlighted;
