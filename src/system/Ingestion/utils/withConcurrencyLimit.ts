export async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = task().then((result) => results.push(result)) as Promise<void>;
    executing.push(p);

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
      executing.splice(
        0,
        executing.findIndex((p) => p !== undefined)
      );
    }
  }

  await Promise.all(executing);
  return results;
}
