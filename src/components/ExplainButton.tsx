import { useEffect, useRef, useState } from "react";
import { getLocalAIUnavailableMessage } from "@/lib/explanations";

type Props = {
  text: string;
  x: number;
  y: number;
  selectionOnlyContext: string;
  contextualText: string;
  initialExplanation?: string;
  selectionRects: DOMRect[];
  getSelectionRects?: () => DOMRect[];
  onSave?: (explanation: string, contextEnabled: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
  onDragTargetChange?: (isOverTarget: boolean) => void;
  onClose: () => void;
};

const CONTEXT_MODE_STORAGE_KEY = "folio-use-surrounding-context";
const DROP_TARGET_PADDING = 16;
const VIEWPORT_PADDING = 16;
const HEADER_OFFSET = 85;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));

const isPointNearRect = (x: number, y: number, rect: DOMRect) =>
  x >= rect.left - DROP_TARGET_PADDING &&
  x <= rect.right + DROP_TARGET_PADDING &&
  y >= rect.top - DROP_TARGET_PADDING &&
  y <= rect.bottom + DROP_TARGET_PADDING;

const ExplainButton = ({
  text,
  x,
  y,
  selectionOnlyContext,
  contextualText,
  initialExplanation,
  selectionRects,
  getSelectionRects,
  onSave,
  onDelete,
  onDragTargetChange,
  onClose,
}: Props) => {
  const [explanation, setExplanation] = useState<string | null>(initialExplanation ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(Boolean(initialExplanation));
  const [isAbsorbing, setIsAbsorbing] = useState(false);
  const [isOverSelection, setIsOverSelection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [useContext, setUseContext] = useState(
    () => window.localStorage.getItem(CONTEXT_MODE_STORAGE_KEY) === "true",
  );
  const [followUp, setFollowUp] = useState("");
  const [followUps, setFollowUps] = useState<
    Array<{ question: string; answer: string }>
  >([]);
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const popupRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const hasExpandedContent = Boolean(explanation || errorMessage);
  const popupWidth = hasExpandedContent ? 320 : 210;
  const popupHeight = explanation ? 270 : errorMessage ? 190 : 78;

  const clampedLeft = explanation
    ? clamp(
        viewport.width - popupWidth - VIEWPORT_PADDING,
        VIEWPORT_PADDING,
        viewport.width - popupWidth - VIEWPORT_PADDING,
      )
    : clamp(
        x,
        VIEWPORT_PADDING,
        viewport.width - popupWidth - VIEWPORT_PADDING,
      );

  const clampedTop = explanation
    ? HEADER_OFFSET
    : clamp(
        y - popupHeight - 8,
        HEADER_OFFSET,
        viewport.height - popupHeight - VIEWPORT_PADDING,
      );

  const handleExplain = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await window.electron.explainText(
        text,
        useContext ? contextualText : selectionOnlyContext,
        useContext,
      );
      setExplanation(result);
    } catch (error) {
      console.error("Local AI error:", error);
      setErrorMessage(
        getLocalAIUnavailableMessage("explanation"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContextModeChange = (enabled: boolean) => {
    setUseContext(enabled);
    window.localStorage.setItem(CONTEXT_MODE_STORAGE_KEY, String(enabled));
  };

  const handleFollowUp = async (event: React.FormEvent) => {
    event.preventDefault();
    const question = followUp.trim();
    if (!question || !explanation || isAskingFollowUp) return;

    setIsAskingFollowUp(true);
    setPendingQuestion(question);
    setFollowUp("");

    try {
      const answer = await window.electron.askFollowUp(
        text,
        useContext ? contextualText : selectionOnlyContext,
        explanation,
        followUps,
        question,
      );
      setFollowUps((currentFollowUps) => [
        ...currentFollowUps,
        { question, answer },
      ]);
    } catch (error) {
      console.error("Local AI follow-up error:", error);
      setFollowUps((currentFollowUps) => [
        ...currentFollowUps,
        {
          question,
          answer:
            getLocalAIUnavailableMessage("follow-up"),
        },
      ]);
    } finally {
      setIsAskingFollowUp(false);
      setPendingQuestion(null);
    }
  };

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) {
      conversation.scrollTop = conversation.scrollHeight;
    }
  }, [followUps, isAskingFollowUp]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const rect = popupRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition((current) => {
        if (!current) return null;
        const next = {
          x: clamp(
            current.x,
            VIEWPORT_PADDING,
            window.innerWidth - rect.width - VIEWPORT_PADDING,
          ),
          y: clamp(
            current.y,
            HEADER_OFFSET,
            window.innerHeight - rect.height - VIEWPORT_PADDING,
          ),
        };
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = popupRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = popupRef.current?.getBoundingClientRect();
    if (!rect) return;

    setPosition({
      x: clamp(
        event.clientX - dragOffset.current.x,
        VIEWPORT_PADDING,
        window.innerWidth - rect.width - VIEWPORT_PADDING,
      ),
      y: clamp(
        event.clientY - dragOffset.current.y,
        HEADER_OFFSET,
        window.innerHeight - rect.height - VIEWPORT_PADDING,
      ),
    });
    const currentSelectionRects = getSelectionRects?.() ?? selectionRects;
    const isOverTarget = currentSelectionRects.some(
      (target) => isPointNearRect(event.clientX, event.clientY, target),
    );
    setIsOverSelection(isOverTarget);
    onDragTargetChange?.(isOverTarget);
  };

  const handleDragEnd = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const currentSelectionRects = getSelectionRects?.() ?? selectionRects;
    const droppedOnSelection = currentSelectionRects.some(
      (rect) => isPointNearRect(event.clientX, event.clientY, rect),
    );
    if (explanation && onSave && !saved && droppedOnSelection) {
      const target = currentSelectionRects.reduce<DOMRect | null>(
        (closest, candidate) => {
          if (!closest) return candidate;
          const candidateDistance = Math.hypot(
            event.clientX - (candidate.left + candidate.width / 2),
            event.clientY - (candidate.top + candidate.height / 2),
          );
          const closestDistance = Math.hypot(
            event.clientX - (closest.left + closest.width / 2),
            event.clientY - (closest.top + closest.height / 2),
          );
          return candidateDistance < closestDistance ? candidate : closest;
        },
        null,
      );
      const popupRect = popupRef.current?.getBoundingClientRect();
      if (target && popupRect) {
        setPosition({
          x: target.left + target.width / 2 - popupRect.width / 2,
          y: target.top + target.height / 2 - popupRect.height / 2,
        });
      }
      setIsAbsorbing(true);
      await new Promise((resolve) => setTimeout(resolve, 360));
      try {
        const explanationWithFollowUps = [
          explanation,
          ...followUps.map(
            (turn) => `Follow-up: ${turn.question}\n${turn.answer}`,
          ),
        ].join("\n\n");
        await onSave(explanationWithFollowUps, useContext);
        setSaved(true);
        onClose();
      } catch (error) {
        console.error("Could not save annotation:", error);
        setIsAbsorbing(false);
      }
    }
    setIsOverSelection(false);
    onDragTargetChange?.(false);
  };

  return (
    <div
      ref={popupRef}
      style={{
        position: "fixed",
        top: position?.y ?? clampedTop,
        left: position?.x ?? clampedLeft,
        zIndex: 9999,
        backgroundColor: isOverSelection
          ? "rgba(248, 240, 227, 0.38)"
          : "rgba(249, 244, 235, 0.9)",
        border: isOverSelection
          ? "1px solid rgba(164, 126, 70, 0.9)"
          : "1px solid var(--folio-border)",
        boxShadow: isOverSelection
          ? "0 12px 42px rgba(108, 52, 56, 0.22), inset 0 1px 0 rgba(255,255,255,0.8)"
          : "0 18px 52px rgba(62, 43, 28, 0.22), inset 0 1px 0 rgba(255,255,255,0.82)",
        backdropFilter: "blur(24px) saturate(130%)",
        WebkitBackdropFilter: "blur(24px) saturate(130%)",
        opacity: isAbsorbing ? 0 : isOverSelection ? 0.58 : 1,
        width: hasExpandedContent ? "320px" : "auto",
        maxWidth: "calc(100vw - 32px)",
        maxHeight: "calc(100vh - 100px)",
        minWidth: explanation ? "280px" : undefined,
        minHeight: explanation ? "180px" : undefined,
        resize: explanation ? "both" : "none",
        transform: isAbsorbing ? "scale(0.08)" : "scale(1)",
        transformOrigin: "center center",
        transition: isAbsorbing
          ? "left 180ms ease-in, top 180ms ease-in, transform 260ms ease-in, opacity 260ms ease-in"
          : "background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease",
      }}
      className="folio-explain-popup flex flex-col rounded-2xl overflow-hidden"
    >
      {!explanation ? (
        <div className="flex flex-col p-2">
          <label className="mb-1 flex cursor-pointer items-center gap-2 px-2 text-xs text-[var(--folio-muted)]">
            <input
              type="checkbox"
              checked={useContext}
              onChange={(event) => handleContextModeChange(event.target.checked)}
            />
            Use surrounding context
          </label>
          <button
            onClick={handleExplain}
            disabled={loading}
            className="disabled:opacity-50 text-sm font-medium px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2"
            style={{
              background: "linear-gradient(145deg, #743c40, #5d2f33)",
              color: "#fffaf1",
              cursor: "pointer",
              border: "none",
            }}
          >
          {loading ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Explaining...
            </>
          ) : (
            <>✨ Explain this</>
          )}
          </button>
          {errorMessage && (
            <div
              role="alert"
              className="mx-2 mb-2 mt-1 rounded-lg border border-[color:rgba(154,68,63,0.45)] bg-[color:rgba(154,68,63,0.12)] p-3 text-xs leading-5 text-[var(--folio-accent-strong)]"
            >
              {errorMessage}
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex min-h-0 flex-1 flex-col"
          style={{
            animation: "fadeIn 0.3s ease",
          }}
        >
          <div
            className="m-4 mb-3 flex cursor-move items-center justify-between select-none text-xs text-[var(--folio-muted)]"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={(event) => void handleDragEnd(event)}
            onPointerCancel={(event) => void handleDragEnd(event)}
          >
            <span>Folio AI</span>
            <div className="flex items-center gap-3">
              {onDelete && (
                <button
                  type="button"
                  className="cursor-pointer text-[var(--folio-danger)] hover:brightness-110"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => void onDelete()}
                >
                  Delete
                </button>
              )}
              <span>{saved ? "Saved" : "Drag onto text to save"}</span>
              <button
                type="button"
                aria-label="Close explanation"
                className="cursor-pointer text-base leading-none text-[var(--folio-muted)] hover:text-[var(--folio-accent-strong)]"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={onClose}
              >
                ×
              </button>
            </div>
          </div>
          <div ref={conversationRef} className="min-h-0 flex-1 overflow-y-auto px-4">
            <p className="mb-2 text-xs font-semibold text-[var(--folio-muted)]">
              "{text}"
            </p>
            <p className="text-sm leading-relaxed text-[var(--folio-text)]">
              {explanation}
            </p>
            {followUps.map((turn, index) => (
              <div key={`${turn.question}-${index}`} className="mt-4 border-t border-[var(--folio-border)] pt-3">
                <p className="text-xs font-medium text-[var(--folio-muted)]">You</p>
                <p className="mt-1 text-sm text-[var(--folio-text)]">{turn.question}</p>
                <p className="mt-2 text-xs font-medium text-[var(--folio-accent)]">Folio</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--folio-text)]">{turn.answer}</p>
              </div>
            ))}
            {isAskingFollowUp && pendingQuestion && (
              <div className="mt-4 border-t border-[var(--folio-border)] pt-3">
                <p className="text-xs font-medium text-[var(--folio-muted)]">You</p>
                <p className="mt-1 text-sm text-[var(--folio-text)]">{pendingQuestion}</p>
                <p className="mt-2 text-sm text-[var(--folio-muted)]">Folio is thinking…</p>
              </div>
            )}
          </div>
          <form
            className="m-4 mt-3 flex gap-2 border-t border-[var(--folio-border)] pt-3"
            onSubmit={handleFollowUp}
          >
            <input
              value={followUp}
              onChange={(event) => setFollowUp(event.target.value)}
              placeholder="Ask a follow-up…"
              className="min-w-0 flex-1 rounded-xl border border-[var(--folio-border)] bg-white/45 px-3 py-2 text-sm text-[var(--folio-text)] outline-none placeholder:text-[var(--folio-muted)]"
            />
            <button
              type="submit"
              disabled={!followUp.trim() || isAskingFollowUp}
              className="folio-primary-button rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-40"
            >
              {isAskingFollowUp ? "Asking..." : "Send"}
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ExplainButton;
