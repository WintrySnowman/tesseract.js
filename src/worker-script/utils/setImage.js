const bmp = require('bmp-js');

// Maintain the most-recently-used buffer in memory,
// which will be freed on the next call to setImage(),
// or when the worker shuts down.
let pixBuffer = null;

/**
 * setImage
 *
 * @name setImage
 * @function set image in tesseract for recognition
 * @access public
 */
module.exports = (TessModule, api, image, angle = 0) => {
  // Free any previous buffer
  if (pixBuffer !== null) {
    TessModule._free(pixBuffer);
    pixBuffer = null;
  }

  // For performance, allow the use of ImageData directly.
  // However, note that ImageData byte order is RGBA, whilst
  // Leptonica pix is BGRA. This should not matter for OCR
  // purposes, so we'll skip any extra transformation steps.
  // Reference: https://github.com/DanBloomberg/leptonica/blob/76c635ceeebcb78ecd22807171c2e2c21c58e05f/src/pix_internal.h#L213
  if (typeof ImageData !== 'undefined' && image instanceof ImageData) {
    if (angle != 0) throw Error('Non-zero angles unsupported when using ImageData');

    pixBuffer = TessModule._malloc(image.data.byteLength);
    TessModule.HEAPU8.set(image.data, pixBuffer);
    api.SetImage(pixBuffer, image.width, image.height, 4, image.width * 4);
    return;
  }

  // Check for bmp magic numbers (42 and 4D in hex)
  const isBmp = (image[0] === 66 && image[1] === 77) || (image[1] === 66 && image[0] === 77);

  const exif = parseInt(image.slice(0, 500).join(' ').match(/1 18 0 3 0 0 0 1 0 (\d)/)?.[1], 10) || 1;

  // /*
  //  * Leptonica supports some but not all bmp files
  //  * @see https://github.com/DanBloomberg/leptonica/issues/607#issuecomment-1068802516
  //  * We therefore use bmp-js to convert all bmp files into a format Leptonica is known to support
  //  */
  if (isBmp) {
    // Not sure what this line actually does, but removing breaks the function
    const buf = Buffer.from(Array.from({ ...image, length: Object.keys(image).length }));
    const bmpBuf = bmp.decode(buf);
    TessModule.FS.writeFile('/input', bmp.encode(bmpBuf).data);
  } else {
    TessModule.FS.writeFile('/input', image);
  }

  const res = api.SetImageFile(exif, angle);
  if (res === 1) throw Error('Error attempting to read image.');
};
