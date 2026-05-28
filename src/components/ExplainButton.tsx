import { useState } from "react";

type Props = {
  text: string;
  x: number;
  y: number;
  surrounding: string;
  onClose: () => void;
};

const ExplainButton = ({ text, x, y, surrounding }: Props) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const popupWidth = explanation ? 320 : 150;
  const popupHeight = explanation ? 200 : 50;

  const clampedLeft = explanation
    ? window.innerWidth - popupWidth - 16 // top right when explanation shows
    : Math.min(x, window.innerWidth - popupWidth - 16); // near selection otherwise

  const clampedTop = explanation
    ? 85 // below the header
    : Math.min(y - 50, window.innerHeight - popupHeight - 50);

  const handleExplain = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "nvidia/nemotron-3-super-120b-a12b:free",
            messages: [
              {
                role: "user",
                content: `Explain the term "${text}" in 2-3 simple sentences, make sure to use really easy language and explain like the person doesn't know anything in that context, make sure to explain what's given to you in context. Do not use markdown or bullet points. Here is the context: "${surrounding}"`,
              },
            ],
          }),
        },
      );
      const data = await response.json();
      setExplanation(data.choices[0].message.content);
    } catch {
      setExplanation("Error getting explanation. Try again.");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: clampedTop,
        left: clampedLeft,
        zIndex: 9999,
        backgroundColor: "#1e1e1e",
        border: "1px solid #555",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        transition: "all 0.3s ease",
        width: explanation ? "320px" : "auto",
      }}
      className="rounded-2xl overflow-scroll"
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
          className="p-4"
          style={{
            animation: "fadeIn 0.3s ease",
          }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: "#888" }}>
            "{text}"
          </p>
          <p className="text-sm  leading-relaxed" style={{ color: "#f0f0f0" }}>
            {explanation}
          </p>
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
