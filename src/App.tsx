import { useState } from "react";
import { pdfjs } from "react-pdf";
import HomeScreen from "./components/HomeScreen";
import ReaderView from "./components/ReaderView";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return selectedFile ? (
    <ReaderView file={selectedFile} onBack={() => setSelectedFile(null)} />
  ) : (
    <HomeScreen onSelectBook={setSelectedFile} />
  );
}

export default App;
