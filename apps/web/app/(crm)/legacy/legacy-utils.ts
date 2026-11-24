/** Group decimal text without passing source amounts through floating point. */
export function sourceNumber(value: string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const parts = /^([+-]?)(\d+)(\.\d+)?$/.exec(value);
  if (!parts) return value;
  return parts[1] + parts[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (parts[3] || '');
}

export function csvCell(value: string | number | null | undefined): string {
  let text = String(value ?? '');
  // Prevent formulas even when an imported label has leading control characters.
  if (/^[\u0000-\u0020]*[=+@\-]|^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
