// 앱인토스 SDK 래퍼. 브라우저/devtools 폴백 포함.
import * as AIT from "@apps-in-toss/web-framework";

export type LatLng = { lat: number; lng: number };

export async function tossLogin(): Promise<{ authorizationCode: string; referrer?: string }> {
  const appLogin = (AIT as any).appLogin;
  if (typeof appLogin === "function") return await appLogin();
  return { authorizationCode: "dev-" + Math.floor(performance.now()) }; // devtools 폴백
}

// 공유. 토스 SDK share → navigator.share → 클립보드 순 폴백.
export async function shareLink(message: string, url?: string): Promise<void> {
  const fn = (AIT as any).share; // 앱인토스 share는 { message }만 받음 → url은 본문에 포함
  const text = url ? `${message}\n${url}` : message;
  if (typeof fn === "function") return void (await fn({ message: text }));
  if (typeof navigator !== "undefined" && navigator.share) return void (await navigator.share({ text: message, url }));
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(`${message} ${url ?? ""}`.trim());
    alert("링크를 복사했어요.");
  }
}

// 외부 딥링크 열기 (길찾기 등)
export function openExternal(url: string): void {
  const w = window as any;
  if (typeof w.open === "function") w.open(url, "_blank");
  else location.href = url;
}

// 현재 위치 1회. SDK 함수명은 릴리스별로 다를 수 있어 feature-detect.
export async function getCurrentLocation(): Promise<LatLng> {
  const fn = (AIT as any).getCurrentLocation; // 앱인토스 실제 export
  if (typeof fn === "function") {
    try {
      // 토스 WebView 안에서만 동작. 반환은 { coords: { latitude, longitude } }.
      const r = await fn({ accuracy: "balanced" });
      const c = r?.coords ?? r;
      if (c && (c.latitude ?? c.lat) != null) return { lat: c.latitude ?? c.lat, lng: c.longitude ?? c.lng };
    } catch {
      // 토스 브리지 밖(로컬 브라우저) → 아래 브라우저 위치로 폴백
    }
  }
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    return new Promise((res) =>
      navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => res({ lat: 37.5665, lng: 126.978 }), // 권한 거부 시 서울시청
        { enableHighAccuracy: true, timeout: 8000 },
      ),
    );
  }
  return { lat: 37.5665, lng: 126.978 }; // 서울시청 mock
}
