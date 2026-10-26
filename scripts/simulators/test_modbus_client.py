#!/usr/bin/env python3
"""
Test client to verify Modbus TCP communication against Station 01, 02, and 03.
Sends MBAP frame + Function Code 0x03 (Read Holding Registers 0..30)
and Function Code 0x06 (Write Single Register).
"""

import socket
import struct
import sys
import time

def read_registers(host: str, port: int, start_reg: int = 0, count: int = 31) -> list[int]:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2.0)
    s.connect((host, port))
    
    tid = 1
    pid = 0
    uid = 1
    pdu = struct.pack('>BHH', 3, start_reg, count)
    length = len(pdu) + 1
    mbap = struct.pack('>HHHB', tid, pid, length, uid)
    
    s.sendall(mbap + pdu)
    resp = s.recv(1024)
    s.close()
    
    if len(resp) < 9:
        raise ValueError(f"Response too short: {len(resp)} bytes")
    
    resp_tid, resp_pid, resp_len, resp_uid = struct.unpack('>HHHB', resp[:7])
    resp_fc = resp[7]
    if resp_fc != 3:
        raise ValueError(f"Modbus error response: FC={resp_fc}, code={resp[8] if len(resp)>8 else 'unknown'}")
    
    byte_count = resp[8]
    reg_data = resp[9:9 + byte_count]
    registers = list(struct.unpack(f'>{count}H', reg_data))
    return registers

def write_register(host: str, port: int, reg_addr: int, val: int):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2.0)
    s.connect((host, port))
    
    tid = 2
    pid = 0
    uid = 1
    pdu = struct.pack('>BHH', 6, reg_addr, val)
    length = len(pdu) + 1
    mbap = struct.pack('>HHHB', tid, pid, length, uid)
    
    s.sendall(mbap + pdu)
    resp = s.recv(1024)
    s.close()
    return resp

def words_to_float(hi: int, lo: int) -> float:
    raw = struct.pack('>HH', hi, lo)
    return struct.unpack('>f', raw)[0]

if __name__ == '__main__':
    host = sys.argv[1] if len(sys.argv) > 1 else '127.0.0.1'
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 5020
    
    print(f"Connecting to Modbus TCP scale at {host}:{port}...")
    regs = read_registers(host, port, 0, 31)
    weight_g = words_to_float(regs[0], regs[1])
    stable_g = words_to_float(regs[2], regs[3])
    status = regs[10]
    uptime = regs[14]
    
    print(f"✅ Success! Read 31 registers.")
    print(f"   Instantaneous Weight : {weight_g:.1f} g ({weight_g/1000.0:.3f} kg)")
    print(f"   Stable Weight        : {stable_g:.1f} g ({stable_g/1000.0:.3f} kg)")
    print(f"   Status Flags         : 0x{status:04X} (Stable: {bool(status & 0x0010)})")
    print(f"   Uptime               : {uptime} seconds")
