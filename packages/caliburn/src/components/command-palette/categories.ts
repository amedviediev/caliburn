/**
 * Upstream declares these in `CommandPalette.tsx`; they live in their own
 * module here because actions reference them (`actionLinearEditor`) and the
 * palette component imports the editor, which imports the actions.
 */
export const DEFAULT_CATEGORIES = {
  app: "App",
  export: "Export",
  tools: "Tools",
  editor: "Editor",
  elements: "Elements",
  links: "Links",
  library: "Library",
};
