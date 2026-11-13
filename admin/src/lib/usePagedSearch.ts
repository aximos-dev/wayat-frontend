import { useMemo, useState } from "react";

/**
 * Client-side search + pagination over an already-fetched list — the right trade-off at this
 * app's scale (a school's whole roster is a few hundred to a couple thousand rows, one fetch),
 * not worth adding server-side search/page params for yet. Revisit if/when a tenant's student
 * count makes a single `GET .../children` fetch itself slow, not just rendering it.
 *
 * Typing resets to page 1 (a stale page position after narrowing the results is confusing).
 * `page` is automatically clamped into range as `items`/`query` change, so e.g. deleting the
 * last row on the last page doesn't strand the view on an empty page.
 */
export function usePagedSearch<T>(
  items: T[] | undefined,
  matches: (item: T, query: string) => boolean,
  pageSize = 20,
) {
  const [query, setQueryRaw] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const all = items ?? [];
    const q = query.trim().toLowerCase();
    return q ? all.filter((item) => matches(item, q)) : all;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `matches` is a per-render closure; re-filtering every render is cheap at this data scale.
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  function setQuery(next: string) {
    setQueryRaw(next);
    setPage(1);
  }

  return { query, setQuery, page: safePage, setPage, totalPages, totalCount: filtered.length, pageSize, paged };
}
