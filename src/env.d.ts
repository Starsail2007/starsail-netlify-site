/// <reference types="astro/client" />

declare module "*.md" {
  export const frontmatter: Record<string, any>;
  const Content: unknown;
  export default Content;
}
