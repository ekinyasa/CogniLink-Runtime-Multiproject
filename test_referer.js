const params = new URLSearchParams();
params.append("phone", "5551112233");
fetch("https://www.teklifi.online/api/lead", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://www.teklifi.online/l/sigorta-yenileme" }, body: params
}).then(res => console.log("Referer:", res.status));
