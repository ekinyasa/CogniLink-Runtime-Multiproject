import sqlite3

db_path = '/Users/ekinyasa/.gemini/antigravity/conversations/14625cdf-bba2-42d1-bed9-e08e17726f73.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT idx, step_payload FROM steps")
rows = cursor.fetchall()

for idx, payload in rows:
    if not payload:
        continue
    try:
        text = payload.decode('utf-8', errors='ignore')
        if 'deploy' in text.lower():
            print(f"STEP {idx} contains deploy")
    except Exception as e:
        pass

conn.close()
