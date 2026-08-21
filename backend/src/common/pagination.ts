/** The envelope every list endpoint returns (SRS §7). */
export type Paginated<T> = {
  data: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  page_size: number,
): Paginated<T> {
  return {
    data,
    page,
    page_size,
    total,
    // Always at least one page, so an empty register still reads "1 of 1".
    total_pages: Math.max(1, Math.ceil(total / page_size)),
  };
}
