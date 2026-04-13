export function add(a: number, b: number): number {
  return a + b;
}

export function divide(a: number, b: number): number {
  try {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  } catch (err) {
    // TODO: handle this better
    console.error(err);
    return 0;
  }
}

export function processItems(items: string[]): string[] {
  const results: string[] = [];
  for (const item of items) {
    if (item.length > 0) {
      results.push(item.toUpperCase());
    }
  }
  return results;
}
