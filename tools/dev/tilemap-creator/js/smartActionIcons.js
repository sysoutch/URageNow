const smartActionIconPaths = {
  replace: "<path d='M4 7h10a4 4 0 0 1 0 8H7'/><path d='M7 11l-3 4 3 4'/><path d='M17 5h3v3'/>",
  add: "<path d='M12 5v14'/><path d='M5 12h14'/>",
  selectionReplace: "<rect x='4' y='4' width='8' height='8' rx='1'/><path d='M14 7h6v6'/><path d='M20 7l-7 7'/><path d='M16 18H4v-4'/>",
  selectionAdd: "<rect x='4' y='4' width='8' height='8' rx='1'/><path d='M17 10v8'/><path d='M13 14h8'/>",
  clear: "<path d='M6 6l12 12'/><path d='M18 6L6 18'/>"
};

export function renderSmartActionSvg(type) {
  const key = String(type || "").trim();
  const paths = smartActionIconPaths[key] || smartActionIconPaths.add;
  return "<svg viewBox='0 0 24 24' aria-hidden='true'>" + paths + "</svg>";
}
