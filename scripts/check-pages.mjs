import assert from "node:assert/strict";

export async function checkPages(request) {
  const assets = new Map();
  for (const path of ["/", "/admin/login"]) {
    const response = await request(path);
    assert.equal(response.status, 200, `${path} must return HTTP 200`);
    assert.match(
      response.headers.get("content-type") || "",
      /text\/html/,
      `${path} must serve HTML`,
    );
    const html = await response.text();
    assert.match(html, /<!doctype html>/i);
    assert.match(html, path === "/" ? /id="hosts"/ : /id="login"/);
    const references = [
      ...html.matchAll(/(?:src|href)="(\/[^"?#]+\.(?:css|js))(?:[?#][^"]*)?"/g),
    ];
    assert.ok(references.length >= 2, `${path} must reference its CSS and JS`);
    for (const [, asset] of references)
      assets.set(
        asset,
        asset.endsWith(".css") ? /text\/css/ : /(?:java|ecma)script/,
      );
  }
  for (const [path, type] of assets) {
    const response = await request(path);
    assert.equal(response.status, 200, `${path} must return HTTP 200`);
    assert.match(response.headers.get("content-type") || "", type);
    assert.ok((await response.text()).length > 0, `${path} must not be empty`);
  }
  const head = await request("/", { method: "HEAD" });
  assert.equal(head.status, 200, "Homepage HEAD must return HTTP 200");
  assert.equal(await head.text(), "");
  console.log(`Verified homepage, login page and ${assets.size} CSS/JS assets`);
}
