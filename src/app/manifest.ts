import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "After-School Tracker",
    short_name: "Tracker",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFF7E8",
    theme_color: "#FFF7E8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
