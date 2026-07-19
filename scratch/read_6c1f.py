import sqlite3

db_path = '/Users/ekinyasa/Coding/projects/claude/cognilink-runtime-pages-app/.wrangler/state/v3/kv/miniflare-KVNamespaceObject/6c1f13af5b4f5b877b8720ff6fb921d754100418d5e30317a4bcb47e3c284ebd.sqlite'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT * FROM _mf_entries LIMIT 10")
rows = cursor.fetchall()
print("Rows in _mf_entries:")
for r in rows:
    print(r)

conn.close()
