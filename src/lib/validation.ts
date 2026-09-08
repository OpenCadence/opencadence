export function text(
  data: FormData,
  key: string,
  max = 200,
  required = false,
  whitespace: "trim" | "preserve" = "trim",
): string {
  const value = data.get(key);
  if (value !== null && typeof value !== "string")
    throw new Error(`Invalid ${key.replaceAll("_", " ")}.`);
  const result =
    whitespace === "preserve" ? (value ?? "") : (value ?? "").trim();
  if (required && !result.trim())
    throw new Error(`Please enter a ${key.replaceAll("_", " ")}.`);
  if (result.length > max)
    throw new Error(
      `${key.replaceAll("_", " ")} must be ${max} characters or fewer.`,
    );
  return result;
}
export function isCalendarDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function date(data: FormData, key: string): string {
  const value = text(data, key, 10);
  if (value && !isCalendarDate(value)) {
    throw new Error("Please enter a valid date.");
  }
  return value;
}
export function choice<T extends string>(
  data: FormData,
  key: string,
  choices: readonly T[],
): T {
  const value = text(data, key);
  if (!choices.includes(value as T))
    throw new Error(`Invalid ${key.replaceAll("_", " ")}.`);
  return value as T;
}
export function email(data: FormData): string {
  const value = text(data, "email", 254);
  if (
    value &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /[?&#%]/.test(value))
  )
    throw new Error("Please enter a valid email address.");
  return value;
}
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
