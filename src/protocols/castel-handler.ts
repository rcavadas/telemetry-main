/**
 * Castel Protocol Handler
 * Implements the Sinocastel/T-Box OBD protocol exactly as Traccar does.
 *
 * Reference: traccar/src/main/java/org/traccar/protocol/CastelProtocolDecoder.java
 *
 * Frame structure:
 *   [0x40 0x40]     Header (2 bytes)
 *   [length LE]     Total packet length including header+footer (2 bytes, little-endian)
 *   [version]       Protocol version (1 byte) — SC devices use 3 or 4
 *   [deviceId]      Device identifier (20 bytes, ASCII, zero-padded)
 *   [type]          Message type (2 bytes, big-endian)
 *   [content]       Payload (variable)
 *   [crc16 LE]      CRC16-X25 checksum (2 bytes, little-endian)
 *   [0x0D 0x0A]     Footer (2 bytes)
 */

import { Logger } from '../utils/logger';

// ─── Message type constants (from Traccar CastelProtocolDecoder) ─────────
// SC (Sinocastel / OBD) types
export const MSG_SC_LOGIN          = 0x1001;
export const MSG_SC_LOGIN_RESPONSE = 0x9001;
export const MSG_SC_LOGOUT         = 0x1002;
export const MSG_SC_HEARTBEAT      = 0x1003;
export const MSG_SC_HEARTBEAT_RESPONSE = 0x9003;
export const MSG_SC_GPS            = 0x4001;
export const MSG_SC_PID_DATA       = 0x4002;
export const MSG_SC_G_SENSOR       = 0x4003;
export const MSG_SC_SUPPORTED_PID  = 0x4004;
export const MSG_SC_OBD_DATA       = 0x4005;
export const MSG_SC_DTCS_PASSENGER = 0x4006;
export const MSG_SC_ALARM          = 0x4007;
export const MSG_SC_ALARM_RESPONSE = 0xC007;
export const MSG_SC_CELL           = 0x4008;
export const MSG_SC_GPS_SLEEP      = 0x4009;
export const MSG_SC_DTCS_COMMERCIAL = 0x400B;
export const MSG_SC_FUEL           = 0x400E;
export const MSG_SC_COMPREHENSIVE  = 0x401F;
export const MSG_SC_AGPS_REQUEST   = 0x5101;
export const MSG_SC_QUERY_RESPONSE = 0xA002;
export const MSG_SC_CURRENT_LOCATION = 0xB001;

// Logout message
export const MSG_SC_LOGOUT_RESPONSE    = 0x9002;

// Device-specific heartbeat variant (observed from T-Box firmware in secondary server mode)
// NOTE: When the device sends 0x6001 instead of 0x1003, it indicates the device is treating
// this server as a SECONDARY server. The device should be reconfigured to use this server
// as its PRIMARY server (standard Castel port 5086) to get full protocol (0x1003 heartbeats).
export const MSG_SC_HEARTBEAT_V2      = 0x6001;
export const MSG_SC_HEARTBEAT_V2_RESPONSE = 0xE001; // 0x6001 | 0x8000

// ─── CRC16-X25 (Traccar: Checksum.CRC16_X25) ───────────────────────────
const CRC_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  const poly = 0x1021;
  for (let i = 0; i < 256; i++) {
    let crc = i << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ poly) : (crc << 1);
      crc &= 0xFFFF;
    }
    table[i] = crc;
  }
  return table;
})();

function reverseBits(value: number, bits: number): number {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (value & 1);
    value >>>= 1;
  }
  return result;
}

export function crc16X25(buf: Buffer, offset: number, length: number): number {
  let crc = 0xFFFF;
  for (let i = offset; i < offset + length; i++) {
    let b = buf[i] & 0xFF;
    b = reverseBits(b, 8);  // refIn = true
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 8) & 0xFF) ^ b]) & 0xFFFF;
  }
  crc = reverseBits(crc, 16);  // refOut = true
  return (crc ^ 0xFFFF) & 0xFFFF;  // xorOut = 0xFFFF
}

