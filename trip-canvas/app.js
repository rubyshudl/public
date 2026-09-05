(function () {
  "use strict";

  const STORAGE_KEY = "trip-canvas-ruby-v1";
  const typeLabels = { transport: "交通", stay: "住宿", activity: "玩乐", food: "餐饮", note: "备注" };
  const modeLabels = { driving: "驾车", transit: "公共交通", walking: "步行", bicycling: "骑行" };
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const monthLabels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  const defaultState = {
    version: 1,
    title: "美国东西海岸",
    subtitle: "纽约 · 洛杉矶 · 圣地亚哥",
    selectedDayId: "2026-09-26",
    days: [
      { id: "2026-09-26", date: "2026-09-26", city: "纽约", timezone: "America/New_York", summary: "晚间抵达 · 轻松入住", items: [
        { id: "ny-arrival", type: "transport", title: "抵达纽约，前往酒店", startTime: "", endTime: "", origin: "纽约抵达机场待确认", destination: "InterContinental New York Barclay", travelMode: "driving", notes: "补充航班号、准确抵达时间与机场。" },
        { id: "ny-hotel-1", type: "stay", title: "InterContinental New York Barclay", startTime: "21:00", endTime: "", location: "111 E 48th St, New York, NY 10017", notes: "IHG 钻石会员 · 积分房 · 连住 4 晚" }
      ]},
      { id: "2026-09-27", date: "2026-09-27", city: "纽约", timezone: "America/New_York", summary: "整日游览 · 玩乐待安排", items: [] },
      { id: "2026-09-28", date: "2026-09-28", city: "纽约", timezone: "America/New_York", summary: "整日游览 · 玩乐待安排", items: [] },
      { id: "2026-09-29", date: "2026-09-29", city: "纽约", timezone: "America/New_York", summary: "整日游览 · 玩乐待安排", items: [] },
      { id: "2026-09-30", date: "2026-09-30", city: "纽约 → 洛杉矶", timezone: "America/Los_Angeles", summary: "跨州飞行 · 抵达后取车", items: [
        { id: "ny-la-flight", type: "transport", title: "纽约飞往洛杉矶", startTime: "", endTime: "", origin: "纽约出发机场待确认", destination: "Los Angeles International Airport (LAX)", travelMode: "transit", notes: "建议上午直飞；航班号和准确时间待补充。" },
        { id: "la-hotel-1", type: "stay", title: "SLS Hotel, a Luxury Collection Hotel", startTime: "16:00", endTime: "", location: "465 S La Cienega Blvd, Los Angeles, CA 90048", notes: "万豪钛金会员 · 积分房 · 连住 3 晚" }
      ]},
      { id: "2026-10-01", date: "2026-10-01", city: "洛杉矶", timezone: "America/Los_Angeles", summary: "自驾游览 · 玩乐待安排", items: [] },
      { id: "2026-10-02", date: "2026-10-02", city: "洛杉矶", timezone: "America/Los_Angeles", summary: "自驾游览 · 玩乐待安排", items: [] },
      { id: "2026-10-03", date: "2026-10-03", city: "洛杉矶 → 圣地亚哥", timezone: "America/Los_Angeles", summary: "沿海自驾 · 约 2.5–3.5 小时", items: [
        { id: "la-sd-drive", type: "transport", title: "自驾前往圣地亚哥", startTime: "09:00", endTime: "12:30", origin: "SLS Hotel, Beverly Hills", destination: "InterContinental San Diego", travelMode: "driving", notes: "实际耗时视周六路况调整。" },
        { id: "sd-hotel", type: "stay", title: "InterContinental San Diego", startTime: "15:00", endTime: "", location: "901 Bayfront Ct, San Diego, CA 92101", notes: "IHG 钻石会员 · 积分房 · 住 1 晚" }
      ]},
      { id: "2026-10-04", date: "2026-10-04", city: "圣地亚哥 → 洛杉矶", timezone: "America/Los_Angeles", summary: "返回 LAX · 晚间回国", items: [
        { id: "sd-lax-drive", type: "transport", title: "自驾返回 LAX", startTime: "11:00", endTime: "16:30", origin: "InterContinental San Diego", destination: "Los Angeles International Airport (LAX)", travelMode: "driving", notes: "预留堵车、还车和机场接驳时间。" },
        { id: "home-flight", type: "transport", title: "洛杉矶飞往中国", startTime: "", endTime: "", origin: "Los Angeles International Airport (LAX)", destination: "中国目的地待确认", travelMode: "transit", notes: "计划乘坐 21:00 后航班；航班号与准确时间待补充。" }
      ]}
    ]
  };

  let state = loadState();
  let activeFilter = "all";
  let toastTimer;
  let saveTimer;
  let pendingAiProposal = null;

  const $ = (id) => document.getElementById(id);
  const dayNav = $("dayNav");
  const timeline = $("timeline");
  const itemDialog = $("itemDialog");
  const dayDialog = $("dayDialog");
  const tripDialog = $("tripDialog");

  function cloneDefault() { return JSON.parse(JSON.stringify(defaultState)); }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return cloneDefault();
      const parsed = JSON.parse(stored);
      if (!parsed || !Array.isArray(parsed.days)) throw new Error("Invalid data");
      parsed.days.forEach((day) => { if (!day.timezone) day.timezone = /纽约/.test(day.city) && !/洛杉矶/.test(day.city) ? "America/New_York" : "America/Los_Angeles"; });
      return parsed;
    } catch (error) {
      console.warn("行程数据读取失败，已使用初始版本。", error);
      return cloneDefault();
    }
  }

  function persist(message) {
    const saveStatus = $("saveStatus");
    saveStatus.classList.add("saving");
    saveStatus.innerHTML = "<i></i>正在保存……";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveStatus.classList.remove("saving");
      saveStatus.innerHTML = "<i></i>已保存到本机";
      if (message) showToast(message);
    }, 160);
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function hasChinese(value = "") { return /[\u3400-\u9fff]/.test(value); }

  function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function getDateParts(dateString) {
    const date = parseLocalDate(dateString);
    return { date, day: String(date.getDate()).padStart(2, "0"), month: monthLabels[date.getMonth()], weekday: weekdays[date.getDay()] };
  }

  function getSelectedDay() {
    return state.days.find((day) => day.id === state.selectedDayId) || state.days[0];
  }

  function formatRange() {
    if (!state.days.length) return "暂无日期";
    const sorted = [...state.days].sort((a, b) => a.date.localeCompare(b.date));
    const start = sorted[0].date.replaceAll("-", ".");
    const end = sorted[sorted.length - 1].date.replaceAll("-", ".");
    return `${start} — ${end} · ${state.days.length} 天`;
  }

  function sortItems(items) {
    return [...items].sort((a, b) => {
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return a.startTime.localeCompare(b.startTime);
    });
  }

  function formatTime(item) {
    if (item.startTime && item.endTime) return `${item.startTime}<br>${item.endTime}`;
    if (item.startTime) return item.startTime;
    if (item.endTime) return `— ${item.endTime}`;
    return "待定";
  }

  function getMapUrl(item) {
    if (item.type === "transport" && item.origin && item.destination) {
      const query = new URLSearchParams({ api: "1", origin: item.origin, destination: item.destination, travelmode: item.travelMode || "driving" });
      return `https://www.google.com/maps/dir/?${query.toString()}`;
    }
    if (item.location) {
      const query = new URLSearchParams({ api: "1", query: item.location });
      return `https://www.google.com/maps/search/?${query.toString()}`;
    }
    return "";
  }

  function navigationButton(url, label) {
    if (!url) return "";
    return `<a class="map-button" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>${escapeHtml(label)}</a>`;
  }

  function itemMarkup(item) {
    const location = item.type === "transport"
      ? (item.origin || item.destination ? `<div class="card-route"><div class="route-points"><span class="route-point">${escapeHtml(item.origin || "出发地待补充")}</span><span class="route-point">${escapeHtml(item.destination || "目的地待补充")}</span></div></div>` : "")
      : (item.location ? `<p class="card-location"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><span>${escapeHtml(item.location)}</span></p>` : "");
    const mapUrl = getMapUrl(item);
    const mapLabel = item.type === "transport" ? `${modeLabels[item.travelMode] || "打开"}导航` : "在 Google Maps 查看";
    const typeExtra = item.type === "transport" && item.travelMode ? ` · ${modeLabels[item.travelMode] || ""}` : "";
    return `
      <article class="timeline-item" data-item-id="${escapeHtml(item.id)}">
        <time class="timeline-time">${formatTime(item)}</time>
        <i class="timeline-marker ${item.type}"></i>
        <div class="plan-card">
          <div class="card-head">
            <div>
              <span class="card-type"><i class="dot ${item.type}"></i>${typeLabels[item.type]}${typeExtra}</span>
              <h2 class="card-title ${hasChinese(item.title) ? "" : "is-latin"}">${escapeHtml(item.title)}</h2>
            </div>
            <div class="card-menu">
              <button class="card-action-icon" type="button" data-action="duplicate" data-item="${escapeHtml(item.id)}" aria-label="复制安排" title="复制安排"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button>
              <button class="card-action-icon" type="button" data-action="edit" data-item="${escapeHtml(item.id)}" aria-label="编辑安排" title="编辑安排"><svg viewBox="0 0 24 24"><path d="m14.5 5.5 4 4M4 20l3.6-.7L19 7.9a1.4 1.4 0 0 0 0-2l-.9-.9a1.4 1.4 0 0 0-2 0L4.7 16.4 4 20Z"/></svg></button>
            </div>
          </div>
          ${location}
          ${item.notes ? `<p class="card-notes">${escapeHtml(item.notes)}</p>` : ""}
          ${mapUrl ? `<div class="card-footer">${navigationButton(mapUrl, mapLabel)}</div>` : ""}
        </div>
      </article>`;
  }

  function renderSidebar() {
    $("tripTitle").textContent = state.title;
    $("tripDateRange").textContent = formatRange();
    dayNav.innerHTML = state.days.map((day) => {
      const parts = getDateParts(day.date);
      return `<button class="day-nav-button ${day.id === state.selectedDayId ? "active" : ""}" type="button" data-day="${escapeHtml(day.id)}"><span class="day-nav-date"><strong>${parts.day}</strong><small class="latin">${parts.month}</small></span><span class="day-nav-city"><strong>${escapeHtml(day.city)}</strong><span>${day.items.length ? `${day.items.length} 项安排` : "待规划"}</span></span></button>`;
    }).join("");
  }

  function renderDay() {
    const day = getSelectedDay();
    if (!day) return;
    const parts = getDateParts(day.date);
    $("dayKicker").textContent = `${day.date.replaceAll("-", ".")} · ${parts.weekday}`;
    $("dayTitle").textContent = day.city;
    $("daySubtitle").textContent = day.summary || state.subtitle || "行程待规划";
    const allItems = sortItems(day.items);
    const items = activeFilter === "all" ? allItems : allItems.filter((item) => item.type === activeFilter);
    $("dayRouteButton").disabled = getDayRoutePlaces(day).length < 2;
    $("dayRouteButton").title = getDayRoutePlaces(day).length < 2 ? "至少需要两个地点才能生成路线" : "在 Google Maps 打开当天路线";

    if (!allItems.length) {
      timeline.innerHTML = `<div class="empty-day"><div><div class="empty-day-visual"><i class="road"></i><i class="pin"></i></div><h2>这一天还是一张白纸</h2><p>先添加一个想去的地方、餐厅或交通安排。地点保存后，就能直接打开 Google Maps 导航。</p><button class="primary-button" type="button" data-action="add-empty">＋ 添加第一项安排</button></div></div>`;
    } else if (!items.length) {
      timeline.innerHTML = `<p class="empty-filter">当天没有“${typeLabels[activeFilter]}”项目。</p>`;
    } else {
      timeline.innerHTML = items.map(itemMarkup).join("");
    }
  }

  function render() { renderSidebar(); renderDay(); }

  function selectDay(dayId) {
    if (!state.days.some((day) => day.id === dayId)) return;
    state.selectedDayId = dayId;
    activeFilter = "all";
    updateFilterButtons();
    persist();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateFilterButtons() {
    document.querySelectorAll(".filter-chip").forEach((button) => {
      const active = button.dataset.filter === activeFilter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function selectedItem(itemId) { return getSelectedDay()?.items.find((item) => item.id === itemId); }

  function makeId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }

  function setRouteFields(type) {
    const isRoute = type === "transport";
    $("singleLocationFields").hidden = isRoute;
    $("routeFields").hidden = !isRoute;
  }

  function openItemDialog(itemId = "", preferredType = "activity") {
    const item = itemId ? selectedItem(itemId) : null;
    $("itemId").value = itemId;
    $("itemDialogOverline").textContent = item ? "EDIT PLAN" : "NEW PLAN";
    $("itemDialogTitle").textContent = item ? "编辑安排" : "添加安排";
    const type = item?.type || preferredType;
    document.querySelector(`input[name="itemType"][value="${type}"]`).checked = true;
    $("itemTitle").value = item?.title || "";
    $("startTime").value = item?.startTime || "";
    $("endTime").value = item?.endTime || "";
    $("location").value = item?.location || "";
    $("origin").value = item?.origin || "";
    $("destination").value = item?.destination || "";
    $("travelMode").value = item?.travelMode || "driving";
    $("notes").value = item?.notes || "";
    $("deleteItemButton").hidden = !item;
    setRouteFields(type);
    itemDialog.showModal();
    setTimeout(() => $("itemTitle").focus(), 0);
  }

  function closeDialog(id) {
    const dialog = $(id);
    if (dialog?.open) dialog.close();
  }

  function saveItem(event) {
    event.preventDefault();
    const day = getSelectedDay();
    if (!day) return;
    const itemId = $("itemId").value;
    const type = document.querySelector('input[name="itemType"]:checked').value;
    const item = {
      id: itemId || makeId("item"), type, title: $("itemTitle").value.trim(),
      startTime: $("startTime").value, endTime: $("endTime").value,
      location: type === "transport" ? "" : $("location").value.trim(),
      origin: type === "transport" ? $("origin").value.trim() : "",
      destination: type === "transport" ? $("destination").value.trim() : "",
      travelMode: type === "transport" ? $("travelMode").value : "",
      notes: $("notes").value.trim()
    };
    if (itemId) {
      const index = day.items.findIndex((entry) => entry.id === itemId);
      if (index >= 0) day.items[index] = item;
    } else { day.items.push(item); }
    persist(itemId ? "安排已更新" : "安排已添加");
    itemDialog.close();
    render();
  }

  function deleteItem() {
    const itemId = $("itemId").value;
    const day = getSelectedDay();
    if (!day || !itemId) return;
    if (!window.confirm("确定删除这项安排吗？")) return;
    day.items = day.items.filter((item) => item.id !== itemId);
    itemDialog.close();
    persist("安排已删除");
    render();
  }

  function duplicateItem(itemId) {
    const day = getSelectedDay();
    const item = selectedItem(itemId);
    if (!day || !item) return;
    day.items.push({ ...JSON.parse(JSON.stringify(item)), id: makeId("item"), title: `${item.title}（副本）` });
    persist("已复制安排");
    render();
  }

  function openDayDialog(isNew = false) {
    const day = isNew ? null : getSelectedDay();
    const latest = [...state.days].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    const suggestedDate = latest ? addOneDay(latest.date) : new Date().toISOString().slice(0, 10);
    $("dayId").value = day?.id || "";
    $("dayDialogTitle").textContent = day ? "编辑当天信息" : "添加一天";
    $("dayDate").value = day?.date || suggestedDate;
    $("dayCity").value = day?.city || "";
    $("dayTimezone").value = day?.timezone || latest?.timezone || "America/Los_Angeles";
    $("daySummary").value = day?.summary || "";
    $("deleteDayButton").hidden = !day || state.days.length === 1;
    dayDialog.showModal();
  }

  function addOneDay(dateString) {
    const date = parseLocalDate(dateString);
    date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function saveDay(event) {
    event.preventDefault();
    const currentId = $("dayId").value;
    const date = $("dayDate").value;
    const existing = state.days.find((day) => day.date === date && day.id !== currentId);
    if (existing) { showToast("这个日期已经存在，请选择其他日期。"); return; }
    if (currentId) {
      const day = state.days.find((entry) => entry.id === currentId);
      if (day) { day.date = date; day.city = $("dayCity").value.trim(); day.timezone = $("dayTimezone").value; day.summary = $("daySummary").value.trim(); }
    } else {
      const id = `day-${date}-${Math.random().toString(36).slice(2, 6)}`;
      state.days.push({ id, date, city: $("dayCity").value.trim(), timezone: $("dayTimezone").value, summary: $("daySummary").value.trim(), items: [] });
      state.selectedDayId = id;
    }
    state.days.sort((a, b) => a.date.localeCompare(b.date));
    dayDialog.close();
    persist("日期信息已保存");
    render();
  }

  function deleteDay() {
    const id = $("dayId").value;
    const day = state.days.find((entry) => entry.id === id);
    if (!day || state.days.length === 1) return;
    if (!window.confirm(`确定删除 ${day.date} 及当天的全部安排吗？`)) return;
    state.days = state.days.filter((entry) => entry.id !== id);
    state.selectedDayId = state.days[0].id;
    dayDialog.close();
    persist("当天行程已删除");
    render();
  }

  function openTripDialog() {
    $("tripNameInput").value = state.title;
    $("tripSubtitleInput").value = state.subtitle || "";
    tripDialog.showModal();
  }

  function saveTrip(event) {
    event.preventDefault();
    state.title = $("tripNameInput").value.trim();
    state.subtitle = $("tripSubtitleInput").value.trim();
    tripDialog.close();
    persist("旅行信息已更新");
    render();
  }

  function getDayRoutePlaces(day) {
    const places = [];
    sortItems(day.items).forEach((item) => {
      if (item.type === "transport") {
        if (item.origin) places.push(item.origin);
        if (item.destination) places.push(item.destination);
      } else if (item.location) places.push(item.location);
    });
    return places.filter((place, index) => place && place !== places[index - 1]);
  }

  function openDayRoute() {
    const places = getDayRoutePlaces(getSelectedDay());
    if (places.length < 2) { showToast("至少添加两个地点，才能生成当天路线。"); return; }
    const params = new URLSearchParams({ api: "1", origin: places[0], destination: places[places.length - 1], travelmode: "driving" });
    if (places.length > 2) params.set("waypoints", places.slice(1, -1).join("|"));
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  function backupState() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, `trip-canvas-${new Date().toISOString().slice(0, 10)}.json`);
    showToast("旅行备份已下载");
  }

  async function restoreState(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.days) || !parsed.days.length) throw new Error("Invalid backup");
      if (!window.confirm("导入会覆盖当前浏览器中的旅行计划，是否继续？")) return;
      state = parsed;
      state.selectedDayId = state.days.some((day) => day.id === state.selectedDayId) ? state.selectedDayId : state.days[0].id;
      persist("旅行备份已导入");
      render();
    } catch (error) {
      console.error(error);
      showToast("无法导入：请选择由本网页导出的 JSON 备份。");
    } finally { $("restoreInput").value = ""; }
  }

  function icsEscape(value = "") { return String(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function compactDate(date) { return date.replaceAll("-", ""); }
  function addDaysIcs(dateString) { return compactDate(addOneDay(dateString)); }
  function toDateTime(date, time) { return `${compactDate(date)}T${time.replace(":", "")}00`; }

  function eventIcs(day, item) {
    const lines = ["BEGIN:VEVENT", `UID:${item.id}-${compactDate(day.date)}@trip-canvas`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`];
    if (item.startTime || item.endTime) {
      const start = item.startTime || "08:00";
      const end = item.endTime || `${String(Math.min(Number(start.slice(0,2)) + 1, 23)).padStart(2, "0")}:${start.slice(3)}`;
      lines.push(`DTSTART;TZID=${day.timezone || "America/Los_Angeles"}:${toDateTime(day.date, start)}`, `DTEND;TZID=${day.timezone || "America/Los_Angeles"}:${toDateTime(day.date, end)}`);
    } else { lines.push(`DTSTART;VALUE=DATE:${compactDate(day.date)}`, `DTEND;VALUE=DATE:${addDaysIcs(day.date)}`); }
    const location = item.type === "transport" ? [item.origin, item.destination].filter(Boolean).join(" → ") : item.location;
    const mapUrl = getMapUrl(item);
    lines.push(`SUMMARY:${icsEscape(item.title)}`, `LOCATION:${icsEscape(location || day.city)}`, `DESCRIPTION:${icsEscape([item.notes, mapUrl].filter(Boolean).join("\n"))}`, "END:VEVENT");
    return lines.join("\r\n");
  }

  function exportCalendar() {
    const events = [];
    state.days.forEach((day) => {
      events.push(["BEGIN:VEVENT", `UID:day-${day.id}@trip-canvas`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`, `DTSTART;VALUE=DATE:${compactDate(day.date)}`, `DTEND;VALUE=DATE:${addDaysIcs(day.date)}`, `SUMMARY:${icsEscape(`${state.title} · ${day.city}`)}`, "TRANSP:TRANSPARENT", "END:VEVENT"].join("\r\n"));
      day.items.forEach((item) => events.push(eventIcs(day, item)));
    });
    const data = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Trip Canvas//Journey Planner//ZH-CN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape(state.title)}`, ...events, "END:VCALENDAR", ""].join("\r\n");
    downloadBlob(new Blob([data], { type: "text/calendar;charset=utf-8" }), `${state.title}-旅行日历.ics`);
    showToast("日历文件已生成，可用 Apple Calendar 打开");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function getAiSettings() {
    return { endpoint: localStorage.getItem("trip-canvas-ai-endpoint") || "", accessCode: sessionStorage.getItem("trip-canvas-ai-access") || "" };
  }

  function setAiConnectionStatus() {
    const settings = getAiSettings();
    $("aiConnectionStatus").textContent = settings.endpoint && settings.accessCode ? "已连接 · 修改前需确认" : "安全连接未配置";
  }

  function openAiPanel() {
    $("aiBackdrop").hidden = false;
    $("aiPanel").classList.add("open");
    $("aiPanel").setAttribute("aria-hidden", "false");
    setAiConnectionStatus();
    if (!getAiSettings().endpoint) openAiSetup();
    setTimeout(() => $("aiInput").focus(), 220);
  }

  function closeAiPanel() {
    $("aiPanel").classList.remove("open");
    $("aiPanel").setAttribute("aria-hidden", "true");
    $("aiBackdrop").hidden = true;
    $("aiSetup").hidden = true;
  }

  function openAiSetup() {
    const settings = getAiSettings();
    $("aiEndpointInput").value = settings.endpoint;
    $("aiAccessCodeInput").value = settings.accessCode;
    $("aiSetup").hidden = false;
  }

  function saveAiSetup() {
    const endpoint = $("aiEndpointInput").value.trim().replace(/\/$/, "");
    const accessCode = $("aiAccessCodeInput").value;
    if (!/^https:\/\//.test(endpoint)) { showToast("AI服务地址必须使用 https://"); return; }
    if (!accessCode) { showToast("请填写私人访问码"); return; }
    localStorage.setItem("trip-canvas-ai-endpoint", endpoint);
    sessionStorage.setItem("trip-canvas-ai-access", accessCode);
    $("aiSetup").hidden = true;
    setAiConnectionStatus();
    showToast("AI连接信息已保存");
  }

  function addAiMessage(role, text, extraHtml = "") {
    const wrapper = document.createElement("div");
    wrapper.className = `ai-message ${role}`;
    wrapper.innerHTML = `<div class="message-bubble">${escapeHtml(text)}${extraHtml}</div>`;
    $("aiMessages").appendChild(wrapper);
    $("aiMessages").scrollTop = $("aiMessages").scrollHeight;
    return wrapper;
  }

  function addAiLoading() {
    const wrapper = document.createElement("div");
    wrapper.className = "ai-message assistant";
    wrapper.innerHTML = '<div class="message-bubble loading"><i></i><i></i><i></i></div>';
    $("aiMessages").appendChild(wrapper);
    $("aiMessages").scrollTop = $("aiMessages").scrollHeight;
    return wrapper;
  }

  function validAiState(candidate) {
    return candidate && typeof candidate.title === "string" && Array.isArray(candidate.days) && candidate.days.length > 0 && candidate.days.every((day) => day && typeof day.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day.date) && typeof day.city === "string" && Array.isArray(day.items) && day.items.every((item) => item && typeof item.id === "string" && Object.hasOwn(typeLabels, item.type) && typeof item.title === "string"));
  }

  function summarizeProposal(before, after) {
    const beforeItems = before.days.reduce((sum, day) => sum + day.items.length, 0);
    const afterItems = after.days.reduce((sum, day) => sum + day.items.length, 0);
    const parts = [];
    if (after.days.length !== before.days.length) parts.push(`旅行天数 ${before.days.length} → ${after.days.length}`);
    if (afterItems !== beforeItems) parts.push(`安排数量 ${beforeItems} → ${afterItems}`);
    if (after.title !== before.title) parts.push(`旅行名称改为“${after.title}”`);
    return parts.length ? parts.join("；") : "调整了行程内容、时间、地点或顺序";
  }

  function proposalMarkup(summary) {
    return `<div class="ai-proposal"><strong>待确认的行程修改</strong><p>${escapeHtml(summary)}</p><div class="ai-proposal-actions"><button class="apply-ai-button" type="button">应用修改</button><button class="reject-ai-button" type="button">暂不修改</button></div></div>`;
  }

  async function sendAiMessage(event) {
    event.preventDefault();
    const message = $("aiInput").value.trim();
    if (!message) return;
    const settings = getAiSettings();
    if (!settings.endpoint || !settings.accessCode) { openAiSetup(); showToast("请先连接私人AI服务"); return; }
    addAiMessage("user", message);
    $("aiInput").value = "";
    $("aiSendButton").disabled = true;
    const loading = addAiLoading();
    try {
      const response = await fetch(settings.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Trip-Access": settings.accessCode },
        body: JSON.stringify({ message, selectedDayId: state.selectedDayId, trip: state })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `AI服务返回 ${response.status}`);
      loading.remove();
      if (payload.proposal && validAiState(payload.proposal) && JSON.stringify(payload.proposal) !== JSON.stringify(state)) {
        pendingAiProposal = payload.proposal;
        addAiMessage("assistant", payload.reply || "已整理好修改建议。", proposalMarkup(summarizeProposal(state, payload.proposal)));
      } else {
        pendingAiProposal = null;
        addAiMessage("assistant", payload.reply || "这次没有需要写入行程的修改。");
      }
    } catch (error) {
      loading.remove();
      addAiMessage("assistant", `暂时无法完成：${error.message}`);
    } finally { $("aiSendButton").disabled = false; $("aiInput").focus(); }
  }

  function applyAiProposal() {
    if (!validAiState(pendingAiProposal)) return;
    const previousSelected = state.selectedDayId;
    state = pendingAiProposal;
    state.selectedDayId = state.days.some((day) => day.id === previousSelected) ? previousSelected : state.days[0].id;
    pendingAiProposal = null;
    persist("AI建议已应用到行程");
    render();
    addAiMessage("assistant", "修改已应用。需要撤销时，可导入此前的JSON备份。");
    document.querySelectorAll(".ai-proposal-actions").forEach((element) => element.remove());
  }

  function rejectAiProposal() {
    pendingAiProposal = null;
    document.querySelectorAll(".ai-proposal-actions").forEach((element) => element.remove());
    addAiMessage("assistant", "已保留当前行程，没有写入修改。");
  }

  dayNav.addEventListener("click", (event) => { const button = event.target.closest("[data-day]"); if (button) selectDay(button.dataset.day); });
  $("quickFilters").addEventListener("click", (event) => { const button = event.target.closest("[data-filter]"); if (!button) return; activeFilter = button.dataset.filter; updateFilterButtons(); renderDay(); });
  timeline.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]"); if (!button) return;
    if (button.dataset.action === "edit") openItemDialog(button.dataset.item);
    if (button.dataset.action === "duplicate") duplicateItem(button.dataset.item);
    if (button.dataset.action === "add-empty") openItemDialog();
  });
  document.querySelectorAll('input[name="itemType"]').forEach((input) => input.addEventListener("change", () => setRouteFields(input.value)));
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => closeDialog(button.dataset.close)));
  [itemDialog, dayDialog, tripDialog].forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }));
  $("itemForm").addEventListener("submit", saveItem);
  $("dayForm").addEventListener("submit", saveDay);
  $("tripForm").addEventListener("submit", saveTrip);
  $("deleteItemButton").addEventListener("click", deleteItem);
  $("deleteDayButton").addEventListener("click", deleteDay);
  $("addItemButton").addEventListener("click", () => openItemDialog());
  $("addDayButton").addEventListener("click", () => openDayDialog(true));
  $("editDayButton").addEventListener("click", () => openDayDialog(false));
  $("editTripButton").addEventListener("click", openTripDialog);
  $("dayRouteButton").addEventListener("click", openDayRoute);
  $("backupButton").addEventListener("click", backupState);
  $("restoreButton").addEventListener("click", () => $("restoreInput").click());
  $("restoreInput").addEventListener("change", (event) => { if (event.target.files[0]) restoreState(event.target.files[0]); });
  $("calendarButton").addEventListener("click", exportCalendar);
  $("aiButton").addEventListener("click", openAiPanel);
  $("closeAiButton").addEventListener("click", closeAiPanel);
  $("aiBackdrop").addEventListener("click", closeAiPanel);
  $("aiSettingsButton").addEventListener("click", openAiSetup);
  $("cancelAiSetup").addEventListener("click", () => { $("aiSetup").hidden = true; });
  $("saveAiSetup").addEventListener("click", saveAiSetup);
  $("aiForm").addEventListener("submit", sendAiMessage);
  $("aiSuggestions").addEventListener("click", (event) => { const button = event.target.closest("button"); if (!button) return; $("aiInput").value = button.textContent; $("aiInput").focus(); });
  $("aiMessages").addEventListener("click", (event) => { if (event.target.closest(".apply-ai-button")) applyAiProposal(); if (event.target.closest(".reject-ai-button")) rejectAiProposal(); });

  render();
  setAiConnectionStatus();
})();
