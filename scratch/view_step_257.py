import sqlite3

db_path = '/Users/ekinyasa/.gemini/antigravity/conversations/14625cdf-bba2-42d1-bed9-e08e17726f73.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT step_payload FROM steps WHERE idx=257")
row = cursor.fetchone()
if row and row[0]:
    print(row[0].decode('utf-8', errors='ignore'))
else:
    print("Not found")

conn.close()
