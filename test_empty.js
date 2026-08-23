fetch("https://www.teklifi.online/api/lead", {
  method: "POST",
  headers: { "Content-Type": "application/json" }
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
});
