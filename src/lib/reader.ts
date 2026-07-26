export const getPreviousPage = (currentPage: number) =>
  Math.max(currentPage - 1, 1);

export const getNextPage = (currentPage: number, totalPages: number) =>
  Math.min(currentPage + 1, totalPages);
