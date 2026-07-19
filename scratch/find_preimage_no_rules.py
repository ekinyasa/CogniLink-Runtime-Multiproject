import sqlite3
import re
import json

db_path = '/Users/ekinyasa/.gemini/antigravity/conversations/14625cdf-bba2-42d1-bed9-e08e17726f73.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT idx, step_payload FROM steps")
rows = cursor.fetchall()

out_file = '/Users/ekinyasa/.gemini/antigravity/brain/14625cdf-bba2-42d1-bed9-e08e17726f73/scratch/preimage_no_rules_search.txt'
with open(out_file, 'w', encoding='utf-8') as f:
    for idx, payload in rows:
        if not payload:
            continue
        try:
            text = payload.decode('utf-8', errors='ignore')
            if 'test-1783922084893-igbio' in text:
                # Find JSON patterns
                for m in re.finditer(r'\{', text):
                    start = m.start()
                    brace_count = 0
                    end = start
                    while end < len(text):
                        if text[end] == '{':
                            brace_count += 1
                        elif text[end] == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                break
                        end += 1
                    
                    obj_str = text[start:end+1]
                    if 'test-1783922084893-igbio' in obj_str and 'decision_rules' not in obj_str:
                        # Try to format as JSON
                        try:
                            parsed = json.loads(obj_str)
                            f.write(f"=== STEP {idx} (PREIMAGE JSON) ===\n")
                            f.write(json.dumps(parsed, indent=2) + "\n\n")
                        except:
                            # Let's print raw string if it looks like a JSON block
                            if len(obj_str) < 500:
                                f.write(f"=== STEP {idx} (PREIMAGE RAW) ===\n")
                                f.write(obj_str + "\n\n")
        except Exception as e:
            f.write(f"Error processing step {idx}: {e}\n")

print("Done. Saved results to", out_file)
conn.close()
