fetch("https://www.teklifi.online/api/lead", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    slug: "sigorta-yenileme",
    name: "Ekin Yasa",
    phone: "5559998877",
    tc_no: "12345678950",
    email: "ekin@test.com"
  })
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
});
