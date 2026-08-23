fetch("https://www.teklifi.online/api/lead", {
  method: "POST"
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
});
