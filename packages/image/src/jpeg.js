// Extracted from https://github.com/devongovett/pdfkit/blob/master/lib/image/jpeg.coffee

const SIZE_MARKERS = [
  0xffc0,
  0xffc1,
  0xffc2,
  0xffc3,
  0xffc5,
  0xffc6,
  0xffc7,
  0xffc8,
  0xffc9,
  0xffca,
  0xffcb,
  0xffcc,
  0xffcd,
  0xffce,
  0xffcf,
];

const Marker = {
  JPEG: 0xffd8,
  APP1: 0xffe1,
  EXIF: 0x45786966,
  TIFF: 0x4949,
  Orientation: 0x0112,
  Unknown: 0xff00,
};

const getUint16 = (buffer, offset, little = false) =>
  little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
const getUint32 = (buffer, offset, little = false) =>
  little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);

class JPEG {
  data = null;

  width = null;

  height = null;

  constructor(data) {
    this.data = data;

    if (getUint16(this.data, 0) !== Marker.JPEG) {
      throw new Error('SOI not found in JPEG');
    }

    let marker;
    let offset = 2;

    // we don't need to read the entire file to get the image metadata
    const maxScanLength = Math.min(64 * 1024, data.length);

    while (offset < maxScanLength) {
      marker = getUint16(this.data, offset);
      offset += 2;
      if (SIZE_MARKERS.includes(marker)) {
        // read the image size

        this.height = getUint16(this.data, offset + 3);
        this.width = getUint16(this.data, offset + 5);
        // There's our APP1 Marker
      } else if (marker === Marker.APP1) {
        let exifOffset = offset + 2;

        if (getUint32(this.data, exifOffset) === Marker.EXIF) {
          // Get TIFF Header
          const little =
            getUint16(this.data, (exifOffset += 6)) === Marker.TIFF;
          exifOffset += getUint32(this.data, exifOffset + 4, little);

          const tags = getUint16(this.data, exifOffset, little);
          exifOffset += 2;

          // eslint-disable-next-line no-plusplus
          for (let i = 0; i < tags; i++) {
            // found the orientation tag
            if (
              getUint16(this.data, exifOffset + i * 12, little) ===
              Marker.Orientation
            ) {
              this.orientation = getUint16(
                this.data,
                exifOffset + i * 12 + 8,
                little,
              );
              break;
            }
          }
        }
      }

      if (this.width && this.height && this.orientation) {
        // all parsed
        break;
      } else {
        offset += getUint16(this.data, offset);
      }
    }

    if (!this.width || !this.height) {
      throw new Error('Invalid JPEG.');
    }

    if (this.orientation > 4) {
      // swap dimensions
      [this.width, this.height] = [this.height, this.width];
    }
  }

  getImageOrientation() {
    return this.orientation ?? -1;
  }

  static isValid(data) {
    if (!data || !Buffer.isBuffer(data) || data.readUInt16BE(0) !== 0xffd8) {
      return false;
    }

    let marker;
    let pos = 2;

    while (pos < data.length) {
      marker = data.readUInt16BE(pos);
      pos += 2;
      if (SIZE_MARKERS.includes(marker)) {
        break;
      }
      pos += data.readUInt16BE(pos);
    }

    if (!SIZE_MARKERS.includes(marker)) {
      return false;
    }

    return true;
  }
}

export default JPEG;
