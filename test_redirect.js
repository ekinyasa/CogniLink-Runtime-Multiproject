const params = new URLSearchParams();
params.append("_redirect", "https://www.teklifi.online/thanks");
fetch("https://www.teklifi.online/api/lead", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params
}).then(res => console.log("Redirect:", res.status));
