import sqlite3
import json

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
        if 'run_command' in text and 'deploy' in text:
            # Try to locate the command line
            for part in text.split('\n'):
                if 'CommandLine' in part or 'wrangler' in part:
                    print(f"STEP {idx}: {part}")
    except Exception as e:
        pass

conn.close()
