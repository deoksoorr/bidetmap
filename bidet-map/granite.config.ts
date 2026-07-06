import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "bidet-map",
  brand: {
    displayName: "비데맵",
    primaryColor: "#0265F1",
    icon: "https://static.toss.im/appsintoss/57263/fb15760b-5741-498f-83b4-6273091401a3.png", // 콘솔 앱 정보에 등록한 아이콘과 동일
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  permissions: [
    { name: "geolocation", access: "access" }, // 현재 위치(주변 검색)
    { name: "camera", access: "access" }, // 화장실 사진 촬영
    { name: "photos", access: "read" }, // 앨범에서 사진 선택
  ],
  outdir: "dist",
});
