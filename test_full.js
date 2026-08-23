const params = new URLSearchParams();
params.append("slug", "sigorta-yenileme");
params.append("name", "Ekin");
params.append("phone", "5551112233");
params.append("tc_no", "12345678950");
params.append("email", "test@test.com");
params.append("_redirect", "https://www.teklifi.online/thanks");

fetch("https://www.teklifi.online/api/lead", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": "https://www.teklifi.online/l/sigorta-yenileme",
    "Cookie": "cos_state=fake_cookie"
  },
  body: params
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
});
