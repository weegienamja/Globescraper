/**
 * Adds `data-label` attributes to every <td> in tables within a container,
 * using the corresponding <th> text from the table header.
 *
 * This enables the CSS mobile card layout where each cell displays
 * its column header inline via `td::before { content: attr(data-label) }`.
 */
export function labelTableCells(container: HTMLElement): void {
  const tables = container.querySelectorAll("table");

  tables.forEach((table) => {
    // Collect header labels
    const headers: string[] = [];
    table.querySelectorAll("thead th").forEach((th) => {
      headers.push(th.textContent?.trim() ?? "");
    });

    if (headers.length === 0) return;

    // Label each body cell
    table.querySelectorAll("tbody tr").forEach((row) => {
      row.querySelectorAll("td").forEach((td, i) => {
        if (headers[i]) {
          td.setAttribute("data-label", headers[i]);
        }
      });
    });
  });
}