// ─── Parsed Castel frame ────────────────────────────────────────────────
export interface CastelFrame {
  version: number;
  deviceId: string;
  deviceIdRaw: Buffer; // raw 20 bytes from the frame (used for responses, like Traccar)
  type: number;        // message type (big-endian uint16)
  content: Buffer;     // payload between type and CRC
  raw: Buffer;         // entire frame including header/footer
  crcValid: boolean;
}

// ─── Build response (Traccar: CastelProtocolDecoder.sendResponse) ───────
// Uses raw 20-byte device ID buffer directly from the incoming frame,
// exactly like Traccar's response.writeBytes(id) uses the ByteBuf slice.
export function buildResponse(version: number, deviceIdRaw: Buffer, type: number, content?: Buffer): Buffer {
  const contentLen = content ? content.length : 0;
  // 2 (@@) + 2 (length) + 1 (version) + 20 (id) + 2 (type) + content + 2 (crc) + 2 (\r\n)
  const totalLength = 2 + 2 + 1 + 20 + 2 + contentLen + 2 + 2;

  const buf = Buffer.alloc(totalLength);
  let off = 0;

  buf[off++] = 0x40; buf[off++] = 0x40;            // header
  buf.writeUInt16LE(totalLength, off); off += 2;    // length (LE)
  buf[off++] = version & 0xFF;                      // version

  // Device ID: copy raw 20 bytes exactly as received (like Traccar)
  deviceIdRaw.copy(buf, off, 0, 20); off += 20;

  buf.writeUInt16BE(type, off); off += 2;           // type (BE, like Traccar writeShort)

  if (content && content.length > 0) {
    content.copy(buf, off); off += content.length;
  }

  // CRC16-X25 over bytes [0 .. off-1]
  const crc = crc16X25(buf, 0, off);
  buf.writeUInt16LE(crc, off); off += 2;            // CRC (LE)

  buf[off++] = 0x0D; buf[off++] = 0x0A;            // footer

  return buf;
}

// ─── Frame buffer ───────────────────────────────────────────────────────
// Equivalent to Traccar's LengthFieldBasedFrameDecoder(LE, 1024, 2, 2, -4, 0, true)
// Accumulates TCP stream data and extracts complete Castel frames.
export class CastelFrameBuffer {
  private buffer: Buffer = Buffer.alloc(0);

  /** Append incoming TCP data and return all complete frames extracted. */
  feed(data: Buffer): Buffer[] {
    this.buffer = Buffer.concat([this.buffer, data]);
    const frames: Buffer[] = [];

    while (this.buffer.length >= 4) {
      // Check for 0x4040 header
      if (this.buffer[0] !== 0x40 || this.buffer[1] !== 0x40) {
        // Scan for next 0x4040 header
        let found = false;
        for (let i = 1; i < this.buffer.length - 1; i++) {
          if (this.buffer[i] === 0x40 && this.buffer[i + 1] === 0x40) {
            Logger.warn(`Castel: discarded ${i} bytes before header`);
            this.buffer = this.buffer.subarray(i);
            found = true;
            break;
          }
        }
        if (!found) {
          // No header found, keep last byte (could be first 0x40)
          this.buffer = this.buffer.subarray(this.buffer.length - 1);
          break;
        }
        continue;
      }

      // Read total packet length (little-endian uint16 at offset 2)
      const packetLength = this.buffer.readUInt16LE(2);

      // Sanity check
      if (packetLength < 8 || packetLength > 2048) {
        Logger.warn(`Castel: invalid packet length ${packetLength}, skipping header`);
        this.buffer = this.buffer.subarray(2);
        continue;
      }

      // Wait for complete frame
      if (this.buffer.length < packetLength) {
        break;
      }

      // Extract frame
      const frame = Buffer.from(this.buffer.subarray(0, packetLength));
      this.buffer = this.buffer.subarray(packetLength);
      frames.push(frame);
    }

    return frames;
  }
}

