import { useEffect, useRef, useState } from "react";

type Props = {
  text: string;
  x: number;
  y: number;
  surrounding: string;
  onClose: () => void;
};

const ExplainButton = ({ text, x, y, surrounding, onClose }: Props) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [followUps, setFollowUps] = useState<
    Array<{ question: string; answer: string }>
  >([]);
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const popupRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const popupWidth = explanation ? 320 : 150;
  const popupHeight = explanation ? 270 : 50;

  const clampedLeft = explanation
    ? window.innerWidth - popupWidth - 16 // top right when explanation shows
    : Math.min(x, window.innerWidth - popupWidth - 16); // near selection otherwise

  const clampedTop = explanation
    ? 85 // below the header
    : Math.min(y - 50, window.innerHeight - popupHeight - 50);

  const handleExplain = async () => {
    setLoading(true);

    try {
      const result = await window.electron.explainText(text, surrounding);
      setExplanation(result);
    } catch (error) {
      console.error("Local AI error:", error);
      setExplanation(
        "Local AI is unavailable. Make sure the local AI server is running.",
      );
    } finally {
      setLoading(false);
    }
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
        surrounding,
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
            "Local AI is unavailable. Make sure the local AI server is running.",
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
      x: Math.max(0, Math.min(event.clientX - dragOffset.current.x, window.innerWidth - rect.width)),
      y: Math.max(0, Math.min(event.clientY - dragOffset.current.y, window.innerHeight - rect.height)),
    });
  };

  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={popupRef}
      style={{
        position: "fixed",
        top: position?.y ?? clampedTop,
        left: position?.x ?? clampedLeft,
        zIndex: 9999,
        backgroundColor: "#1e1e1e",
        border: "1px solid #555",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        width: explanation ? "320px" : "auto",
        maxHeight: "calc(100vh - 100px)",
        minWidth: explanation ? "280px" : undefined,
        minHeight: explanation ? "180px" : undefined,
        resize: explanation ? "both" : "none",
      }}
      className="folio-explain-popup flex flex-col rounded-2xl overflow-hidden"
    >
      {!explanation ? (
        <button
          onClick={handleExplain}
          disabled={loading}
          className="disabled:opacity-50 text-sm font-medium px-6 py-2.5 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2"
          style={{
            backgroundColor: "#1e1e1e",
            color: "#f0f0f0",
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
      ) : (
        <div
          className="flex min-h-0 flex-1 flex-col"
          style={{
            animation: "fadeIn 0.3s ease",
          }}
        >
          <div
            className="m-4 mb-3 flex cursor-move items-center justify-between select-none text-xs text-[#888]"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            <span>Folio AI</span>
            <div className="flex items-center gap-3">
              <span>Drag to move</span>
              <button
                type="button"
                aria-label="Close explanation"
                className="cursor-pointer text-base leading-none text-[#aaa] hover:text-white"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={onClose}
              >
                ×
              </button>
            </div>
          </div>
          <div ref={conversationRef} className="min-h-0 flex-1 overflow-y-auto px-4">
            <p className="text-xs font-semibold mb-2" style={{ color: "#888" }}>
              "{text}"
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#f0f0f0" }}>
              {explanation}
            </p>
            {followUps.map((turn, index) => (
              <div key={`${turn.question}-${index}`} className="mt-4 border-t border-[#444] pt-3">
                <p className="text-xs font-medium text-[#aaa]">You</p>
                <p className="mt-1 text-sm text-[#f0f0f0]">{turn.question}</p>
                <p className="mt-2 text-xs font-medium text-[#888]">Folio</p>
                <p className="mt-1 text-sm leading-relaxed text-[#f0f0f0]">{turn.answer}</p>
              </div>
            ))}
            {isAskingFollowUp && pendingQuestion && (
              <div className="mt-4 border-t border-[#444] pt-3">
                <p className="text-xs font-medium text-[#aaa]">You</p>
                <p className="mt-1 text-sm text-[#f0f0f0]">{pendingQuestion}</p>
                <p className="mt-2 text-sm text-[#aaa]">Folio is thinking…</p>
              </div>
            )}
          </div>
          <form
            className="m-4 mt-3 flex gap-2 border-t border-[#444] pt-3"
            onSubmit={handleFollowUp}
          >
            <input
              value={followUp}
              onChange={(event) => setFollowUp(event.target.value)}
              placeholder="Ask a follow-up…"
              className="min-w-0 flex-1 rounded-lg border border-[#555] bg-[#2a2a2a] px-3 py-2 text-sm text-[#f0f0f0] outline-none placeholder:text-[#888]"
            />
            <button
              type="submit"
              disabled={!followUp.trim() || isAskingFollowUp}
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-[#111] disabled:opacity-40"
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
