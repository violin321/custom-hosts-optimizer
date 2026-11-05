const text = document.querySelector("#hosts"),
  message = document.querySelector("#message");
let etag = "",
  content = "";
const date = (value) =>
  value
    ? new Date(value).toLocaleString("zh-CN", { hour12: false })
    : "尚未完成";
async function load() {
  try {
    message.textContent = "正在检查更新…";
    const [meta, hosts] = await Promise.all([
      fetch("/hosts.json", { cache: "no-cache" }),
      fetch("/hosts", {
        headers: etag ? { "If-None-Match": etag } : {},
        cache: "no-cache",
      }),
    ]);
    if (!meta.ok || (!hosts.ok && hosts.status !== 304))
      throw Error("暂时无法读取快照，请稍后重试；本地已下载的文件不受影响");
    const data = await meta.json();
    if (hosts.status !== 304) {
      content = await hosts.text();
      text.textContent = content;
      etag = hosts.headers.get("ETag") || "";
    }
    document.querySelector("#count").textContent = data.total;
    document.querySelector("#changed").textContent = date(data.changedAt);
    document.querySelector("#checked").textContent = date(data.lastSuccessAt);
    message.textContent =
      hosts.status === 304
        ? "内容未变化，继续使用当前版本。"
        : "已读取最新可用快照。";
    message.className = "";
  } catch (e) {
    message.textContent = e.message;
    message.className = "error";
  }
}
document.querySelector("#reload").addEventListener("click", load);
document.querySelector("#copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(content);
    message.textContent = "已复制 hosts 内容。";
  } catch {
    message.textContent = "复制失败，请手动选择内容。";
  }
});
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab) {
  for (const item of tabs) {
    const selected = item === tab;
    item.classList.toggle("active", selected);
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute("aria-controls")).hidden =
      !selected;
  }
}
for (const tab of tabs) {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (event) => {
    const index = tabs.indexOf(tab);
    const next = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectTab(tabs[next]);
    tabs[next].focus();
  });
}
for (const link of document.querySelectorAll("[data-subscription]")) {
  link.textContent = new URL(link.dataset.subscription, location.origin).href;
}
load();
