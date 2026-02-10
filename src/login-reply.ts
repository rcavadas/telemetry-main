/**
 * Login Reply - Rewritten to match Traccar's CastelProtocolDecoder
 * Uses CRC16-X25 checksum (same as Traccar)
 *
 * Packet structure (Traccar reference: CastelProtocolDecoder.sendResponse):
 *   [0x40 0x40]           - Header (2 bytes)
 *   [length LE]           - Total packet length (2 bytes, little-endian)
 *   [version]             - Protocol version (1 byte)
 *   [deviceId]            - Device ID (20 bytes, ASCII, zero-padded)
 *   [type]                - Message type (2 bytes, big-endian: 0x9001 for login response)
 *   [content]             - Payload (variable length)
 *   [crc16 LE]            - CRC16-X25 over bytes 0..writerIndex (2 bytes, little-endian)
 *   [0x0D 0x0A]           - Footer (2 bytes)
 */
export class LoginReply {

  // ─── CRC16-X25 lookup table ───────────────────────────────────────────
  // Polynomial 0x1021, init 0xFFFF, refIn true, refOut true, xorOut 0xFFFF
  // (same algorithm used by Traccar: Checksum.CRC16_X25)
  private static readonly CRC_TABLE: number[] = (() => {
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

  private static reverse(value: number, bits: number): number {
    let result = 0;
    for (let i = 0; i < bits; i++) {
      result = (result << 1) | (value & 1);
      value >>>= 1;
    }
    return result;
  }

  /**
   * CRC16-X25 calculation — exact match to Traccar's Checksum.crc16(CRC16_X25, ...)
   *
   * Algorithm parameters:
   *   poly=0x1021, init=0xFFFF, refIn=true, refOut=true, xorOut=0xFFFF
   */
  static crc16X25(buf: Buffer, offset: number = 0, length?: number): number {
    const end = offset + (length ?? buf.length - offset);
    let crc = 0xFFFF; // init

    for (let i = offset; i < end; i++) {
      let b = buf[i] & 0xFF;
      // refIn = true → reverse each input byte
      b = this.reverse(b, 8);
      crc = ((crc << 8) ^ this.CRC_TABLE[((crc >>> 8) & 0xFF) ^ b]) & 0xFFFF;
    }

    // refOut = true → reverse output
    crc = this.reverse(crc, 16);
    // xorOut = 0xFFFF
    return (crc ^ 0xFFFF) & 0xFFFF;
  }

  // ─── Message types ────────────────────────────────────────────────────
  private static readonly MSG_SC_LOGIN_RESPONSE = 0x9001;
  private static readonly MSG_SC_HEARTBEAT_RESPONSE = 0x9003;

  // ─── Build a generic Castel-style response ────────────────────────────
  /**
   * Assemble a response packet exactly like Traccar's
   * CastelProtocolDecoder.sendResponse(channel, remoteAddress, version, id, type, content)
   */
  private static buildResponse(version: number, deviceId: string, type: number, content?: Buffer): Buffer {
    // Calculate total length:
    //   2 (header) + 2 (length) + 1 (version) + 20 (deviceId) + 2 (type) + content + 2 (crc) + 2 (footer)
    const contentLen = content ? content.length : 0;
    const totalLength = 2 + 2 + 1 + 20 + 2 + contentLen + 2 + 2;

    const buf = Buffer.alloc(totalLength);
    let offset = 0;

    // Header: 0x40 0x40
    buf[offset++] = 0x40;
    buf[offset++] = 0x40;

    // Length: little-endian
    buf.writeUInt16LE(totalLength, offset);
    offset += 2;

    // Version
    buf[offset++] = version & 0xFF;

    // Device ID: 20 bytes ASCII, zero-padded
    const idBuf = Buffer.alloc(20, 0);
    Buffer.from(deviceId, 'ascii').copy(idBuf, 0, 0, Math.min(deviceId.length, 20));
    idBuf.copy(buf, offset);
    offset += 20;

    // Message type: big-endian (Traccar writes with writeShort = big-endian)
    buf.writeUInt16BE(type, offset);
    offset += 2;

    // Content
    if (content && content.length > 0) {
      content.copy(buf, offset);
      offset += content.length;
    }

    // CRC16-X25 over everything written so far (bytes 0 .. offset-1)
    const crc = this.crc16X25(buf, 0, offset);
    buf.writeUInt16LE(crc, offset);
    offset += 2;

    // Footer: 0x0D 0x0A
    buf[offset++] = 0x0D;
    buf[offset++] = 0x0A;

    return buf;
  }

  // ─── Public API ───────────────────────────────────────────────────────

  /**
   * Create login response — exact replica of Traccar's handling of MSG_SC_LOGIN:
   *
   *   ByteBuf response = Unpooled.buffer(10);
   *   response.writeIntLE(0xFFFFFFFF);
   *   response.writeShortLE(0);
   *   response.writeIntLE((int)(System.currentTimeMillis() / 1000));
   *   sendResponse(channel, remoteAddress, version, id, MSG_SC_LOGIN_RESPONSE, response);
   */
  static createLoginResponse(deviceId: string, version: number = 4): Buffer {
    const content = Buffer.alloc(10);
    let off = 0;

    // 0xFFFFFFFF (4 bytes, little-endian)
    content.writeInt32LE(-1, off);  // 0xFFFFFFFF as signed = -1
    off += 4;

    // 0x0000 (2 bytes, little-endian)
    content.writeUInt16LE(0, off);
    off += 2;

    // Unix timestamp (4 bytes, little-endian)
    const now = Math.floor(Date.now() / 1000);
    content.writeUInt32LE(now >>> 0, off);

    return this.buildResponse(version, deviceId, this.MSG_SC_LOGIN_RESPONSE, content);
  }

  /**
   * Create heartbeat response (MSG_SC_HEARTBEAT_RESPONSE = 0x9003)
   * Traccar sends an empty-content response for heartbeats.
   */
  static createHeartbeatResponse(deviceId: string, version: number = 4): Buffer {
    return this.buildResponse(version, deviceId, this.MSG_SC_HEARTBEAT_RESPONSE);
  }

  /**
   * Create data acknowledgment for any received data packet.
   * Mirrors the login response structure but can be used as a generic ACK.
   */
  static createDataAckResponse(deviceId?: string, version: number = 4): Buffer {
    if (deviceId) {
      // Full Castel-style ACK with proper CRC
      const content = Buffer.alloc(10);
      content.writeInt32LE(-1, 0);    // 0xFFFFFFFF
      content.writeUInt16LE(0, 4);    // 0x0000
      content.writeUInt32LE((Math.floor(Date.now() / 1000)) >>> 0, 6);
      return this.buildResponse(version, deviceId, this.MSG_SC_LOGIN_RESPONSE, content);
    }
    // Minimal ACK fallback (when deviceId is unknown)
    const buf = Buffer.alloc(8);
    buf[0] = 0x40; buf[1] = 0x40; // header
    buf.writeUInt16LE(8, 2);       // length = 8 (LE)
    buf[4] = version;              // version
    buf[5] = 0x02;                 // ack flag
    buf[6] = 0x0D; buf[7] = 0x0A; // footer
    return buf;
  }
}
