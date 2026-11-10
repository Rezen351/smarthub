#!/usr/bin/env python3
"""
E-Tani Smart Hub - Weight Transmitter Modbus TCP Simulator
Faithfully mirrors firmware/transmitter-multi-core/ ModbusServer holding register map (40001-40031).

Stations:
  - Station 01 (Reception): Floor Scale 150 kg (Port 5020)
  - Station 02 (Sorting):   Floor Scale 100 kg (Port 5021)
  - Station 03 (Packaging): Bench Scale 30 kg  (Port 5022)

Zero external dependencies: uses Python stdlib (asyncio, struct, random, time).
"""

import asyncio
import json
import logging
import math
import os
import random
import struct
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger("ModbusSimulator")

# Register offsets (0-indexed, 40001 = offset 0)
REG_WEIGHT_G      = 0   # 40001-02  F32 (grams)
REG_STABLE_G      = 2   # 40003-04  F32 (grams)
REG_RAW           = 4   # 40005-06  F32
REG_OFFSET        = 6   # 40007-08  F32
REG_CPK           = 8   # 40009-10  F32
REG_STATUS        = 10  # 40011     U16
REG_RSSI          = 11  # 40012     I16
REG_WIFI_MODE     = 12  # 40013     U16
REG_FW_VER        = 13  # 40014     U16
REG_UPTIME        = 14  # 40015     U16
REG_CMD           = 15  # 40016     U16
REG_CMD_ARG       = 16  # 40017-18  F32
REG_SESS_CNT_HI   = 18  # 40019     U16
REG_SESS_CNT_LO   = 19  # 40020     U16
REG_SESS_TOTAL_G  = 20  # 40021-22  F32
REG_SESSION_MIN_G = 22  # 40023-24  F32
REG_SESSION_MAX_G = 24  # 40025-26  F32
REG_CLIENT_CONN   = 26  # 40027     U16
REG_RESERVED_1    = 27  # 40028     U16
REG_RESERVED_2    = 28  # 40029     U16
REG_INTERCEPT     = 29  # 40030-31  F32
NUM_REGS          = 31

# Status bit flags
FLAG_HX711_READY  = 0x0001
FLAG_CALIBRATED   = 0x0002
FLAG_STA_CONN     = 0x0004
FLAG_CMD_PENDING  = 0x0008
FLAG_WEIGHT_STABLE= 0x0010

# Commands
CMD_TARE          = 1
CMD_CALIBRATE     = 2
CMD_RESET_SESSION = 3
CMD_FLUSH         = 4
CMD_ZERO          = 8
CMD_WIPE_WIFI     = 99

def float_to_words(val: float) -> tuple[int, int]:
    """Encode float32 to two big-endian 16-bit words (high word first)."""
    raw = struct.pack('>f', float(val))
    hi, lo = struct.unpack('>HH', raw)
    return hi, lo

def words_to_float(hi: int, lo: int) -> float:
    """Decode two 16-bit words into float32."""
    raw = struct.pack('>HH', hi & 0xFFFF, lo & 0xFFFF)
    return struct.unpack('>f', raw)[0]


