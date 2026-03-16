import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://xn--om2b21rhzo.site",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
