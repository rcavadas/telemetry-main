/**
 * Login Reply - Converted from Java
 * Creates login response packets for Sinocastel OBD protocol
 */
export class LoginReply {
  private static readonly HEX_CODE = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
  private static readonly START = '0x4040';
  private static readonly VERSION = '0x04';
  private static readonly DEFAULT_DEVICE_ID = '0x323133474C323031363030303137320000000000';
  private static readonly END = '0x0D0A';
  private static readonly PACKAGE_LENGTH = '0x2900'; // Fixed login response package length

  public static loginReply(deviceId?: string): Buffer {
    const length = this.hexStringToBytes(this.PACKAGE_LENGTH);
    const head = this.hexStringToBytes(this.START);
    const version = this.hexStringToBytes(this.VERSION);
    const deviceIdBytes = deviceId ? 
      this.stringToDeviceIdBytes(deviceId) : 
      this.hexStringToBytes(this.DEFAULT_DEVICE_ID);
    const order = this.hexStringToBytes('0x9001');
    const end = this.hexStringToBytes(this.END);
    const can1 = this.hexStringToBytes('0xFFFFFFFF');
    const can2 = this.hexStringToBytes('0x0000');
    const utc = this.hexStringToBytes('0x' + this.getHexStringUTC());

    // Assemble the packet
    const psrc = Buffer.alloc(37);
    let offset = 0;

    head.copy(psrc, offset);
    offset += head.length;

    length.copy(psrc, offset);
    offset += length.length;

    version.copy(psrc, offset);
    offset += version.length;

    deviceIdBytes.copy(psrc, offset);
    offset += deviceIdBytes.length;

    order.copy(psrc, offset);
    offset += order.length;

    can1.copy(psrc, offset);
    offset += can1.length;

    can2.copy(psrc, offset);
    offset += can2.length;

    utc.copy(psrc, offset);

    // Calculate CRC (simplified - would need actual CRC64 implementation)
    const crcString = this.calculateSimpleCRC(psrc);
    const dscCrc = crcString.substring(crcString.length - 2) + crcString.substring(0, crcString.length - 2);
    const crcBytes = this.hexStringToBytes('0x' + dscCrc);

    // Final packet assembly
    const finalBuffer = Buffer.alloc(41);
    psrc.copy(finalBuffer, 0);
    crcBytes.copy(finalBuffer, psrc.length);
    end.copy(finalBuffer, psrc.length + crcBytes.length);

    return finalBuffer;
  }

  private static getHexStringUTC(): string {
    const now = Math.floor(Date.now() / 1000);
    const asc = now.toString(16).padStart(8, '0');
    
    // Reverse byte order (little endian)
    const desc = asc.substring(asc.length - 2) +
                 asc.substring(asc.length - 4, asc.length - 2) +
                 asc.substring(asc.length - 6, asc.length - 4) +
                 asc.substring(0, 2);
    
    return desc;
  }

  private static calculateSimpleCRC(buffer: Buffer): string {
    // Simplified CRC calculation - should use proper CRC64
    let crc = 0;
    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i];
      crc = ((crc << 1) | (crc >>> 7)) & 0xFF;
    }
    return crc.toString(16).padStart(4, '0');
  }

  private static stringToDeviceIdBytes(deviceId: string): Buffer {
    // Convert device ID string to 20-byte buffer (padded with zeros)
    const buffer = Buffer.alloc(20);
    const deviceBuffer = Buffer.from(deviceId, 'ascii');
    deviceBuffer.copy(buffer, 0, 0, Math.min(deviceBuffer.length, 20));
    return buffer;
  }

  public static hexStringToBytes(hexString: string): Buffer {
    if (!hexString) {
      return Buffer.alloc(0);
    }
    
    const cleaned = hexString.toUpperCase().replace('0X', '');
    return Buffer.from(cleaned, 'hex');
  }

  private static charToByte(c: string): number {
    return '0123456789ABCDEF'.indexOf(c);
  }

  public static byteToHexString(b: number): string {
    const buffer = Buffer.alloc(2);
    buffer[0] = this.HEX_CODE[(b >>> 4) & 0x0f].charCodeAt(0);
    buffer[1] = this.HEX_CODE[b & 0x0f].charCodeAt(0);
    return buffer.toString();
  }

  public static intToBytes(number: number): Buffer {
    const buffer = Buffer.alloc(4);
    buffer[0] = 0xff & number;
    buffer[1] = (0xff00 & number) >> 8;
    buffer[2] = (0xff0000 & number) >> 16;
    buffer[3] = (0xff000000 & number) >> 24;
    return buffer;
  }

  // Create different types of responses
  public static createLoginResponse(deviceId: string): Buffer {
    console.log(`Creating login response for device: ${deviceId}`);
    return this.loginReply(deviceId);
  }

  public static createHeartbeatResponse(): Buffer {
    // Simplified heartbeat response
    const response = '@@\x00\x04\x01\r\n';
    return Buffer.from(response, 'binary');
  }

  public static createDataAckResponse(): Buffer {
    // Simplified data acknowledgment
    const response = '@@\x00\x04\x02\r\n';
    return Buffer.from(response, 'binary');
  }
} 