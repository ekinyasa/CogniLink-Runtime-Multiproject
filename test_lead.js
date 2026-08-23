function generateValidTC() {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  let sumOdd = 0;
  let sumEven = 0;
  for (let i = 0; i < 9; i++) {
    if (i % 2 === 0) sumOdd += digits[i];
    else sumEven += digits[i];
  }
  const tenth = ((sumOdd * 7) - sumEven) % 10;
  const eleventh = (sumOdd + sumEven + tenth) % 10;
  return digits.join('') + tenth + eleventh;
}
const tc = generateValidTC();
console.log("Using TC:", tc);
fetch("https://www.teklifi.online/api/lead", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    slug: "test",
    name: "test",
    phone: "5554443322",
    tc_no: tc,
    email: "test@test.com"
  })
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
});
