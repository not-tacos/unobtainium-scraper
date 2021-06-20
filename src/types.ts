export type Logger = {
  error: typeof console.log;
  info: typeof console.log;
  debug: typeof console.log;
  warn: typeof console.log;
};
