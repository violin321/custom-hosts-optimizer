import type { Bindings, DomainRecord, StoreState } from "./types";
import { GITHUB_URLS } from "./constants";
import {
  domainName,
  ipAddress,
  errorText,
  InputError,
} from "./core/validation";
import { resolveCandidates } from "./core/dns";
import { importLegacy, snapshotFor, now } from "./core/snapshot";
export class HostsCoordinator {
  private state!: StoreState;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private ctx: DurableObjectState,
    private env: Bindings,
  ) {
    ctx.blockConcurrencyWhile(async () => {
      this.state =
        (await ctx.storage.get<StoreState>("state")) ||
        (await importLegacy(env.custom_hosts));
      if (!this.state.snapshot) await this.commit(structuredClone(this.state));
      if (
        this.state.job &&
        ["queued", "running"].includes(this.state.job.status)
      )
        await ctx.storage.setAlarm(Date.now() + 1000);
    });
  }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.catch(() => {});
    return result;
  }
  private async commit(next: StoreState, backup = false) {
    if (backup) {
      const backups =
        (await this.ctx.storage.get<{ id: string; createdAt: string }[]>(
          "backup-index",
        )) || [];
      const createdAt = now(),
        id = createdAt + "_" + crypto.randomUUID();
      await this.ctx.storage.put("backup:" + id, this.state);
      backups.unshift({ id, createdAt });
      await this.ctx.storage.put("backup-index", backups.slice(0, 10));
      for (const removed of backups.slice(10))
        await this.ctx.storage.delete("backup:" + removed.id);
    }
    next.snapshot = (await snapshotFor(next)) || this.state?.snapshot;
    await this.ctx.storage.put("state", next);
    this.state = next;
    try {
      if (next.snapshot)
        await this.env.custom_hosts.put(
          "published_snapshot",
          JSON.stringify(next.snapshot),
        );
      if (next.publicationError) {
        delete next.publicationError;
        await this.ctx.storage.put("state", next);
      }
    } catch (e) {
      next.publicationError = errorText(e);
      await this.ctx.storage.put("state", next);
      await this.ctx.storage.setAlarm(Date.now() + 30000);
      throw new Error("数据已保存，公开快照发布失败；已安排重试");
    }
  }
  private view() {
    const { job, ...state } = this.state;
    return {
      ...state,
      coordinatorCommit: this.env.COMMIT_HASH || "local",
      job: job ? { ...job, pending: undefined, results: undefined } : undefined,
    };
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url),
      path = url.pathname;
    if (path === "/state") return Response.json(this.view());
    if (path === "/snapshot") return Response.json(this.state.snapshot || null);
    if (path === "/manifest") {
      const effective = new Map(
        [...this.state.github, ...this.state.custom].map((r) => [r.domain, r]),
      );
      const records = [...effective.values()].filter(
        (r) => r.isActive && r.mode === "probe" && r.candidates.length,
      );
      return Response.json({
        generatedAt: now(),
        records: records.map((r) => ({
          domain: r.domain,
          candidates: r.candidates,
          lastAttemptAt: r.lastAttemptAt,
        })),
      });
    }
    return this.serial(async () => {
      try {
        const body =
          request.method === "GET" ? {} : ((await request.json()) as any);
        if (path === "/login-limit") {
          const limits =
            (await this.ctx.storage.get<
              Record<string, { start: number; count: number }>
            >("login-limits")) || {};
          for (const [k, v] of Object.entries(limits))
            if (Date.now() - v.start >= 900000) delete limits[k];
          const key = String(body.key),
            record = limits[key];
          const current =
            record && Date.now() - record.start < 900000
              ? record
              : { start: Date.now(), count: 0 };
          if (body.clear) {
            delete limits[key];
            await this.ctx.storage.put("login-limits", limits);
            return Response.json({ allowed: true });
          }
          if (!record && Object.keys(limits).length >= 5000)
            return Response.json({ allowed: false, retryAfter: 900 });
          current.count++;
          limits[key] = current;
          await this.ctx.storage.put("login-limits", limits);
          return Response.json({
            allowed: current.count <= 10,
            retryAfter: Math.max(
              1,
              Math.ceil((current.start + 900000 - Date.now()) / 1000),
            ),
          });
        }
        if (path === "/refresh") {
          if (
            this.state.job &&
            ["queued", "running"].includes(this.state.job.status)
          )
            return Response.json({ job: this.view().job }, { status: 202 });
          const next = structuredClone(this.state),
            custom = next.custom
              .filter((r) => r.isActive && r.mode !== "manual")
              .map((r) => r.domain);
          const pending = [...new Set([...GITHUB_URLS, ...custom])];
          next.lastAttemptAt = now();
          next.job = {
            id: crypto.randomUUID(),
            status: "queued",
            startedAt: now(),
            total: pending.length,
            completed: 0,
            succeeded: 0,
            failed: 0,
            errors: [],
            pending,
            results: {},
          };
          await this.ctx.storage.setAlarm(Date.now() + 100);
          await this.ctx.storage.put("state", next);
          this.state = next;
          return Response.json({ job: this.view().job }, { status: 202 });
        }
        if (path === "/upsert") {
          const next = structuredClone(this.state),
            incoming = Array.isArray(body.domains) ? body.domains : [body];
          if (incoming.length > 100)
            throw new InputError("每批最多 100 条域名");
          for (const item of incoming) {
            const domain = domainName(item.domain),
              old = next.custom.find((r) => r.domain === domain);
            const mode = item.mode ?? old?.mode ?? (item.ip ? "manual" : "dns");
            if (!["manual", "dns", "probe"].includes(mode))
              throw new InputError("更新模式无效");
            const ip =
              item.ip !== undefined ? ipAddress(item.ip) : old?.ip || "";
            if (mode === "manual" && !ip)
              throw new InputError("手动固定模式需要 IP");
            if (
              item.isActive !== undefined &&
              typeof item.isActive !== "boolean"
            )
              throw new InputError("启用状态必须是布尔值");
            const record: DomainRecord = {
              ...old,
              domain,
              ip,
              candidates: old?.candidates || [],
              mode,
              isActive: item.isActive ?? old?.isActive ?? true,
              addedAt: old?.addedAt || now(),
            };
            const idx = next.custom.findIndex((r) => r.domain === domain);
            if (idx < 0) next.custom.push(record);
            else next.custom[idx] = record;
          }
          if (next.custom.length > 250)
            throw new InputError("自定义域名总数最多 250 条");
          await this.commit(next, true);
          return Response.json({ success: true, domains: next.custom });
        }
        if (path === "/delete") {
          const next = structuredClone(this.state);
          next.custom = body.all
            ? []
            : next.custom.filter((r) => r.domain !== domainName(body.domain));
          await this.commit(next, true);
          return Response.json({ success: true });
        }
        if (path === "/backups")
          return Response.json(
            (await this.ctx.storage.get<{ id: string; createdAt: string }[]>(
              "backup-index",
            )) || [],
          );
        if (path === "/restore") {
          const backups =
            (await this.ctx.storage.get<{ id: string }[]>("backup-index")) ||
            [];
          if (!backups.some((v) => v.id === body.id))
            throw new InputError("备份不存在");
          const backup = await this.ctx.storage.get<StoreState>(
            "backup:" + body.id,
          );
          if (!backup) throw new InputError("备份不存在");
          const next = structuredClone(backup);
          delete next.job;
          await this.commit(next, true);
          return Response.json({ success: true });
        }
        if (path === "/export")
          return Response.json({ exportedAt: now(), state: this.state });
        if (path === "/import") {
          if (!Array.isArray(body.domains) || body.domains.length > 250)
            throw new InputError("导入格式无效");
          const next = structuredClone(this.state);
          next.custom = body.domains.map((r: any) => ({
            domain: domainName(r.domain),
            ip: r.ip ? ipAddress(r.ip) : "",
            candidates: [],
            mode: ["manual", "dns", "probe"].includes(r.mode)
              ? r.mode
              : "manual",
            isActive: r.isActive !== false,
            addedAt: r.addedAt || now(),
          }));
          if (
            new Set(next.custom.map((r) => r.domain)).size !==
            next.custom.length
          )
            throw new InputError("导入包含重复域名");
          if (
            body.domains.some(
              (r: any) =>
                r.mode !== undefined &&
                !["manual", "dns", "probe"].includes(r.mode),
            )
          )
            throw new InputError("更新模式无效");
          if (next.custom.some((r) => r.mode === "manual" && !r.ip))
            throw new InputError("手动域名缺少 IP");
          await this.commit(next, true);
          return Response.json({ success: true });
        }
        if (path === "/probe") {
          if (!Array.isArray(body.results) || body.results.length > 100)
            throw new InputError("测速报告格式无效");
          const next = structuredClone(this.state);
          let applied = 0;
          for (const result of body.results) {
            const domain = domainName(result.domain),
              record =
                next.custom.find((r) => r.domain === domain) ||
                next.github.find((r) => r.domain === domain);
            if (!record || !record.isActive || record.mode !== "probe")
              continue;
            if (
              result.network !== "direct" ||
              !Array.isArray(result.samples) ||
              result.samples.length < 3 ||
              result.samples.length > 5
            )
              throw new InputError("需要 3—5 次直连测量");
            const ip = ipAddress(result.ip);
            if (
              !record.candidates.includes(ip) ||
              !record.lastAttemptAt ||
              Date.now() - Date.parse(record.lastAttemptAt) > 7200000
            )
              throw new InputError("候选 IP 已过期，请等待解析刷新");
            const tested = Date.parse(result.testedAt);
            if (
              !Number.isFinite(tested) ||
              Math.abs(Date.now() - tested) > 600000
            )
              throw new InputError("测速报告已过期");
            if (
              !result.samples.every(
                (v: any) => Number.isFinite(v) && v > 0 && v <= 10000,
              )
            )
              throw new InputError("测速结果无效");
            const median = [...result.samples].sort(
              (a: number, b: number) => a - b,
            )[Math.floor(result.samples.length / 2)];
            if (record.ip !== ip) record.lastChangedAt = now();
            record.ip = ip;
            record.lastSuccessAt = now();
            record.source = "home-https-probe";
            record.probe = {
              testedAt: result.testedAt,
              network: "direct",
              successRate: 1,
              latencyMs: median,
            };
            delete record.lastError;
            applied++;
          }
          if (applied) await this.commit(next, true);
          return Response.json({ success: true, applied });
        }
        return Response.json({ error: "Not found" }, { status: 404 });
      } catch (e) {
        return Response.json(
          { error: errorText(e) },
          {
            status:
              e instanceof InputError || e instanceof SyntaxError
                ? 400
                : errorText(e).includes("发布失败")
                  ? 503
                  : 500,
          },
        );
      }
    });
  }
  async alarm(): Promise<void> {
    await this.serial(async () => {
      const next = structuredClone(this.state),
        job = next.job;
      if (!job || !["queued", "running"].includes(job.status)) {
        if (next.publicationError) await this.commit(next);
        return;
      }
      job.status = "running";
      // Six domains, four DoH requests and at most one retry each: <= 48 DNS subrequests per alarm.
      const batch = job.pending.splice(0, 6);
      await Promise.all(
        batch.map(async (domain) => {
          try {
            job.results[domain] = await resolveCandidates(domain);
            job.succeeded++;
          } catch (e) {
            job.errors.push({ domain, error: errorText(e) });
            job.failed++;
          }
          job.completed++;
        }),
      );
      if (job.pending.length) {
        await this.ctx.storage.put("state", next);
        this.state = next;
        await this.ctx.storage.setAlarm(Date.now() + 1000);
        return;
      }
      const existing = new Map(next.github.map((r) => [r.domain, r]));
      for (const domain of GITHUB_URLS)
        if (!existing.has(domain))
          existing.set(domain, {
            domain,
            ip: "",
            candidates: [],
            mode: "probe",
            isActive: true,
            addedAt: now(),
          });
      next.github = [...existing.values()];
      for (const record of [...next.github, ...next.custom]) {
        if (!record.isActive || record.mode === "manual") continue;
        record.lastAttemptAt = job.startedAt;
        const result = job.results[record.domain];
        if (!result) {
          record.lastError = "DNS 更新失败，保留最近可用值";
          continue;
        }
        record.candidates = result.ips;
        record.resolutionSource = result.source;
        record.resolutionMs = result.durationMs;
        const newIp = result.ips.includes(record.ip)
          ? record.ip
          : result.ips.find((ip) => !ip.includes(":")) || result.ips[0];
        if (record.mode === "dns" || !record.ip) {
          if (record.ip !== newIp) record.lastChangedAt = now();
          record.ip = newIp;
          record.source = result.source;
          record.lastSuccessAt = now();
          delete record.lastError;
        } else
          record.lastError = record.probe
            ? "等待本轮本地测速"
            : "尚未完成本地测速；保留原 IP";
      }
      job.status =
        job.succeeded === 0 ? "failed" : job.failed ? "partial" : "success";
      job.finishedAt = now();
      if (job.succeeded > 0) next.lastSuccessAt = now();
      await this.commit(next, true);
    });
  }
}
