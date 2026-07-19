import sqlite3
import json
import re

db_path = '/Users/ekinyasa/.gemini/antigravity/conversations/14625cdf-bba2-42d1-bed9-e08e17726f73.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all commands run
cursor.execute("SELECT idx, step_payload FROM steps ORDER BY idx ASC")
rows = cursor.fetchall()

for idx, payload in rows:
    try:
        # Decode step payload as string
        content = payload.decode('utf-8', errors='ignore')
        
        # Look for run_command tool calls
        if 'run_command' in content:
            # Clean up binary/protobuf junk
            match = re.search(r'\{"CommandLine":".+?"\}', content)
            if match:
                cmd_json = match.group(0)
                try:
                    cmd_data = json.loads(cmd_json)
                    cmd_line = cmd_data.get("CommandLine", "")
                    if 'curl' in cmd_line:
                        print(f"Step {idx} Command:")
                        print("  ", cmd_line)
                        
                        # Fetch the response (usually in the next few steps)
                        for next_idx in range(idx + 1, idx + 4):
                            cursor.execute("SELECT step_payload FROM steps WHERE idx = ?", (next_idx,))
                            next_row = cursor.fetchone()
                            if next_row and next_row[0]:
                                next_content = next_row[0].decode('utf-8', errors='ignore')
                                # Check if it contains the command output
                                if 'HTTP/' in next_content or '{' in next_content:
                                    # print first 300 chars of output, cleaning up junk
                                    clean_out = re.sub(r'[\x00-\x1f]', '', next_content)
                                    clean_out = re.sub(r'[^\x20-\x7E]', '', clean_out)
                                    print("   Result:", clean_out[:400])
                                    break
                except Exception:
                    pass
    except Exception:
        pass

conn.close()
