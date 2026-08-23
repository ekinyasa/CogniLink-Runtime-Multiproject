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
const fd = new FormData();
fd.append("slug", "test");
fd.append("name", "test");
fd.append("phone", "5554443322");
fd.append("tc_no", tc);
fd.append("email", "test@test.com");
fetch("https://www.teklifi.online/api/lead", {
  method: "POST",
  body: fd
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
});
