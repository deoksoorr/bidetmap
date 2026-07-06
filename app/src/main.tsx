import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Onboarding from "./pages/Onboarding";
import MapMain from "./pages/MapMain";
import Register from "./pages/Register";
import PlaceDetail from "./pages/PlaceDetail";
import AddRestroom from "./pages/AddRestroom";
import Favorites from "./pages/Favorites";
import Recent from "./pages/Recent";
import Terms from "./pages/Terms";
import "./styles.css";

const router = createBrowserRouter([
  { path: "/", element: <Onboarding /> },
  { path: "/map", element: <MapMain /> },
  { path: "/register", element: <Register /> },
  { path: "/place/:id", element: <PlaceDetail /> },
  { path: "/place/:id/add", element: <AddRestroom /> },
  { path: "/favorites", element: <Favorites /> },
  { path: "/recent", element: <Recent /> },
  { path: "/terms", element: <Terms /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
