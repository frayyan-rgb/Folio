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
  };
}
