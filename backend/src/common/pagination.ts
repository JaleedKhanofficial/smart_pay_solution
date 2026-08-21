/** The envelope every list endpoint returns (SRS §7). */
export type Paginated<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return {
    data,
    page,
    pageSize,
    total,
    // Always at least one page, so an empty register still reads "1 of 1".
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