// ─── Parse a complete Castel frame ──────────────────────────────────────
export function parseFrame(frame: Buffer): CastelFrame | null {
  if (frame.length < 31) {
    // Minimum: 2(hdr) + 2(len) + 1(ver) + 20(id) + 2(type) + 2(crc) + 2(footer) = 31
    Logger.debug(`Castel: frame too short (${frame.length} bytes)`);
    return null;
  }

  const version = frame[4];
  const deviceIdBuf = frame.subarray(5, 25);
  const deviceId = deviceIdBuf.toString('ascii').replace(/\0/g, '').trim();
  const type = frame.readUInt16BE(25);

  // Content: between type field and CRC (last 4 bytes = 2 CRC + 2 footer)
  const contentStart = 27;
  const contentEnd = frame.length - 4;
  const content = contentEnd > contentStart ? frame.subarray(contentStart, contentEnd) : Buffer.alloc(0);

  // Validate CRC: computed over [0 .. length-4] (exclude CRC + footer)
  const crcOffset = frame.length - 4;
  const receivedCrc = frame.readUInt16LE(crcOffset);
  const computedCrc = crc16X25(frame, 0, crcOffset);
  const crcValid = receivedCrc === computedCrc;

  // Store raw 20-byte device ID for use in responses (like Traccar's buf.readSlice(20))
  const deviceIdRaw = Buffer.from(deviceIdBuf);

  return { version, deviceId, deviceIdRaw, type, content, raw: frame, crcValid };
}

// ─── Get human-readable message type name ───────────────────────────────
export function getMessageTypeName(type: number): string {
  const names: Record<number, string> = {
    [MSG_SC_LOGIN]: 'SC_LOGIN',
    [MSG_SC_LOGIN_RESPONSE]: 'SC_LOGIN_RESPONSE',
    [MSG_SC_LOGOUT]: 'SC_LOGOUT',
    [MSG_SC_HEARTBEAT]: 'SC_HEARTBEAT',
    [MSG_SC_HEARTBEAT_RESPONSE]: 'SC_HEARTBEAT_RESPONSE',
    [MSG_SC_GPS]: 'SC_GPS',
    [MSG_SC_PID_DATA]: 'SC_PID_DATA',
    [MSG_SC_G_SENSOR]: 'SC_G_SENSOR',
    [MSG_SC_SUPPORTED_PID]: 'SC_SUPPORTED_PID',
    [MSG_SC_OBD_DATA]: 'SC_OBD_DATA',
    [MSG_SC_DTCS_PASSENGER]: 'SC_DTCS_PASSENGER',
    [MSG_SC_ALARM]: 'SC_ALARM',
    [MSG_SC_ALARM_RESPONSE]: 'SC_ALARM_RESPONSE',
    [MSG_SC_CELL]: 'SC_CELL',
    [MSG_SC_GPS_SLEEP]: 'SC_GPS_SLEEP',
    [MSG_SC_DTCS_COMMERCIAL]: 'SC_DTCS_COMMERCIAL',
    [MSG_SC_FUEL]: 'SC_FUEL',
    [MSG_SC_COMPREHENSIVE]: 'SC_COMPREHENSIVE',
    [MSG_SC_AGPS_REQUEST]: 'SC_AGPS_REQUEST',
    [MSG_SC_QUERY_RESPONSE]: 'SC_QUERY_RESPONSE',
    [MSG_SC_CURRENT_LOCATION]: 'SC_CURRENT_LOCATION',
    [MSG_SC_LOGOUT_RESPONSE]: 'SC_LOGOUT_RESPONSE',
    [MSG_SC_HEARTBEAT_V2]: 'SC_HEARTBEAT_V2 (secondary mode)',
    [MSG_SC_HEARTBEAT_V2_RESPONSE]: 'SC_HEARTBEAT_V2_RESPONSE',
  };
  return names[type] || `UNKNOWN_0x${type.toString(16).toUpperCase()}`;
}

