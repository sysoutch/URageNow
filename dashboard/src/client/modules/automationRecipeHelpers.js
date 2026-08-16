function formatDashboardImagePostProcessingRecipes(recipes) {
  return Array.isArray(recipes)
    ? recipes.map(recipe => Array.isArray(recipe.steps) ? recipe.steps.join(" > ") : "").filter(Boolean).join("\n")
    : "";
}

function parseDashboardImagePostProcessingRecipes(value) {
  const normalizeStep = step => {
    const normalized = String(step || "").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
    if (["remove", "remove-bg", "remove-background", "background-remove", "rembg", "bg-remove"].includes(normalized)) return "remove-background";
    if (["pixel", "pixel-art", "pixelart", "pixels"].includes(normalized)) return "pixel-art";
    if (normalized === "delight" || normalized === "de-light") return "delight";
    return "";
  };
  return String(value || "").split(/\r?\n/).map(line => {
    const steps = line.split(">").map(normalizeStep).filter(Boolean);
    if (steps.length === 0) {
      return null;
    }
    return { label: steps.join(" > "), steps };
  }).filter(Boolean);
}
