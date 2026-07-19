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
        if 'CommandLine' in text:
            # Parse JSON to extract the CommandLine field
            # We can find the CommandLine by looking for '"CommandLine": "..."'
            # Let's do a simple substring extraction or parse as JSON if it's a valid JSON payload
            # Actually, let's find the start of '"CommandLine":' and extract until the next '"'
            start_idx = 0
            while True:
                pos = text.find('"CommandLine"', start_idx)
                if pos == -1:
                    break
                # Find the next ':' and the starting '"' of the command string
                colon_pos = text.find(':', pos)
                quote_start = text.find('"', colon_pos)
                # Find matching quote (taking care of escaped quotes)
                quote_end = quote_start + 1
                while quote_end < len(text):
                    if text[quote_end] == '"' and text[quote_end-1] != '\\':
                        break
                    quote_end += 1
                
                cmd = text[quote_start+1:quote_end].replace('\\"', '"')
                if any(x in cmd.lower() for x in ['deploy', 'wrangler', 'pages', 'publish']):
                    print(f"STEP {idx}: {cmd}")
                
                start_idx = quote_end + 1
    except Exception as e:
        pass

conn.close()
