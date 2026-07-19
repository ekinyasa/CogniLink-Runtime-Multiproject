import sqlite3

db_path = '/Users/ekinyasa/Coding/projects/claude/cognilink-runtime-pages-app/.wrangler/state/v3/kv/miniflare-KVNamespaceObject/3de11a5e5c32bd1bc807fc1bb1d3f558017c681c01b090a4e580de6f5c13b843.sqlite'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT * FROM _mf_entries LIMIT 10")
rows = cursor.fetchall()
for r in rows:
    print(r)

conn.close()
