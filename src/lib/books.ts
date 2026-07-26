type NamedBook = { name: string };

export const hasDuplicateBookName = (
  books: NamedBook[],
  candidateName: string,
) =>
  books.some(
    (book) =>
      book.name.toLocaleLowerCase() === candidateName.toLocaleLowerCase(),
  );
