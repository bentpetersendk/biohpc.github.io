(function () {
  const state = {
    raw: null,
    tables: [],
    charts: [],
    activity: null,
  };

  const META_KEY_PATTERN = /(updated|created|generated|timestamp|source|status|schema|version|metadata|meta)$/i;
  const TIME_KEY_PATTERN = /(date|time|month|week|year|period|updated|created|generated)/i;
  const ACTIVITY_KEY_PATTERN = /(activity|event|events|log|audit|recent|history)/i;
  const PUBLIC_METRICS = [
    { key: "pis.registered", label: "Registered Principal Investigators" },
    { key: "users.registered", label: "Users" },
    { key: "projects.total", label: "Total Project Spaces" },
    { key: "projects.ordered", label: "Projects in Onboarding" },
    { key: "projects.active", label: "Active Project Spaces" },
  ];

  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("statistics-content")) {
      loadStatistics();
    }
  });

  async function loadStatistics() {
    showLoading();

    try {
      const statsUrl = getStatsUrl();
      const response = await fetch(statsUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`${statsUrl} returned HTTP ${response.status}`);

      const data = await response.json();
      if (!data || typeof data !== "object") throw new Error("Statistics JSON does not contain an object.");

      state.raw = data;
      state.tables = detectTables(data);
      state.charts = detectTimeSeries(data);
      state.activity = detectActivityTable(state.tables);

      renderMetricCards(data);
      renderCharts(state.charts);
      renderTables(state.tables, state.activity);
      renderRecentActivity(state.activity);
      renderStatisticsInfo(data);
      showContent(hasRenderableData(data));
    } catch (error) {
      showError("Statistics could not be loaded. Please try again later.");
      renderStatisticsInfo(null);
    }
  }

  function getStatsUrl() {
    if (typeof siteConfig !== "undefined" && siteConfig.urls?.biohpcStats) {
      return siteConfig.urls.biohpcStats;
    }
    throw new Error("BioHPC statistics URL is not configured.");
  }

  function showLoading() {
    setHidden("statistics-loading", false);
    setHidden("statistics-error", true);
    setHidden("statistics-empty", true);
    setHidden("statistics-content", true);
  }

  function showContent(hasData) {
    setHidden("statistics-loading", true);
    setHidden("statistics-content", !hasData);
    setHidden("statistics-empty", hasData);
  }

  function showError(message) {
    const error = document.getElementById("statistics-error");
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    setHidden("statistics-loading", true);
    setHidden("statistics-content", true);
    setHidden("statistics-empty", true);
  }

  function setHidden(id, hidden) {
    const element = document.getElementById(id);
    if (element) element.hidden = hidden;
  }

  function hasRenderableData(data) {
    return getTopLevelMetrics(data).length > 0 || state.tables.length > 0 || state.charts.length > 0;
  }

  function renderMetricCards(data) {
    const grid = document.getElementById("metrics-grid");
    if (!grid) return;

    const metrics = getTopLevelMetrics(data);
    grid.replaceChildren();

    if (!metrics.length) {
      grid.appendChild(createMessage("No public statistics were found in stats.json."));
      return;
    }

    metrics.forEach((metric) => {
      const card = document.createElement("article");
      card.className = "dashboard-metric-card";

      const value = document.createElement("span");
      value.className = "dashboard-metric-value";
      updateMetricValue(value, metric.value, metric.key);

      const label = document.createElement("h3");
      label.textContent = metric.label;

      const trend = detectTrend(data, metric.key);
      if (trend) {
        const trendElement = document.createElement("p");
        trendElement.className = trend.direction >= 0 ? "metric-trend up" : "metric-trend down";
        trendElement.textContent = `${trend.direction >= 0 ? "+" : "-"}${formatNumber(Math.abs(trend.change))} from previous`;
        card.append(value, label, trendElement);
      } else {
        card.append(value, label);
      }

      grid.appendChild(card);
    });
  }

  function getTopLevelMetrics(data) {
    return PUBLIC_METRICS
      .map((metric) => ({
        ...metric,
        value: getNestedValue(data, metric.key),
      }))
      .filter((metric) => Number.isFinite(metric.value));
  }

  function getNestedValue(value, path) {
    return path.split(".").reduce((current, key) => current && current[key], value);
  }

  function detectTrend(data, metricKey) {
    const path = metricKey.split(".");
    const metricName = path[path.length - 1];
    const parent = path.slice(0, -1).reduce((current, key) => current && current[key], data);
    if (!parent || typeof parent !== "object") return null;

    const previousKey = [
      `${metricName}_previous`,
      `previous_${metricName}`,
      `${metricName}_last`,
      `last_${metricName}`,
    ].find((key) => Number.isFinite(parent[key]));
    if (!previousKey) return null;

    return {
      change: parent[metricName] - parent[previousKey],
      direction: parent[metricName] - parent[previousKey],
    };
  }

  function renderCharts(charts) {
    const section = document.getElementById("charts-section");
    const grid = document.getElementById("charts-grid");
    if (!section || !grid) return;

    grid.replaceChildren();
    section.hidden = !charts.length;
    if (!charts.length) return;

    charts.forEach((chartData, index) => {
      const card = document.createElement("article");
      card.className = "dashboard-chart-card";

      const heading = document.createElement("h3");
      heading.textContent = chartData.title;

      const canvasWrap = document.createElement("div");
      canvasWrap.className = "chart-canvas-wrap";

      const canvas = document.createElement("canvas");
      canvas.id = `statistics-chart-${index}`;
      canvasWrap.appendChild(canvas);
      card.append(heading, canvasWrap);
      grid.appendChild(card);

      if (window.Chart) {
        createChart(canvas, chartData);
      } else {
        canvasWrap.replaceChildren(createMessage("Chart.js did not load, so this trend cannot be displayed."));
      }
    });
  }

  function createChart(canvas, chartData) {
    const colors = ["#901a1e", "#db3b0a", "#32667a", "#687782", "#a5000c", "#4c6f55"];
    new Chart(canvas, {
      type: "line",
      data: {
        labels: chartData.labels,
        datasets: chartData.datasets.map((dataset, index) => ({
          label: dataset.label,
          data: dataset.data,
          borderColor: colors[index % colors.length],
          backgroundColor: `${colors[index % colors.length]}22`,
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.28,
          fill: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { position: "bottom" },
        },
        scales: {
          x: { grid: { color: "rgba(10, 10, 10, 0.06)" } },
          y: { beginAtZero: true, grid: { color: "rgba(10, 10, 10, 0.08)" } },
        },
      },
    });
  }

  function detectTimeSeries(data) {
    const charts = [];
    walk(data, (value, path) => {
      if (!Array.isArray(value) || value.length < 2 || !value.every(isPlainObject)) return;

      const columns = collectColumns(value);
      const timeKey = columns.find((key) => TIME_KEY_PATTERN.test(key) && value.some((row) => isDateLike(row[key])));
      if (!timeKey) return;

      const numericKeys = columns.filter((key) => key !== timeKey && value.some((row) => Number.isFinite(toNumber(row[key]))));
      if (!numericKeys.length) return;

      const sortedRows = [...value].sort((a, b) => String(a[timeKey]).localeCompare(String(b[timeKey])));
      charts.push({
        path: path.join("."),
        title: labelize(path[path.length - 1] || "trend"),
        labels: sortedRows.map((row) => formatLabel(row[timeKey])),
        datasets: numericKeys.map((key) => ({
          label: labelize(key),
          data: sortedRows.map((row) => toNumber(row[key])),
        })),
      });
    });
    return charts;
  }

  function detectTables(data) {
    const tables = [];
    walk(data, (value, path) => {
      if (!Array.isArray(value) || !value.length || !value.every(isPlainObject)) return;

      const columns = collectColumns(value);
      if (!columns.length) return;

      tables.push({
        id: slugify(path.join("-") || "records"),
        path: path.join("."),
        title: labelize(path[path.length - 1] || "Records"),
        rows: value,
        columns,
      });
    });
    return tables;
  }

  function renderTables(tables, activityTable) {
    const section = document.getElementById("tables-section");
    const grid = document.getElementById("tables-grid");
    if (!section || !grid) return;

    const visibleTables = tables.filter((table) => table !== activityTable);
    grid.replaceChildren();
    section.hidden = !visibleTables.length;

    visibleTables.forEach((table) => {
      const card = document.createElement("article");
      card.className = "dashboard-table-card";

      const header = document.createElement("div");
      header.className = "table-card-header";

      const heading = document.createElement("h3");
      heading.textContent = table.title;

      const exportButton = document.createElement("button");
      exportButton.className = "table-export";
      exportButton.type = "button";
      exportButton.textContent = "CSV";
      exportButton.addEventListener("click", () => downloadCsv(table));

      header.append(heading, exportButton);
      card.append(header, createSortableTable(table));
      grid.appendChild(card);
    });
  }

  function renderRecentActivity(activityTable) {
    const section = document.getElementById("activity-section");
    const target = document.getElementById("activity-table");
    if (!section || !target) return;

    target.replaceChildren();
    section.hidden = !activityTable;
    if (!activityTable) return;

    const rows = [...activityTable.rows].slice(0, 20);
    const columns = activityTable.columns.filter((column) => rows.some((row) => row[column] !== undefined && row[column] !== ""));
    target.appendChild(createSortableTable({ ...activityTable, rows, columns }));
  }

  function updateMetricValue(element, value, key) {
    if (!Number.isFinite(value)) {
      element.textContent = value === null || value === undefined || value === "" ? "--" : String(value);
      return;
    }

    if (typeof window.animateCounter === "function") {
      window.animateCounter(element, value, 1000, (currentValue, isComplete) =>
        formatValue(isComplete ? value : currentValue, key)
      );
      return;
    }

    element.textContent = formatValue(value, key);
  }

  function detectActivityTable(tables) {
    return tables.find((table) => ACTIVITY_KEY_PATTERN.test(table.path)) ||
      tables.find((table) => table.columns.some((column) => ACTIVITY_KEY_PATTERN.test(column)) && table.columns.some((column) => TIME_KEY_PATTERN.test(column)));
  }

  function createSortableTable(table) {
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";

    const htmlTable = document.createElement("table");
    htmlTable.className = "resource-table dashboard-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    table.columns.forEach((column) => {
      const th = document.createElement("th");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = labelize(column);
      button.addEventListener("click", () => sortTableBody(tbody, table.rows, table.columns, column, button));
      th.appendChild(button);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement("tbody");
    renderTableRows(tbody, table.rows, table.columns);
    htmlTable.append(thead, tbody);
    wrapper.appendChild(htmlTable);
    return wrapper;
  }

  function sortTableBody(tbody, rows, columns, column, button) {
    const currentDirection = button.dataset.direction === "asc" ? "desc" : "asc";
    button.closest("tr").querySelectorAll("button").forEach((sortButton) => {
      sortButton.dataset.direction = "";
      sortButton.removeAttribute("aria-sort");
    });
    button.dataset.direction = currentDirection;
    button.setAttribute("aria-sort", currentDirection === "asc" ? "ascending" : "descending");

    const sortedRows = [...rows].sort((a, b) => compareValues(a[column], b[column], currentDirection));
    renderTableRows(tbody, sortedRows, columns);
  }

  function renderTableRows(tbody, rows, columns) {
    tbody.replaceChildren();
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      columns.forEach((column) => {
        const td = document.createElement("td");
        td.textContent = formatCell(row[column], column);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function renderStatisticsInfo(data) {
    const target = document.getElementById("statistics-last-update");
    if (!target) return;

    const updated = data ? findFirstValue(data, /(last.*update|updated|updated_at|timestamp|generated_at|generated)/i) : null;
    target.textContent = updated ? formatDateTime(updated) : "Not available";
  }

  function createMessage(message) {
    const element = document.createElement("p");
    element.className = "dashboard-inline-message";
    element.textContent = message;
    return element;
  }

  function walk(value, callback, path = []) {
    callback(value, path);
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, callback, path.concat(String(index))));
    } else if (isPlainObject(value)) {
      Object.entries(value).forEach(([key, child]) => walk(child, callback, path.concat(key)));
    }
  }

  function collectColumns(rows) {
    const columns = [];
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!columns.includes(key)) columns.push(key);
      });
    });
    return columns;
  }

  function countRecords(data) {
    let count = 0;
    walk(data, (value) => {
      if (Array.isArray(value)) {
        count += value.filter(isPlainObject).length;
      }
    });
    return count || (isPlainObject(data) ? 1 : 0);
  }

  function findFirstValue(data, pattern) {
    let found = null;
    walk(data, (value, path) => {
      if (found !== null || !path.length) return;
      const key = path[path.length - 1];
      if (pattern.test(key) && !isPlainObject(value) && !Array.isArray(value)) {
        found = value;
      }
    });
    return found;
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function isDateLike(value) {
    if (value instanceof Date) return true;
    if (typeof value === "number") return value > 1900 && value < 3000;
    if (typeof value !== "string") return false;
    return !Number.isNaN(Date.parse(value)) || /^\d{4}([-/]\d{1,2})?$/.test(value);
  }

  function toNumber(value) {
    if (Number.isFinite(value)) return value;
    if (typeof value !== "string") return NaN;
    const normalized = value.replace(/[^\d.-]/g, "");
    return normalized ? Number(normalized) : NaN;
  }

  function compareValues(a, b, direction) {
    const numberA = toNumber(a);
    const numberB = toNumber(b);
    let result;

    if (Number.isFinite(numberA) && Number.isFinite(numberB)) {
      result = numberA - numberB;
    } else if (isDateLike(a) && isDateLike(b)) {
      result = new Date(a).getTime() - new Date(b).getTime();
    } else {
      result = String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
    }

    return direction === "asc" ? result : -result;
  }

  function formatValue(value, key) {
    const lowerKey = key.toLowerCase();
    if (/(storage|memory|disk|quota|terabyte|tb|gigabyte|gb)/.test(lowerKey)) return `${formatNumber(value)} TB`;
    if (/(funding|cost|charge|price|dkk|budget)/.test(lowerKey)) return `${formatNumber(value)} DKK`;
    if (/(percent|percentage|rate)/.test(lowerKey)) return `${formatNumber(value)}%`;
    return formatNumber(value);
  }

  function formatCell(value, key) {
    if (value === null || value === undefined || value === "") return "--";
    if (Array.isArray(value)) return value.map((item) => formatCell(item, key)).join(", ");
    if (isPlainObject(value)) return JSON.stringify(value);
    if (Number.isFinite(value)) return formatValue(value, key);
    if (isDateLike(value) && TIME_KEY_PATTERN.test(key)) return formatDateTime(value);
    return String(value);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatLabel(value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }
    return String(value);
  }

  function formatNumber(value) {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function labelize(value) {
    return String(value)
      .replace(/\./g, " ")
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function slugify(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "table";
  }

  function downloadCsv(table) {
    const csv = [
      table.columns.map(csvEscape).join(","),
      ...table.rows.map((row) => table.columns.map((column) => csvEscape(formatCell(row[column], column))).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(table.title)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
})();
