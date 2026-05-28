import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";

type Book = { name: string; path: string; image?: string };

type Props = {
  onSelectBook: (file: File) => void;
};

export default function HomeScreen({ onSelectBook }: Props) {
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    const loadBooks = async () => {
      const savedBooks = await window.electron.getBooks();

      // load image for each book
      const booksWithImages = await Promise.all(
        savedBooks.map(async (book) => {
          const imageBuffer = await window.electron.getImage(book.name);
          if (!imageBuffer) return book;
          const blob = new Blob([new Uint8Array(imageBuffer)], {
            type: "image/jpeg",
          });
          const imageUrl = URL.createObjectURL(blob);
          return { ...book, image: imageUrl };
        }),
      );

      setBooks(booksWithImages);
    };
    loadBooks();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Array.from(new Uint8Array(arrayBuffer));
    const result = await window.electron.saveBook(buffer, file.name);
    console.log("save result:", result); // add here
    setBooks((prev) => [...prev, { name: file.name, path: result.path }]); // use real path
  };
  const handleImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    bookIndex: number,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Array.from(new Uint8Array(arrayBuffer));
    await window.electron.saveImage(buffer, books[bookIndex].name); // changed this line
    const imageUrl = URL.createObjectURL(file);
    setBooks((prev) =>
      prev.map((book, i) =>
        i === bookIndex ? { ...book, image: imageUrl } : book,
      ),
    );
  };

  const handleOpenBook = async (bookPath: string, bookName: string) => {
    const buffer = await window.electron.readBook(bookPath);
    const file = new File([new Uint8Array(buffer)], bookName, {
      type: "application/pdf",
    });
    onSelectBook(file);
  };
  const deleteCard = async (fileName: string) => {
    await window.electron.deleteBook(fileName);
    setBooks(books.filter((book) => book.name !== fileName));
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[#f0f0f0]">My Library</h1>
        <label className="cursor-pointer bg-white hover:bg-gray-100 text-gray-900 text-sm font-medium px-4 py-2 rounded-lg transition">
          + Add Book
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {books.map((book, i) => (
          <Card
            key={i}
            className="cursor-pointer transition group relative"
            style={{ backgroundColor: "#2a2a2a", border: "1px solid #333" }}
            onClick={() => handleOpenBook(book.path, book.name)}
          >
            {/* Delete button - subtle, hover only */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteCard(book.name);
              }}
              className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-red-500/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs"
            >
              ✕
            </button>

            <CardHeader className="p-3 overflow-hidden">
              {/* Cover image area */}
              <div
                className="rounded-md h-48 mb-3 overflow-hidden"
                style={{ backgroundColor: "#3a3a3a" }}
              >
                {book.image ? (
                  <img
                    src={book.image}
                    className="w-full h-full object-cover rounded-md"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-3xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById(`cover-input-${i}`)?.click();
                    }}
                  >
                    📄
                    <input
                      id={`cover-input-${i}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleImageChange(e, i)}
                    />
                  </div>
                )}
              </div>

              {/* Title - underscores replaced with spaces */}
              <div className="w-full overflow-hidden">
                <p
                  className="break-words text-sm font-medium"
                  style={{ color: "#f0f0f0" }}
                >
                  {book.name.replace(/_/g, " ").replace(".pdf", "")}
                </p>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
