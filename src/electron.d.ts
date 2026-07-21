interface Window {
  electron: {
    saveBook: (
      buffer: number[],
      fileName: string,
    ) => Promise<{ success: boolean; path: string }>;
    getBooks: () => Promise<{ name: string; path: string }[]>;
    readBook: (filePath: string) => Promise<number[]>;
    savePage: (
      fileName: string,
      pageNum: number,
    ) => Promise<{ success: boolean }>;
    getPage: (fileName: string) => Promise<number>;
    saveImage: (buffer: number[], fileName: string) => Promise<string>;
    getImage: (fileName: string) => Promise<number[] | null>;
    deleteBook: (fileName: string) => Promise<{ success: boolean }>;
    saveApiKey: (apiKey: string) => Promise<{ success: boolean }>;
    getApiKey: () => Promise<string | null>;
    deleteImage: (fileName: string) => Promise<{ success: boolean }>;
    explainText: (text: string, surrounding: string) => Promise<string>;
    askFollowUp: (
      text: string,
      surrounding: string,
      explanation: string,
      history: Array<{ question: string; answer: string }>,
      question: string,
    ) => Promise<string>;
    getLocalAIStatus: () =>
      Promise<{
        status: "loaded" | "downloaded" | "none";
        startupProgress: {
          phase: "downloading" | "loading";
          percent: number | null;
          completedBytes: number | null;
          totalBytes: number | null;
        } | null;
      }>;
    getLocalAIModels: () => Promise<{
      selectedModelId: string;
      loadedModelId: string | null;
      startupProgress: unknown;
      models: Array<{
        id: string;
        name: string;
        size: string;
        advantage: string;
        drawback: string;
        downloaded: boolean;
        loaded: boolean;
      }>;
    }>;
    setSelectedLocalAIModel: (modelId: string) =>
      Promise<{ selectedModelId: string }>;
    loadLocalAI: (modelId?: string) => Promise<{ status: "loaded" }>;
    unloadLocalAI: () => Promise<{ status: "downloaded" | "none" }>;
    deleteLocalAIModel: (modelId?: string) => Promise<{ status: "none" }>;
    onLocalAIDownloadProgress: (
      callback: (progress: {
        phase: "downloading" | "loading";
        percent: number | null;
        completedBytes: number | null;
        totalBytes: number | null;
      }) => void,
    ) => () => void;
  };
}
