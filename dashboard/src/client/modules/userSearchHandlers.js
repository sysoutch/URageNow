class DashboardUserSearchHandlers {
  constructor(input) {
    this.input = input;
  }

  bind() {
    const inputNode = document.getElementById("user-search");
    if (inputNode) {
      inputNode.addEventListener("keydown", event => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        void this.input.loadUsers("cache");
      });
    }
    const searchButton = document.getElementById("search-users-button");
    if (searchButton) {
      searchButton.addEventListener("click", () => {
        void this.input.loadUsers("cache");
      });
    }
    const fetchButton = document.getElementById("fetch-users-button");
    if (fetchButton) {
      fetchButton.addEventListener("click", () => {
        void this.input.loadUsers("fetch");
      });
    }
  }
}

function createDashboardUserSearchHandlers(input) {
  return new DashboardUserSearchHandlers(input);
}

if (typeof window !== "undefined") {
  window.createDashboardUserSearchHandlers = createDashboardUserSearchHandlers;
}
