const params = new URLSearchParams();
params.append("phone", "5551112233");
fetch("https://www.teklifi.online/api/lead", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": "cos_state=fake_cookie" }, body: params
}).then(res => console.log("Cookie:", res.status));
