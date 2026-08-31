const KEY = "cofounder.fp";

export function getFingerprint(): string {
  if (typeof window === "undefined") return "serverplaceholder000";
  let id = localStorage.getItem(KEY);
  if (!id || !/^[a-z0-9]{16,64}$/i.test(id)) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(KEY, id);
  }
  return id;
}
