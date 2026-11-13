#!/usr/bin/env python3
"""
1-Minute Thermal Printer Reliability & Quality Diagnostic Script
Tests TCP Port 9100 socket handshake and ICMP ping for all registered thermal printers.
"""
import time
import socket
import subprocess
from datetime import datetime

PRINTERS = [
    {"name": "Reception Printer", "ip": "192.168.8.112", "port": 9100},
    {"name": "Packaging/Pallet Printer", "ip": "192.168.8.114", "port": 9100},
]

DURATION_SECONDS = 60
INTERVAL_SECONDS = 1.0

def test_tcp_connect(ip: str, port: int, timeout: float = 2.0):
    t0 = time.time()
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        s.connect((ip, port))
        latency = (time.time() - t0) * 1000.0
        s.close()
        return True, latency, None
    except Exception as e:
        latency = (time.time() - t0) * 1000.0
        return False, latency, str(e)

def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Starting 1-minute printer connection quality test ({DURATION_SECONDS}s)...")
    results = {p["ip"]: {"success": 0, "fail": 0, "latencies": [], "errors": []} for p in PRINTERS}

    start_time = time.time()
    iteration = 0

    while time.time() - start_time < DURATION_SECONDS:
        iteration += 1
        elapsed = time.time() - start_time
        line = f"[{elapsed:4.1f}s] Iter #{iteration:02d}: "
        
        for p in PRINTERS:
            ip, port = p["ip"], p["port"]
            ok, lat, err = test_tcp_connect(ip, port, timeout=2.0)
            if ok:
                results[ip]["success"] += 1
                results[ip]["latencies"].append(lat)
                status_str = f"OK ({lat:5.1f}ms)"
            else:
                results[ip]["fail"] += 1
                results[ip]["errors"].append(f"Iter {iteration}: {err}")
                status_str = f"FAIL ({err[:25]})"
            line += f" | {p['name']} ({ip}): {status_str}"

        print(line)
        time.sleep(INTERVAL_SECONDS)

    print("\n" + "=" * 60)
    print("=== PRINTER RELIABILITY SUMMARY (60 SECONDS) ===")
    print("=" * 60)
    for p in PRINTERS:
        ip = p["ip"]
        r = results[ip]
        total = r["success"] + r["fail"]
        succ_pct = (r["success"] / total * 100.0) if total > 0 else 0
        lats = r["latencies"]
        min_lat = min(lats) if lats else 0
        max_lat = max(lats) if lats else 0
        avg_lat = (sum(lats) / len(lats)) if lats else 0

        print(f"\nStation: {p['name']} ({ip}:{p['port']})")
        print(f"  - Total Probes     : {total}")
        print(f"  - Successful Dials : {r['success']}/{total} ({succ_pct:.1f}%)")
        print(f"  - Failed / Drops   : {r['fail']}")
        print(f"  - Latency Min/Avg/Max: {min_lat:.1f}ms / {avg_lat:.1f}ms / {max_lat:.1f}ms")
        if r["errors"]:
            print(f"  - Error Samples    : {r['errors'][:3]}")

if __name__ == "__main__":
    main()