class SimulatedScale:
    def __init__(self, station_id: str, name: str, port: int, capacity_kg: float, default_target_kg: float):
        self.station_id = station_id
        self.name = name
        self.port = port
        self.capacity_kg = capacity_kg
        self.default_target_kg = default_target_kg
        self.target_weight_kg = default_target_kg
        self.current_weight_kg = default_target_kg
        self.tare_offset_kg = 0.0
        self.start_time = time.time()
        self.last_target_change = time.time()
        self.client_connected = False
        self.client_count = 0
        
        # Session stats
        self.session_count = 0
        self.session_total_g = 0.0
        self.session_min_g = 999999.0
        self.session_max_g = 0.0

        # Holding registers table (31 words)
        self.registers = [0] * NUM_REGS
        self.registers[REG_FW_VER] = 100 # v1.0.0
        self.registers[REG_RSSI] = -58 & 0xFFFF
        self.registers[REG_WIFI_MODE] = 2 # Ethernet / LAN mode
        
        # Counts per kg calibration
        cpk_hi, cpk_lo = float_to_words(21450.0)
        self.registers[REG_CPK] = cpk_hi
        self.registers[REG_CPK + 1] = cpk_lo

        # Update initial state
        self.update_tick()

    def set_target_weight(self, weight_kg: float):
        self.target_weight_kg = max(0.0, min(self.capacity_kg * 1.1, weight_kg))
        self.last_target_change = time.time()
        logger.info(f"[{self.station_id}] New target weight set: {self.target_weight_kg:.3f} kg")

    def tare(self):
        # Current gross weight becomes offset, net momentarily becomes 0
        self.tare_offset_kg = self.current_weight_kg
        self.last_target_change = time.time()
        logger.info(f"[{self.station_id}] Tare executed. Offset: {self.tare_offset_kg:.3f} kg")

    def zero(self):
        self.tare_offset_kg = 0.0
        self.target_weight_kg = self.default_target_kg
        self.current_weight_kg = self.default_target_kg
        self.last_target_change = time.time()
        logger.info(f"[{self.station_id}] Zero executed. Restored nominal weight {self.default_target_kg:.3f} kg")

    def update_tick(self):
        now = time.time()
        elapsed_since_target = now - self.last_target_change
        
        # Auto-reload platform if tared or empty for more than 3.0 seconds
        if (self.current_weight_kg - self.tare_offset_kg) <= 0.02 and elapsed_since_target > 3.0:
            self.tare_offset_kg = 0.0
            self.target_weight_kg = self.default_target_kg
            self.last_target_change = now
            logger.info(f"[{self.station_id}] Platform reloaded with harvest: {self.default_target_kg:.3f} kg")

        # Converge toward target weight
        diff = self.target_weight_kg - self.current_weight_kg
        if abs(diff) > 0.005:
            # Move smoothly toward target
            self.current_weight_kg += diff * 0.25
        else:
            self.current_weight_kg = self.target_weight_kg

        # Small physical jitter (±0.004 kg when loaded, ±0.001 when empty)
        jitter_amp = 0.004 if self.current_weight_kg > 0.1 else 0.001
        jitter = (random.random() - 0.5) * jitter_amp
        
        net_kg = max(0.0, (self.current_weight_kg - self.tare_offset_kg) + jitter)
        net_grams = net_kg * 1000.0

        # Stability: settled if within target for >= 0.8 seconds
        is_stable = (elapsed_since_target >= 0.8) and (abs(diff) <= 0.02)
        stable_grams = net_grams if is_stable else max(0.0, (self.target_weight_kg - self.tare_offset_kg) * 1000.0)

        # Update holding registers
        w_hi, w_lo = float_to_words(net_grams)
        self.registers[REG_WEIGHT_G] = w_hi
        self.registers[REG_WEIGHT_G + 1] = w_lo

        s_hi, s_lo = float_to_words(stable_grams)
        self.registers[REG_STABLE_G] = s_hi
        self.registers[REG_STABLE_G + 1] = s_lo

        # Raw loadcell counts
        raw_counts = (self.current_weight_kg * 21450.0) + 128500.0
        r_hi, r_lo = float_to_words(raw_counts)
        self.registers[REG_RAW] = r_hi
        self.registers[REG_RAW + 1] = r_lo

        # Tare offset
        o_hi, o_lo = float_to_words(self.tare_offset_kg * 21450.0)
        self.registers[REG_OFFSET] = o_hi
        self.registers[REG_OFFSET + 1] = o_lo

        # Status bit flags
        status = FLAG_HX711_READY | FLAG_CALIBRATED | FLAG_STA_CONN
        if is_stable:
            status |= FLAG_WEIGHT_STABLE
        self.registers[REG_STATUS] = status

        # Uptime
        uptime = int(now - self.start_time) & 0xFFFF
        self.registers[REG_UPTIME] = uptime

        # Client connected indicator
        self.registers[REG_CLIENT_CONN] = 1 if self.client_count > 0 else 0

        # Check Command register
        cmd = self.registers[REG_CMD]
        if cmd != 0:
            arg = words_to_float(self.registers[REG_CMD_ARG], self.registers[REG_CMD_ARG + 1])
            logger.info(f"[{self.station_id}] Command received: {cmd} (arg: {arg})")
            if cmd == CMD_TARE:
                self.tare()
            elif cmd == CMD_ZERO:
                self.zero()
            elif cmd == CMD_CALIBRATE:
                logger.info(f"[{self.station_id}] Calibrated with arg {arg} kg")
            self.registers[REG_CMD] = 0

    def get_snapshot(self):
        w_g = words_to_float(self.registers[REG_WEIGHT_G], self.registers[REG_WEIGHT_G + 1])
        s_g = words_to_float(self.registers[REG_STABLE_G], self.registers[REG_STABLE_G + 1])
        status = self.registers[REG_STATUS]
        return {
            "stationId": self.station_id,
            "name": self.name,
            "port": self.port,
            "capacityKg": self.capacity_kg,
            "weightKg": round(w_g / 1000.0, 3),
            "stableWeightKg": round(s_g / 1000.0, 3),
            "weightGrams": round(w_g, 1),
            "isStable": bool(status & FLAG_WEIGHT_STABLE),
            "statusFlags": f"0x{status:04X}",
            "clientConnected": self.client_count > 0,
            "uptimeSec": self.registers[REG_UPTIME],
        }


