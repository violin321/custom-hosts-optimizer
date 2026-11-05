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
load();
