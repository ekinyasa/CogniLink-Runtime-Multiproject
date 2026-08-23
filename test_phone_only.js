fetch("https://www.teklifi.online/api/lead", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    slug: "test",
    name: "test",
    phone: "5551234567"
  })
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
});