class ModbusTcpProtocol(asyncio.Protocol):
    """Handles Modbus TCP (MBAP + PDU) framing for a specific simulated scale."""
    def __init__(self, scale: SimulatedScale):
        self.scale = scale
        self.transport = None
        self.buffer = bytearray()

    def connection_made(self, transport):
        self.transport = transport
        self.scale.client_count += 1
        peer = transport.get_extra_info('peername')
        logger.info(f"[{self.scale.station_id}] Modbus TCP client connected from {peer}")

    def connection_lost(self, exc):
        self.scale.client_count = max(0, self.scale.client_count - 1)
        logger.info(f"[{self.scale.station_id}] Modbus TCP client disconnected")

    def data_received(self, data):
        self.buffer.extend(data)
        while len(self.buffer) >= 7:
            # Parse 7-byte MBAP header:
            # 0..1: Transaction ID
            # 2..3: Protocol ID (0x0000)
            # 4..5: Length (following bytes)
            # 6:    Unit ID
            tid, pid, length, uid = struct.unpack('>HHHB', self.buffer[:7])
            if len(self.buffer) < 6 + length:
                # Incomplete frame
                break

            pdu = self.buffer[7:6 + length]
            del self.buffer[:6 + length]
            
            resp_pdu = self.handle_pdu(pdu)
            if resp_pdu:
                resp_mbap = struct.pack('>HHHB', tid, 0, len(resp_pdu) + 1, uid)
                self.transport.write(resp_mbap + resp_pdu)

    def handle_pdu(self, pdu: bytes) -> bytes:
        if not pdu:
            return None
        fc = pdu[0]
        
        if fc == 0x03: # Read Holding Registers
            if len(pdu) < 5:
                return bytes([fc | 0x80, 0x03]) # Exception 3
            start_addr, count = struct.unpack('>HH', pdu[1:5])
            if count == 0 or count > 125 or (start_addr + count) > NUM_REGS:
                return bytes([fc | 0x80, 0x02]) # Exception 2 (Illegal Data Address)
            
            byte_count = count * 2
            resp = bytearray([fc, byte_count])
            for i in range(count):
                reg_val = self.scale.registers[start_addr + i] & 0xFFFF
                resp.extend(struct.pack('>H', reg_val))
            return bytes(resp)

        elif fc == 0x06: # Write Single Register
            if len(pdu) < 5:
                return bytes([fc | 0x80, 0x03])
            addr, val = struct.unpack('>HH', pdu[1:5])
            if addr >= NUM_REGS:
                return bytes([fc | 0x80, 0x02])
            self.scale.registers[addr] = val & 0xFFFF
            return pdu # Echoes address & value back

        elif fc == 0x10: # Write Multiple Registers
            if len(pdu) < 6:
                return bytes([fc | 0x80, 0x03])
            start_addr, count, byte_count = struct.unpack('>HHB', pdu[1:6])
            if count == 0 or (start_addr + count) > NUM_REGS or byte_count != count * 2:
                return bytes([fc | 0x80, 0x02])
            values = struct.unpack(f'>{count}H', pdu[6:6 + byte_count])
            for i, val in enumerate(values):
                self.scale.registers[start_addr + i] = val & 0xFFFF
            return struct.pack('>BHH', fc, start_addr, count)

        else:
            # Illegal function
            return bytes([fc | 0x80, 0x01])


