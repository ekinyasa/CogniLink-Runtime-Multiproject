import urllib.request
import json
import time

url_base = "http://localhost:8788/c/test-1783922084893-igbio?runtime-debug=1"
auth_header = "Bearer O+nAq0Kpgq+6zJsIdeU3JYNi2bwx4zDadrk+uaoq6jsXaqgzgMlNvn0m9tJPCP4m"

def send_request(params=""):
    url = url_base + params
    req = urllib.request.Request(url)
    req.add_header("Authorization", auth_header)
    try:
        with urllib.request.urlopen(req) as response:
            data = response.read().decode('utf-8')
            return response.status, json.loads(data)
    except Exception as e:
        return 500, str(e)

print("Starting M3A Scoped Validation Probes...")

results = []

# 1. 10 Trigger Probes (with utm_source=m2-shadow-probe)
print("\n--- Running 10 Trigger Probes ---")
for i in range(10):
    status, payload = send_request("&utm_source=m2-shadow-probe")
    if status == 200:
        authority = payload["metadata"]["decisionAuthority"]["authority"]
        comparison = payload["metadata"]["realRuleShadow"]["comparison_status"]
        matched_rule = payload["metadata"]["realRuleShadow"]["matched_rule_id"]
        print(f"Trigger Probe {i+1}: Status={status}, Authority={authority}, Comparison={comparison}, MatchedRule={matched_rule}")
        results.append(("trigger", status, authority, comparison, matched_rule))
    else:
        print(f"Trigger Probe {i+1} Failed: {payload}")
        results.append(("trigger", status, "error", "error", None))
    time.sleep(0.1)

# 2. 5 Baseline Probes (without utm_source=m2-shadow-probe)
print("\n--- Running 5 Baseline Probes ---")
for i in range(5):
    status, payload = send_request()
    if status == 200:
        authority = payload["metadata"]["decisionAuthority"]["authority"]
        comparison = payload["metadata"]["realRuleShadow"]["comparison_status"]
        matched_rule = payload["metadata"]["realRuleShadow"]["matched_rule_id"]
        print(f"Baseline Probe {i+1}: Status={status}, Authority={authority}, Comparison={comparison}, MatchedRule={matched_rule}")
        results.append(("baseline", status, authority, comparison, matched_rule))
    else:
        print(f"Baseline Probe {i+1} Failed: {payload}")
        results.append(("baseline", status, "error", "error", None))
    time.sleep(0.1)

# Summary table
print("\n--- Validation Summary ---")
print(f"{'Type':<10} | {'Status':<6} | {'Authority':<12} | {'Comparison':<12} | {'MatchedRule':<25}")
print("-" * 75)
for t, status, auth, comp, rule in results:
    rule_str = str(rule)
    print(f"{t:<10} | {status:<6} | {auth:<12} | {comp:<12} | {rule_str:<25}")

conn_ok = all(s == 200 for _, s, _, _, _ in results)
auth_ok = all(auth == "decision_v2" if t == "trigger" else auth == "legacy" for t, _, auth, _, _ in results)
comp_ok = all(comp == "identical" for _, _, _, comp, _ in results)

print("\nValidation Outcome:")
print(f"- All requests returned 200: {'PASS' if conn_ok else 'FAIL'}")
print(f"- Decision V2 authority applied to trigger probes: {'PASS' if auth_ok else 'FAIL'}")
print(f"- All comparison statuses are identical: {'PASS' if comp_ok else 'FAIL'}")
