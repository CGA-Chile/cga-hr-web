# 0014 — The cell panel opens in the browser

Date: 2026-10-15
Status: Accepted

## Context

Every cell of the period sheet was a `<Link>` to `/planilla?dia=…&persona=…`. The page is dynamic
and has no `loading.tsx`, so Next neither prefetched it nor showed anything until the server
answered: opening a cell re-ran the whole page — periods, employees, the range's assignments, the
bonus for every date of the range, the anomalies of every unsettled date, then the cell's history
— and sent back the whole grid again.

Measured in production on 2026-10-15, from Santiago: 737–1029 ms and 338 KB per click, the same
as loading the sheet from scratch; the panel itself was 3 KB of it. Functions run in `iad1`, next
to the database in `ca-central-1`, so the region was not the cause. Users felt one to two seconds.

Everything the panel shows, except the history, is already on the sheet.

## Decision

- The sheet sends, with the grid, what the cell panel needs per filled cell: position, note,
  marks, and the amount only for a role that sees amounts (`buildPanelCells`). The RUT is not
  sent.
- The grid stays server-rendered. A cell is a plain `<a>`; `CellPanelHost` catches a plain click
  on one and changes the URL with `history.pushState`, which Next syncs with `useSearchParams`
  without a server render. A modified or middle click, or a page without JavaScript, follows the
  link as before.
- The open cell still lives in the URL: the back button closes it and a link opens it. The server
  renders nothing for it and loads nothing for it, so the refresh after an edit does not reload
  it; it only reads `persona` to leave out the day's summary while a cell is open.
- The history is read from the browser with the Supabase client, under the same RLS, and read
  again on every server render so an edit shows up in it.
- The day's summary and the period-end panel are still server-rendered from the URL. Since the
  URL can now change without the server, they are wrapped in `ServerPanelGate`, which hides them
  once the URL stops asking for them.

## Consequences

- Opening a cell, stepping along the row and closing cost no server render. Only the history
  travels, browser to database directly.
- Two panel mechanisms coexist on the sheet: the cell panel in the browser, the others through the
  server. Turning the cell panel back into a `<Link>` brings the full render back on every click.
- The open cell, its row and its date header are marked by a `<style>` the host writes, since the
  server no longer knows the selection.
- The sheet's initial payload grows by one small object per filled cell.
- The day's summary is next: most of what it shows is already computed for the grid. The day view
  (`/dia`) still opens its drawers through the server.
