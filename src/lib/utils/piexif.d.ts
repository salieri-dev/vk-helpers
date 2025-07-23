declare module 'piexifjs' {
  interface ExifDict {
    "0th": any;
    "Exif": any;
    "GPS": any;
    "1st": any;
    "thumbnail": any;
  }

  interface ImageIFD {
    DateTime: number;
    ImageDescription: number;
    XPComment: number;
    Software: number;
    Artist: number;
  }

  interface ExifIFD {
    DateTimeOriginal: number;
    DateTimeDigitized: number;
   }

  const piexif: {
    ImageIFD: ImageIFD;
    ExifIFD: ExifIFD;
    load(data: string): ExifDict;
    dump(exifDict: ExifDict): string;
    insert(exif: string, jpeg: string): string;
    remove(jpeg: string): string;
  };

  export default piexif;
}