const params = new URLSearchParams();
params.append("phone", "5551112233");
params.append("_redirect", "https://www.teklifi.online/thanks");
fetch("https://www.teklifi.online/api/lead", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
});
