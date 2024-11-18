export function renderProgressBar(progress: number): string {
  const totalSlots = 10; // Total characters in the progress bar
  const filledSlots = Math.round((progress / 100) * totalSlots);

  const filledBar = "█".repeat(filledSlots); // Filled portion
  const emptyBar = "░".repeat(totalSlots - filledSlots); // Empty portion

  return `[${filledBar}${emptyBar}] ${progress.toFixed(0)}%`;
}
