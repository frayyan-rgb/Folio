const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, beforeEach, test } = require("node:test");
const {
  deleteBookData,
  getAnnotationsPath,
  getReadingProgress,
  saveBookFile,
  saveReadingProgress,
} = require("../electron/book-storage.cjs");

let testDirectory;

beforeEach(() => {
  testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "folio-storage-test-"));
});

afterEach(() => {
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test("saving a duplicate PDF never overwrites the existing file", () => {
  const firstPath = saveBookFile(testDirectory, Buffer.from("first"), "paper.pdf");

  assert.throws(
    () => saveBookFile(testDirectory, Buffer.from("second"), "paper.pdf"),
    /already in your library/,
  );
  assert.equal(fs.readFileSync(firstPath, "utf8"), "first");
});

test("deleting a book removes its PDF, image, annotation, and progress", () => {
  const fileName = "paper.pdf";
  const bookPath = saveBookFile(testDirectory, Buffer.from("pdf"), fileName);
  const imagePath = path.join(testDirectory, "images", fileName);
  const annotationPath = getAnnotationsPath(testDirectory, fileName);
  fs.mkdirSync(path.dirname(imagePath), { recursive: true });
  fs.mkdirSync(path.dirname(annotationPath), { recursive: true });
  fs.writeFileSync(imagePath, "image");
  fs.writeFileSync(annotationPath, "[]");
  saveReadingProgress(testDirectory, fileName, 14);

  deleteBookData(testDirectory, fileName);

  assert.equal(fs.existsSync(bookPath), false);
  assert.equal(fs.existsSync(imagePath), false);
  assert.equal(fs.existsSync(annotationPath), false);
  assert.equal(getReadingProgress(testDirectory, fileName), 1);
});

test("reading progress persists independently for each book", () => {
  saveReadingProgress(testDirectory, "one.pdf", 8);
  saveReadingProgress(testDirectory, "two.pdf", 21);

  assert.equal(getReadingProgress(testDirectory, "one.pdf"), 8);
  assert.equal(getReadingProgress(testDirectory, "two.pdf"), 21);
  assert.equal(getReadingProgress(testDirectory, "new.pdf"), 1);
});
