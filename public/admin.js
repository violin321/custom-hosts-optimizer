const $ = (id) => document.getElementById(id);
const date = (s) =>
  s ? new Date(s).toLocaleString("zh-CN", { hour12: false }) : "尚未成功";
const modes = { manual: "手动固定", dns: "自动解析", probe: "本地测速" };
let busy = false;
function notify(message, error = false) {
  $("message").textContent = message;
  $("message").className = error ? "error" : "";
}
async function api(path, method = "GET", body) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (response.status === 401) {
    location.assign("/admin/login");
    throw Error("请重新登录");
  }
  const data = await response.json();
  if (!response.ok) throw Error(data.error || `请求失败 (${response.status})`);
  return data;
}
function cell(row, text) {
  const td = document.createElement("td");
  td.textContent = text;
  row.append(td);
  return td;
}
function action(td, label, fn) {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", async () => {
    try {
      button.disabled = true;
      await fn();
      await load();
      await backups();
      notify("配置已保存。");
    } catch (e) {
      notify(e.message, true);
    } finally {
      button.disabled = false;
    }
  });
  td.append(button);
}
async function load() {
  try {
    const data = await api("/api/status");
    $("identity").textContent =
      `当前管理员：${data.user.username} · 最近成功检查：${date(data.lastSuccessAt)}`;
    $("version").textContent =
      `v${data.worker.version} · ${data.worker.commit.slice(0, 12)}`;
    const job = data.job;
    busy = job && ["running", "queued"].includes(job.status);
    $("refresh").disabled = busy;
    $("job").textContent = job
      ? `${{ queued: "等待开始", running: "进行中", success: "解析检查完成", partial: "部分成功，失败项保留旧值", failed: "检查失败，保留旧值" }[job.status]} · ${job.completed}/${job.total} · 成功 ${job.succeeded} / 失败 ${job.failed}`
      : "尚无刷新任务";
    $("progress").max = job?.total || 1;
    $("progress").value = job?.completed || 0;
    $("errors").textContent =
      job?.errors?.map((e) => `${e.domain}：${e.error}`).join("；") || "";
    $("publication").textContent = data.publicationError || "";
    $("domains").replaceChildren();
    for (const record of data.custom) {
      const row = document.createElement("tr");
      const title = cell(row, record.domain),
        meta = document.createElement("small");
      meta.textContent = `${record.isActive ? "启用" : "已停用"} · ${date(record.lastSuccessAt)}${record.lastError ? " · " + record.lastError : ""}`;
      title.append(meta);
      const ip = cell(row, record.ip || "等待解析");
      if (record.probe) {
        const info = document.createElement("small");
        info.textContent = `直连 HTTPS 中位数 ${record.probe.latencyMs.toFixed(0)} ms · ${date(record.probe.testedAt)}`;
        ip.append(info);
      }
      const dns = document.createElement("small");
      dns.textContent =
        record.resolutionMs !== undefined
          ? `DNS ${record.resolutionSource || "DoH"} · ${record.resolutionMs} ms · ${record.candidates.length} 个候选`
          : "";
      ip.append(dns);
      cell(row, modes[record.mode]);
      const actions = cell(row, "");
      action(actions, record.isActive ? "停用" : "启用", () =>
        api("/api/custom-domains", "POST", {
          domain: record.domain,
          isActive: !record.isActive,
        }),
      );
      action(actions, "编辑", async () => {
        const mode = prompt("更新模式：manual / dns / probe", record.mode);
        if (mode === null) return;
        const ip = mode === "manual" ? prompt("固定 IP", record.ip) : undefined;
        if (ip === null) return;
        await api("/api/custom-domains", "POST", {
          domain: record.domain,
          mode,
          ...(mode === "manual" ? { ip } : {}),
        });
      });
      action(actions, "删除", async () => {
        if (confirm(`删除 ${record.domain}？可从最近配置恢复。`))
          await api(
            "/api/custom-domains/" + encodeURIComponent(record.domain),
            "DELETE",
          );
      });
      $("domains").append(row);
    }
    $("github").replaceChildren();
    for (const record of data.github) {
      const row = document.createElement("tr");
      cell(
        row,
        `${record.domain} · ${record.lastError || "已验证"} · ${date(record.lastSuccessAt)}`,
      );
      cell(
        row,
        `${record.ip || "无可用记录"}${record.probe ? " · 家庭 HTTPS " + record.probe.latencyMs.toFixed(0) + " ms · " + date(record.probe.testedAt) : " · 尚未完成家庭测速"}`,
      );
      $("github").append(row);
    }
  } catch (e) {
    notify(e.message, true);
  }
}
$("refresh").addEventListener("click", async () => {
  try {
    await api("/api/optimize-all", "POST", {});
    notify("任务已启动，可在上方查看进度。");
    await load();
  } catch (e) {
    notify(e.message, true);
  }
});
$("add").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const form = new FormData(event.target),
      body = { domain: form.get("domain"), mode: form.get("mode") };
    if (form.get("ip")) body.ip = form.get("ip");
    await api("/api/custom-domains", "POST", body);
    event.target.reset();
    await load();
    await backups();
    notify("域名已保存，自动项会进入刷新任务。");
  } catch (e) {
    notify(e.message, true);
  }
});
$("batchAdd").addEventListener("click", async () => {
  try {
    const domains = $("batch")
      .value.split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/\s+/);
        return parts.length === 1
          ? { domain: parts[0], mode: "dns" }
          : { domain: parts[1], ip: parts[0], mode: "manual" };
      });
    await api("/api/custom-domains/batch", "POST", { domains });
    await load();
    await backups();
    notify("批量记录已保存。");
  } catch (e) {
    notify(e.message, true);
  }
});
$("import").addEventListener("change", async (event) => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 131072) throw Error("文件不能超过 128 KiB");
    const data = JSON.parse(await file.text()),
      domains = data.state?.custom || data.domains || data;
    if (!Array.isArray(domains)) throw Error("备份格式无效");
    if (!confirm("将替换当前自定义域名；当前配置会先备份。")) return;
    await api("/api/import", "POST", { domains });
    await load();
    await backups();
    notify("自定义域名已恢复。");
  } catch (e) {
    notify(e.message, true);
  } finally {
    event.target.value = "";
  }
});
async function backups() {
  const rows = await api("/api/backups");
  $("backup").replaceChildren();
  for (const row of rows) {
    const option = document.createElement("option");
    option.value = row.id;
    option.textContent = date(row.createdAt || row.id);
    $("backup").append(option);
  }
}
$("restore").addEventListener("click", async () => {
  try {
    const id = $("backup").value;
    if (!id) throw Error("尚无可恢复配置");
    if (!confirm("恢复此版本？当前配置会先备份。")) return;
    await api("/api/backups/restore", "POST", { id });
    await load();
    await backups();
    notify("已恢复所选配置。");
  } catch (e) {
    notify(e.message, true);
  }
});
load();
backups().catch((e) => notify(e.message, true));
setInterval(() => {
  if (!document.hidden) load();
}, 5000);
