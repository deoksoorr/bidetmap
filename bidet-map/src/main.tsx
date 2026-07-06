import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { getSchemeUri } from "@apps-in-toss/web-framework";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import config from "../granite.config.ts";
import Onboarding from "./pages/Onboarding";
import MapMain from "./pages/MapMain";
import Register from "./pages/Register";
import PlaceDetail from "./pages/PlaceDetail";
import AddRestroom from "./pages/AddRestroom";
import Favorites from "./pages/Favorites";
import Recent from "./pages/Recent";
import Terms from "./pages/Terms";
import "./index.css";
import "./styles.css";

// 진입 딥링크(intoss://bidet-map/<path>)를 읽어 시작 경로를 결정한다.
// 예: 토스 로그인 동의화면의 "서비스 이용약관" 링크(intoss://bidet-map/terms) → /terms 로 진입.
// 앱인토스 WebView 밖(빌드/노드)에서는 getSchemeUri()가 예외를 던지므로 "/"로 폴백.
function initialEntry(): string {
  try {
    const uri = getSchemeUri(); // "intoss://bidet-map/terms" (또는 "/terms")
    if (typeof uri === "string" && uri) {
      if (uri.startsWith("/")) return uri; // 경로만 넘어오는 경우
      const u = new URL(uri);
      const path = (u.pathname || "/") + (u.search || "");
      if (path && path !== "/") return path;
    }
  } catch {
    /* WebView 밖(빌드/노드): 기본 진입 */
  }
  return "/";
}

// WebView 안전: URL 히스토리에 의존하지 않는 MemoryRouter
const router = createMemoryRouter(
  [
    { path: "/", element: <Onboarding /> },
    { path: "/map", element: <MapMain /> },
    { path: "/register", element: <Register /> },
    { path: "/place/:id", element: <PlaceDetail /> },
    { path: "/place/:id/add", element: <AddRestroom /> },
    { path: "/favorites", element: <Favorites /> },
    { path: "/recent", element: <Recent /> },
    { path: "/terms", element: <Terms /> },
  ],
  { initialEntries: [initialEntry()] },
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TDSMobileAITProvider brandPrimaryColor={config.brand.primaryColor}>
      <RouterProvider router={router} />
    </TDSMobileAITProvider>
  </StrictMode>,
);
