const KEY = "bofil_device_token";

export function getDeviceToken(): string {
  let t = localStorage.getItem(KEY);
  if (!t) {
    const b = crypto.getRandomValues(new Uint8Array(32));
    t = Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(KEY, t);
  }
  return t;
}
