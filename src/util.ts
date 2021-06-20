export const uuidv4 = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    let r = (Math.random() * 16) | 0;
    let v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// grabs numbers without commas
export function parseNumberEN(value: string) {
  const cleanPattern = new RegExp("[^-+0-9^.]", "g");
  const cleaned = value.replace(cleanPattern, "");
  return parseFloat(cleaned);
}
