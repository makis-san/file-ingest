import chalk from "chalk";
export const log = (
  level: "INFO" | "ERROR" | "WARN" | "SYSTEM",
  message: string,
  data?: any
): void => {
  const timestamp = new Date().toISOString();
  const logColor: keyof typeof chalk =
    level === "INFO"
      ? "cyan"
      : level === "ERROR"
      ? "red"
      : level === "WARN"
      ? "yellowBright"
      : "grey";

  const formattedLog = `${chalk.bgGreen.white.bold(
    `[${chalk.yellowBright(timestamp)}]`
  )} ${chalk.bgGreen.white.bold(
    `[${chalk[logColor](level)}]`
  )} ${chalk.whiteBright(message)}`;

  if (data) {
    console.log(formattedLog, JSON.stringify(data, null, 2));
  } else {
    console.log(formattedLog);
  }
};