// ─── Handle a parsed Castel frame (Traccar: decodeSc) ───────────────────
// Returns a response Buffer to send back, or null if no response needed.
export function handleCastelFrame(frame: CastelFrame): Buffer | null {
  const { version, deviceId, deviceIdRaw, type, content } = frame;

  switch (type) {

    // ── HEARTBEAT → respond with HEARTBEAT_RESPONSE (no content) ──
    case MSG_SC_HEARTBEAT:
      Logger.info(`💓 Heartbeat de ${deviceId}`);
      return buildResponse(version, deviceIdRaw, MSG_SC_HEARTBEAT_RESPONSE);

    // ── HEARTBEAT V2 (0x6001) → respond with standard 0x9003 heartbeat response ──
    // This message type is NOT in Traccar's standard Castel decoder.
    // Strategy: respond with MSG_SC_HEARTBEAT_RESPONSE (0x9003) — the same response
    // Traccar sends for standard 0x1003 heartbeats. The device may accept 0x9003
    // as a valid heartbeat ACK regardless of which heartbeat type it sent.
    case MSG_SC_HEARTBEAT_V2:
      Logger.info(`💓 Heartbeat V2 (0x6001) de ${deviceId} → respondendo com 0x9003 (heartbeat response padrão)`);
      return buildResponse(version, deviceIdRaw, MSG_SC_HEARTBEAT_RESPONSE);

    // ── LOGIN → respond with LOGIN_RESPONSE ──
    // Uses the device's own UTC timestamp from the login packet (content bytes 4-7)
    // to ensure exact timestamp match, as observed in Traccar's successful responses.
    case MSG_SC_LOGIN: {
      // Extract device UTC time from login content (offset 4, 4 bytes LE)
      // Login content: [ACC_ON_time(4)] [UTC_time(4)] [odometer(4)] ...
      let deviceUtcTime: number;
      if (content.length >= 8) {
        deviceUtcTime = content.readUInt32LE(4);
        Logger.info(`🔑 Login de ${deviceId} (v${version}) — UTC do device: 0x${deviceUtcTime.toString(16).toUpperCase()}`);
      } else {
        deviceUtcTime = (Math.floor(Date.now() / 1000)) >>> 0;
        Logger.info(`🔑 Login de ${deviceId} (v${version}) — usando timestamp do servidor (content curto)`);
      }

      const resp = Buffer.alloc(10);
      resp.writeInt32LE(-1, 0);           // 0xFFFFFFFF (login accepted)
      resp.writeUInt16LE(0, 4);           // 0x0000
      resp.writeUInt32LE(deviceUtcTime, 6);  // echo device UTC time (like Traccar)
      return buildResponse(version, deviceIdRaw, MSG_SC_LOGIN_RESPONSE, resp);
    }

    // ── ALARM → respond with ALARM_RESPONSE (echo alarm index) ──
    case MSG_SC_ALARM: {
      Logger.info(`🚨 Alarm de ${deviceId}`);
      if (content.length >= 4) {
        const alarmIndex = content.readInt32LE(0);
        const resp = Buffer.alloc(4);
        resp.writeInt32LE(alarmIndex, 0);
        return buildResponse(version, deviceIdRaw, MSG_SC_ALARM_RESPONSE, resp);
      }
      return null;
    }

    // ── LOGOUT → no response (Traccar behavior: just decode and return null) ──
    case MSG_SC_LOGOUT:
      Logger.info(`👋 Logout de ${deviceId}`);
      return null;

    // ── All other message types: NO response (Traccar behavior) ──
    // ── GPS / Position data → no response (Traccar just decodes and returns Position) ──
    case MSG_SC_GPS:
    case MSG_SC_GPS_SLEEP:
      Logger.info(`📍 GPS [${getMessageTypeName(type)}] de ${deviceId}`);
      return null;

    // ── Query response (0xa002) → no response (device sends VIN/firmware after login) ──
    case MSG_SC_QUERY_RESPONSE:
      Logger.info(`📋 Query response de ${deviceId} (VIN/firmware info)`);
      return null;

    // ── Other data messages → no response ──
    case MSG_SC_PID_DATA:
    case MSG_SC_G_SENSOR:
    case MSG_SC_SUPPORTED_PID:
    case MSG_SC_OBD_DATA:
    case MSG_SC_DTCS_PASSENGER:
    case MSG_SC_DTCS_COMMERCIAL:
    case MSG_SC_CELL:
    case MSG_SC_FUEL:
    case MSG_SC_COMPREHENSIVE:
    case MSG_SC_AGPS_REQUEST:
    case MSG_SC_CURRENT_LOCATION:
      Logger.debug(`📦 Mensagem ${getMessageTypeName(type)} de ${deviceId} (sem resposta)`);
      return null;

    // ── Unknown message types: silently ignore (Traccar: default → null) ──
    default:
      Logger.debug(`❓ Mensagem desconhecida 0x${type.toString(16).toUpperCase()} de ${deviceId} (ignorada)`);
      return null;
  }
}
