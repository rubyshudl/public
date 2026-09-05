(function () {
  "use strict";

  const projects = Array.isArray(window.PUBLIC_PROJECTS) ? window.PUBLIC_PROJECTS : [];
  const state = { category: "全部", query: "" };
  const grid = document.getElementById("projectGrid");
  const filters = document.getElementById("categoryFilters");
  const search = document.getElementById("projectSearch");
  const count = document.getElementById("projectCount");
  const empty = document.getElementById("emptyResults");

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function formatDate(dateString) {
    const [year, month, day] = dateString.split("-");
    return `${year}.${month}.${day}`;
  }

  function symbolMarkup(symbol) {
    if (symbol === "route") {
      return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 10c6 0 9 4 9 9 0 7-9 16-9 16S9 26 9 19c0-5 3-9 9-9Z"/><circle cx="18" cy="19" r="3"/><path d="M22 39c0 8 7 12 15 12s17-3 17-11c0-5-4-8-10-8h-8"/><path d="m40 27-5 5 5 5"/></svg>`;
    }
    return `<span aria-hidden="true">${escapeHtml(symbol || "◆")}</span>`;
  }

  function cardMarkup(project, index) {
    const features = project.features.map((feature) => `<span>${escapeHtml(feature)}</span>`).join("");
    return `
      <article class="project-card color-${escapeHtml(project.color)}" style="--card-order:${index}">
        <a class="card-link" href="${escapeHtml(project.path)}" aria-label="进入 ${escapeHtml(project.title)}"></a>
        <div class="card-visual">
          <div class="card-symbol">${symbolMarkup(project.symbol)}</div>
          <span class="project-status"><i></i>${escapeHtml(project.status)}</span>
          <span class="visual-word">${escapeHtml(project.title)}</span>
        </div>
        <div class="card-content">
          <div class="card-meta"><span>${escapeHtml(project.category)}</span><time datetime="${escapeHtml(project.updated)}">更新于 ${formatDate(project.updated)}</time></div>
          <h3><span>${escapeHtml(project.title)}</span><small>${escapeHtml(project.chineseTitle)}</small></h3>
          <p>${escapeHtml(project.description)}</p>
          <div class="card-footer">
            <div class="feature-list">${features}</div>
            <span class="open-project">进入项目 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></span>
          </div>
        </div>
      </article>`;
  }

  function renderFilters() {
    const categories = ["全部", ...new Set(projects.map((project) => project.category))];
    filters.innerHTML = categories.map((category) => `<button class="${category === state.category ? "active" : ""}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${category === state.category}">${escapeHtml(category)}</button>`).join("");
  }

  function matchedProjects() {
    const query = state.query.trim().toLocaleLowerCase("zh-CN");
    return projects.filter((project) => {
      const categoryMatches = state.category === "全部" || project.category === state.category;
      const searchable = [project.title, project.chineseTitle, project.category, project.description, ...project.features].join(" ").toLocaleLowerCase("zh-CN");
      return categoryMatches && (!query || searchable.includes(query));
    });
  }

  function renderProjects() {
    const matched = matchedProjects();
    grid.innerHTML = matched.map(cardMarkup).join("");
    grid.hidden = matched.length === 0;
    empty.hidden = matched.length !== 0;
    count.textContent = state.query || state.category !== "全部" ? `找到 ${matched.length} 个项目` : `共 ${projects.length} 个公开项目`;
  }

  function clearSearch() {
    state.query = "";
    state.category = "全部";
    search.value = "";
    renderFilters();
    renderProjects();
    search.focus();
  }

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    renderFilters();
    renderProjects();
  });

  search.addEventListener("input", () => { state.query = search.value; renderProjects(); });
  document.getElementById("clearSearchButton").addEventListener("click", clearSearch);
  document.getElementById("currentYear").textContent = new Date().getFullYear();

  renderFilters();
  renderProjects();
})();