class HttpControlServer:
    """Lightweight HTTP server on port 8088 to inspect status and simulate weight."""
    def __init__(self, scales: dict[str, SimulatedScale], port: int = 8088):
        self.scales = scales
        self.port = port

    async def handle_request(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        try:
            line = await reader.readline()
            if not line:
                writer.close()
                return
            request_line = line.decode('utf-8', errors='ignore').strip()
            parts = request_line.split()
            if len(parts) < 2:
                writer.close()
                return
            method, full_path = parts[0], parts[1]

            # Read headers
            headers = {}
            while True:
                header_line = await reader.readline()
                if not header_line or header_line == b'\r\n':
                    break
                h_parts = header_line.decode('utf-8', errors='ignore').split(':', 1)
                if len(h_parts) == 2:
                    headers[h_parts[0].strip().lower()] = h_parts[1].strip()

            content_length = int(headers.get('content-length', 0))
            body = b''
            if content_length > 0:
                body = await reader.readexactly(content_length)

            path = full_path.split('?')[0]
            query = {}
            if '?' in full_path:
                q_str = full_path.split('?', 1)[1]
                for param in q_str.split('&'):
                    if '=' in param:
                        k, v = param.split('=', 1)
                        query[k] = v

            resp_data = {"status": "ok"}
            status_code = 200

            if path in ("/health", "/status", "/scales"):
                if path == "/scales":
                    resp_data = [s.get_snapshot() for s in self.scales.values()]
                else:
                    resp_data = {
                        "scales": {k: s.get_snapshot() for k, s in self.scales.items()},
                        "timestamp": time.time(),
                    }
            elif path == "/simulate" and method in ("POST", "GET"):
                st_id = query.get("station")
                w_str = query.get("weight")
                if body:
                    try:
                        b_json = json.loads(body.decode('utf-8'))
                        st_id = b_json.get("station") or b_json.get("stationId") or st_id
                        w_val = b_json.get("weight") or b_json.get("weightKg") or b_json.get("weight_kg")
                        if w_val is not None:
                            w_str = str(w_val)
                    except Exception:
                        pass
                
                scale = self.scales.get(st_id)
                if scale and w_str is not None:
                    scale.set_target_weight(float(w_str))
                    resp_data = {"success": True, "scale": scale.get_snapshot()}
                else:
                    status_code = 400
                    resp_data = {"success": False, "error": "Invalid station or weight parameter"}
            elif path == "/tare" and method == "POST":
                st_id = query.get("station")
                scale = self.scales.get(st_id)
                if scale:
                    scale.tare()
                    resp_data = {"success": True, "scale": scale.get_snapshot()}
                else:
                    status_code = 400
                    resp_data = {"success": False, "error": "Invalid station"}
            elif path == "/zero" and method == "POST":
                st_id = query.get("station")
                scale = self.scales.get(st_id)
                if scale:
                    scale.zero()
                    resp_data = {"success": True, "scale": scale.get_snapshot()}
                else:
                    status_code = 400
                    resp_data = {"success": False, "error": "Invalid station"}
            else:
                status_code = 404
                resp_data = {"error": "Not Found"}

            resp_json = json.dumps(resp_data, indent=2).encode('utf-8')
            resp_headers = (
                f"HTTP/1.1 {status_code} OK\r\n"
                f"Content-Type: application/json\r\n"
                f"Content-Length: {len(resp_json)}\r\n"
                f"Access-Control-Allow-Origin: *\r\n"
                f"Connection: close\r\n\r\n"
            ).encode('utf-8')
            writer.write(resp_headers + resp_json)
            await writer.drain()
        except Exception as e:
            logger.error(f"HTTP handler error: {e}")
        finally:
            writer.close()


async def tick_loop(scales: dict[str, SimulatedScale]):
    """Periodic tick updating scale physics, jitter, and registers."""
    while True:
        for scale in scales.values():
            scale.update_tick()
        await asyncio.sleep(0.1) # 100 ms loop


async def main():
    scales = {
        "01": SimulatedScale("01", "Station 01 Reception Scale", 5020, capacity_kg=150.0, default_target_kg=42.50),
        "02": SimulatedScale("02", "Station 02 Sorting Scale",   5021, capacity_kg=100.0, default_target_kg=18.20),
        "03": SimulatedScale("03", "Station 03 Packaging Scale", 5022, capacity_kg=30.0,  default_target_kg=1.002),
    }

    loop = asyncio.get_running_loop()
    servers = []

    # Start Modbus TCP servers on 5020, 5021, 5022
    for st_id, scale in scales.items():
        server = await loop.create_server(lambda s=scale: ModbusTcpProtocol(s), '0.0.0.0', scale.port)
        servers.append(server)
        logger.info(f"🚀 Modbus TCP Server for {scale.name} listening on 0.0.0.0:{scale.port}")

    # Start HTTP control server on 8088
    http_ctrl = HttpControlServer(scales, port=8088)
    http_server = await asyncio.start_server(http_ctrl.handle_request, '0.0.0.0', 8088)
    servers.append(http_server)
    logger.info("📡 HTTP Control API listening on http://0.0.0.0:8088 (/health, /simulate, /tare, /zero)")

    # Launch background simulation physics loop
    asyncio.create_task(tick_loop(scales))

    await asyncio.gather(*(s.serve_forever() for s in servers))


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Simulator stopped by user.")
