/** Where a typed question goes: the ask flow works it out from there. */
export function askPath(question: string) {
  return `/ask?q=${encodeURIComponent(question)}`;
}
