const r = new Response(null, { status: 303, headers: { "Location": "https://example.com" }});
try {
  r.headers.append("Set-Cookie", "test=1");
  console.log("Success! Headers mutable.");
} catch (e) {
  console.log("Error:", e.message);
}
