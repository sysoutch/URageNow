function createLazyDashboardHelperProxy(getHelper, fallback) {
  const fallbackHelper = fallback && typeof fallback === "object" ? fallback : {};
  return new Proxy(fallbackHelper, {
    get(_target, property) {
      const resolveHelper = () => {
        const helper = typeof getHelper === "function" ? getHelper() : null;
        return helper && typeof helper === "object" ? helper : fallbackHelper;
      };
      const fallbackValue = fallbackHelper[property];
      if (typeof fallbackValue !== "undefined" && typeof fallbackValue !== "function") {
        return fallbackValue;
      }
      return (...args) => {
        const nextValue = resolveHelper()[property];
        if (typeof nextValue === "function") {
          return nextValue(...args);
        }
        return typeof fallbackValue === "function" ? fallbackValue(...args) : undefined;
      };
    }
  });
}
