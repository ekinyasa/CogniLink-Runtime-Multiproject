import os
import shutil
import sqlite3

# Define target key and value
key = "test-1783922084893-igbio"
value = '{"slug":"test-1783922084893-igbio","isActive":true,"decision_rules":[{"id":"m2-shadow-source-render","priority":100,"condition":{"property":"source","operator":"===","value":"m2-shadow-probe"},"action":"render"}]}'

# Blob IDs
blob_ids = [
    "f1ca0d4fdf3f0f0bc5fc2a8f4df34c92428e724d45e47db67e7462bfe4a755320000019f6f390b2f",
    "3cdc05892f7cc52f5d196375d8582c9a6f1d936d50d3e9ec6d4efa5c0ddf85e20000019f6f390b2f",
    "3cdc05892f7cc52f5d196375d8582c9a6f1d936d50d3e9ec6d4efa5c0ddf85e20000019f6f390b2h",
    "3cdc05892f7cc52f5d196375d8582c9a6f1d936d50d3e9ec6d4efa5c0ddf85e20000019f6f389c7b"
]

kv_dir = "/Users/ekinyasa/Coding/projects/claude/cognilink-runtime-pages-app/.wrangler/state/v3/kv"
miniflare_db_dir = os.path.join(kv_dir, "miniflare-KVNamespaceObject")

# 1. Update SQLite files in miniflare-KVNamespaceObject
db_files = [f for f in os.listdir(miniflare_db_dir) if f.endswith(".sqlite")]
for db_file in db_files:
    db_path = os.path.join(miniflare_db_dir, db_file)
    print(f"Injecting into {db_file}...")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='_mf_entries'")
        if cursor.fetchone():
            # Delete any existing key
            cursor.execute("DELETE FROM _mf_entries WHERE key = ?", (key,))
            # Insert for each blob ID to be sure
            for b_id in blob_ids:
                try:
                    cursor.execute("INSERT OR REPLACE INTO _mf_entries (key, blob_id, expiration, metadata) VALUES (?, ?, ?, ?)",
                                   (key, b_id, None, None))
                except Exception as e:
                    print(f"  Insert failed for {b_id}: {e}")
            conn.commit()
        conn.close()
    except Exception as e:
        print(f"  Failed database {db_file}: {e}")

# 2. Write blob files to all potential locations
namespaces = [
    "9719a15a3c074d82a2f452926003ca9c",
    "281632c6f5f1457db9e04ee79d979929",
    "3de11a5e5c32bd1bc807fc1bb1d3f558017c681c01b090a4e580de6f5c13b843",
    "6c1f13af5b4f5b877b8720ff6fb921d754100418d5e30317a4bcb47e3c284ebd",
    "SLUG_LINKS",
    "miniflare-KVNamespaceObject"
]

for ns in namespaces:
    blobs_dir = os.path.join(kv_dir, ns, "blobs")
    os.makedirs(blobs_dir, exist_ok=True)
    for b_id in blob_ids:
        blob_path = os.path.join(blobs_dir, b_id)
        print(f"Writing blob to {ns}/blobs/{b_id[:8]}...")
        with open(blob_path, "w") as f:
            f.write(value)

print("Injections complete!")
