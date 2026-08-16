function normalizeModelProviderCatalog(providers) {
  if (!Array.isArray(providers)) {
    return [];
  }
  return providers
    .map(entry => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const provider = typeof entry.provider === "string" ? entry.provider.trim() : "";
      const label = typeof entry.label === "string" ? entry.label.trim() : provider;
      const models = Array.isArray(entry.models)
        ? entry.models.map(model => String(model || "").trim()).filter(Boolean)
        : [];
      if (!provider) {
        return null;
      }
      return { provider, label: label || provider, models };
    })
    .filter(Boolean);
}

function formatModelSelectionLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const parts = raw.split("::");
  if (parts.length !== 2) {
    return raw;
  }
  const provider = parts[0] === "lmstudio" ? "LM Studio" : parts[0] === "ollama" ? "Ollama" : parts[0];
  const model = parts[1] || "";
  return model ? provider + " | " + model : provider;
}

function resolveSelectedModelValue(providers, selectedValue) {
  const raw = String(selectedValue || "").trim();
  if (!raw) {
    return "";
  }
  if (raw.includes("::")) {
    return raw;
  }
  for (const providerEntry of providers) {
    if (providerEntry.models.includes(raw)) {
      return providerEntry.provider + "::" + raw;
    }
  }
  return raw;
}

function flattenModelSelectionValues(providers) {
  return providers.flatMap(providerEntry => providerEntry.models.map(model => providerEntry.provider + "::" + model));
}

function fillModelSelect(id, providers, selectedValue, emptyText) {
  const select = document.getElementById(id);
  clearChildren(select);
  const normalizedProviders = normalizeModelProviderCatalog(providers);
  const flattenedValues = flattenModelSelectionValues(normalizedProviders);
  if (flattenedValues.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = emptyText;
    select.appendChild(option);
    return;
  }
  for (const providerEntry of normalizedProviders) {
    const group = document.createElement("optgroup");
    group.label = providerEntry.label;
    for (const model of providerEntry.models) {
      const option = document.createElement("option");
      option.value = providerEntry.provider + "::" + model;
      option.textContent = model;
      group.appendChild(option);
    }
    select.appendChild(group);
  }
  const normalizedSelectedValue = resolveSelectedModelValue(normalizedProviders, selectedValue);
  if (normalizedSelectedValue && flattenedValues.includes(normalizedSelectedValue)) {
    select.value = normalizedSelectedValue;
    return;
  }
  if (normalizedSelectedValue && !flattenedValues.includes(normalizedSelectedValue)) {
    const option = document.createElement("option");
    option.value = normalizedSelectedValue;
    option.textContent = formatModelSelectionLabel(normalizedSelectedValue) + " (active)";
    select.appendChild(option);
    select.value = normalizedSelectedValue;
    return;
  }
  select.value = flattenedValues[0];
}
