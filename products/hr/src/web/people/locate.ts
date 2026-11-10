/**
 * Where this phone or computer is, as the browser reports it, for a clock-in. Asked at the press,
 * never before. Null when the browser has no location, the person said no, or it took too long:
 * the branch's rules then decide what a clock-in without one comes to.
 */
export function locate(): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}
