import sqlite3
import json

db_path = '/Users/ekinyasa/.gemini/antigravity/conversations/14625cdf-bba2-42d1-bed9-e08e17726f73.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT idx, step_payload FROM steps")
rows = cursor.fetchall()

out_path = '/Users/ekinyasa/Coding/projects/claude/cognilink-runtime-pages-app/scratch/deploy_commands_full.txt'
with open(out_path, 'w') as f:
    for idx, payload in rows:
        if not payload:
            continue
        try:
            text = payload.decode('utf-8', errors='ignore')
            if 'CommandLine' in text:
                start_idx = 0
                while True:
                    pos = text.find('"CommandLine"', start_idx)
                    if pos == -1:
                        break
                    colon_pos = text.find(':', pos)
                    quote_start = text.find('"', colon_pos)
                    quote_end = quote_start + 1
                    while quote_end < len(text):
                        if text[quote_end] == '"' and text[quote_end-1] != '\\':
                            break
                        quote_end += 1
                    
                    cmd = text[quote_start+1:quote_end].replace('\\"', '"')
                    if any(x in cmd.lower() for x in ['deploy', 'wrangler', 'pages', 'publish']):
                        f.write(f"STEP {idx}: {cmd}\n")
                    
                    start_idx = quote_end + 1
        except Exception as e:
            pass

print("Done")
conn.close()
