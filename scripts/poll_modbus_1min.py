#!/usr/bin/env python3
import socket
import struct
import time
import sys

DEVICES = [
    {"ip": "192.168.8.109", "name": "Device .109"},
    {"ip": "192.168.8.122", "name": "Device .122"},
    {"ip": "192.168.8.101", "name": "Device .101"},
]

DURATION_SECONDS = 60
POLL_INTERVAL_S = 1.0

def create_socket(ip, port=502, timeout=2.0):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    s.connect((ip, port))
    return s

def read_registers(s, tid, start=0, count=16):
    pdu = struct.pack('>BHH', 3, start, count)
    mbap = struct.pack('>HHHB', tid & 0xFFFF, 0, len(pdu) + 1, 1)
    s.sendall(mbap + pdu)
    resp = s.recv(1024)
    if len(resp) < 9:
        raise ValueError(f"Short response ({len(resp)} bytes)")
    if resp[7] != 3:
        raise ValueError(f"Modbus exception FC={resp[7]}")
    byte_count = resp[8]
    return list(struct.unpack(f'>{count}H', resp[9:9+byte_count]))

def decode_weight_and_rssi(regs):
    weight_g = struct.unpack('>f', struct.pack('>HH', regs[0], regs[1]))[0]
    stable_g = struct.unpack('>f', struct.pack('>HH', regs[2], regs[3]))[0]
    status = regs[10]
    rssi = struct.unpack('>h', struct.pack('>H', regs[11]))[0] if len(regs) > 11 else 0
    return weight_g / 1000.0, stable_g / 1000.0, bool(status & 0x01), rssi

def main():
    print(f"Starting 60-second Modbus TCP polling test on {len(DEVICES)} devices...")
    print(f"Target IPs: {', '.join(d['ip'] for d in DEVICES)}")
    print(f"Interval: {POLL_INTERVAL_S}s | Duration: {DURATION_SECONDS}s\n")
    
    stats = {}
    sockets = {}
    
    for d in DEVICES:
        ip = d["ip"]
        stats[ip] = {
            "name": d["name"],
            "sent": 0,
            "success": 0,
            "errors": 0,
            "reconnects": 0,
            "latencies": [],
            "weights": [],
            "rssis": [],
            "last_stable": None,
        }
        try:
            sockets[ip] = create_socket(ip)
        except Exception as e:
            print(f"[{ip}] Initial connect failed: {e}")
            sockets[ip] = None
            stats[ip]["reconnects"] += 1

    start_time = time.time()
    iteration = 0

    while time.time() - start_time < DURATION_SECONDS:
        iteration += 1
        elapsed = int(time.time() - start_time)
        cycle_start = time.time()
        
        row_str = f"[{elapsed:02d}s] "
        
        for d in DEVICES:
            ip = d["ip"]
            st = stats[ip]
            st["sent"] += 1
            
            s = sockets.get(ip)
            if s is None:
                try:
                    s = create_socket(ip)
                    sockets[ip] = s
                    st["reconnects"] += 1
                except Exception as e:
                    st["errors"] += 1
                    row_str += f"{d['name']}: ERR_CONN "
                    continue
            
            t0 = time.time()
            try:
                regs = read_registers(s, iteration)
                lat = (time.time() - t0) * 1000.0
                st["latencies"].append(lat)
                st["success"] += 1
                
                live_kg, stable_kg, is_stable, rssi = decode_weight_and_rssi(regs)
                st["weights"].append(live_kg)
                st["rssis"].append(rssi)
                st["last_stable"] = is_stable
                
                flag = "S" if is_stable else "~"
                row_str += f"{d['name']}: {live_kg:5.3f}kg ({lat:4.1f}ms,{flag}) "
            except Exception as e:
                st["errors"] += 1
                row_str += f"{d['name']}: FAIL({type(e).__name__}) "
                try:
                    s.close()
                except Exception:
                    pass
                sockets[ip] = None
        
        if iteration % 5 == 1 or iteration <= 3:
            print(row_str)
        
        remaining = POLL_INTERVAL_S - (time.time() - cycle_start)
        if remaining > 0:
            time.sleep(remaining)

    # Cleanup open sockets
    for ip, s in sockets.items():
        if s:
            try:
                s.close()
            except Exception:
                pass

    total_time = round(time.time() - start_time, 2)
    print(f"\n================ POLLING SUMMARY ({total_time}s) ================")
    print(f"{'Device':<15} {'Sent':<6} {'Success':<8} {'Loss %':<8} {'Avg Lat':<10} {'Min Lat':<10} {'Max Lat':<10} {'Reconn':<8} {'Final Wt':<10} {'Avg RSSI'}")
    print("-" * 95)
    
    for d in DEVICES:
        ip = d["ip"]
        st = stats[ip]
        sent = st["sent"]
        succ = st["success"]
        loss_pct = round((sent - succ) / sent * 100.0, 1) if sent else 0
        lats = st["latencies"]
        avg_lat = round(sum(lats) / len(lats), 1) if lats else 0
        min_lat = round(min(lats), 1) if lats else 0
        max_lat = round(max(lats), 1) if lats else 0
        reconn = st["reconnects"]
        final_wt = f"{st['weights'][-1]:.3f} kg" if st["weights"] else "N/A"
        avg_rssi = f"{round(sum(st['rssis']) / len(st['rssis']), 1)} dBm" if st["rssis"] else "N/A"
        
        print(f"{st['name'] + ' (' + ip + ')':<20} {sent:<6} {succ:<8} {loss_pct:<8}% {avg_lat:<8}ms {min_lat:<8}ms {max_lat:<8}ms {reconn:<8} {final_wt:<10} {avg_rssi}")
    print("================================================================")

if __name__ == "__main__":
    main()

