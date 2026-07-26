import assert from "node:assert/strict";
import test from "node:test";
import { hasDuplicateBookName } from "../src/lib/books.ts";
import { getLocalAIUnavailableMessage } from "../src/lib/explanations.ts";
import { getNextPage, getPreviousPage } from "../src/lib/reader.ts";

test("duplicate book detection is case-insensitive", () => {
  const books = [{ name: "Research_Paper.pdf" }];

  assert.equal(hasDuplicateBookName(books, "research_paper.PDF"), true);
  assert.equal(hasDuplicateBookName(books, "another.pdf"), false);
});

test("reader navigation stays within document boundaries", () => {
  assert.equal(getPreviousPage(1), 1);
  assert.equal(getPreviousPage(5), 4);
  assert.equal(getNextPage(4, 5), 5);
  assert.equal(getNextPage(5, 5), 5);
});

test("local AI failures direct the reader to load a model", () => {
  const explanationMessage = getLocalAIUnavailableMessage("explanation");
  const followUpMessage = getLocalAIUnavailableMessage("follow-up");

  for (const message of [explanationMessage, followUpMessage]) {
    assert.match(message, /library/i);
    assert.match(message, /Settings/);
    assert.match(message, /load a model/);
  }
});
