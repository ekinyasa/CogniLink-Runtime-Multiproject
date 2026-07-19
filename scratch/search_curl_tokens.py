import sqlite3

db_path = '/Users/ekinyasa/.gemini/antigravity/conversations/14625cdf-bba2-42d1-bed9-e08e17726f73.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT idx, step_payload FROM steps WHERE step_payload LIKE '%test-1783922084893-igbio%' ORDER BY idx ASC")
rows = cursor.fetchall()
for idx, payload in rows:
    try:
        content = payload.decode('utf-8', errors='ignore')
        if 'decision_rules' in content or 'shadow_decision_rules' in content:
            print(f"Step {idx}:")
            # Extract JSON blocks
            import re
            json_blocks = re.findall(r'\{[^{}]*"(?:decision_rules|shadow_decision_rules)".*?\}', content, re.DOTALL)
            if json_blocks:
                for jb in json_blocks:
                    print("  JSON:", jb.strip()[:300])
            else:
                # print lines containing decision_rules
                for line in content.split('\n'):
                    if 'decision_rules' in line or 'shadow_decision' in line:
                        print("  Line:", line.strip()[:200])
    except Exception as e:
        pass

conn.close()
