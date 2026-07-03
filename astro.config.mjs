import { defineConfig } from "astro/config";

const site = process.env.SITE_URL || "https://starsail.netlify.app";
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  site,
  base
});
