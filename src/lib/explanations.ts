export const getLocalAIUnavailableMessage = (
  action: "explanation" | "follow-up",
) =>
  action === "explanation"
    ? "Local AI isn’t ready. Return to the library, open Settings, and download or load a model before trying again."
    : "Local AI isn’t ready. Return to the library, open Settings, and load a model before trying again.";
