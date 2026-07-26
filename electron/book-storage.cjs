const fs = require("node:fs");
const path = require("node:path");

function validateBookFileName(fileName) {
  if (
    typeof fileName !== "string" ||
    !fileName.toLowerCase().endsWith(".pdf") ||
    path.basename(fileName) !== fileName
  ) {
    throw new Error("A valid PDF filename is required.");
  }
}

function getProgressPath(userDataDirectory) {
  return path.join(userDataDirectory, "progress.json");
}

function getAnnotationsPath(userDataDirectory, bookId) {
  return path.join(
    userDataDirectory,
    "annotations",
    `${encodeURIComponent(bookId)}.json`,
  );
}

function readProgress(userDataDirectory) {
  try {
    const progress = JSON.parse(
      fs.readFileSync(getProgressPath(userDataDirectory), "utf8"),
    );
    return progress && typeof progress === "object" ? progress : {};
  } catch {
    return {};
  }
}

function writeProgress(userDataDirectory, progress) {
  fs.mkdirSync(userDataDirectory, { recursive: true });
  fs.writeFileSync(
    getProgressPath(userDataDirectory),
    JSON.stringify(progress, null, 2),
  );
}

function saveReadingProgress(userDataDirectory, fileName, pageNumber) {
  const progress = readProgress(userDataDirectory);
  progress[fileName] = pageNumber;
  writeProgress(userDataDirectory, progress);
}

function getReadingProgress(userDataDirectory, fileName) {
  return readProgress(userDataDirectory)[fileName] || 1;
}

function saveBookFile(userDataDirectory, buffer, fileName) {
  validateBookFileName(fileName);
  const booksDirectory = path.join(userDataDirectory, "books");
  fs.mkdirSync(booksDirectory, { recursive: true });
  const filePath = path.join(booksDirectory, fileName);
  if (fs.existsSync(filePath)) {
    throw new Error("A PDF with this filename is already in your library.");
  }
  fs.writeFileSync(filePath, Buffer.from(buffer), { flag: "wx" });
  return filePath;
}

function deleteBookData(userDataDirectory, fileName) {
  validateBookFileName(fileName);
  fs.unlinkSync(path.join(userDataDirectory, "books", fileName));

  const relatedFiles = [
    getAnnotationsPath(userDataDirectory, fileName),
    path.join(userDataDirectory, "images", fileName),
  ];
  for (const relatedFile of relatedFiles) {
    if (fs.existsSync(relatedFile)) fs.unlinkSync(relatedFile);
  }

  const progress = readProgress(userDataDirectory);
  if (Object.prototype.hasOwnProperty.call(progress, fileName)) {
    delete progress[fileName];
    writeProgress(userDataDirectory, progress);
  }
}

module.exports = {
  deleteBookData,
  getAnnotationsPath,
  getReadingProgress,
  readProgress,
  saveBookFile,
  saveReadingProgress,
  validateBookFileName,
};
