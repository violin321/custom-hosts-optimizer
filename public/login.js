document.querySelector("#login").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.target.querySelector("button"),
    message = document.querySelector("#message");
  button.disabled = true;
  message.textContent = "正在登录…";
  try {
    const response = await fetch("/admin/login", {
      method: "POST",
      body: new FormData(event.target),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "登录失败");
    location.assign(data.redirect);
  } catch (e) {
    message.textContent = e.message;
    message.className = "error";
  } finally {
    button.disabled = false;
  }
});
