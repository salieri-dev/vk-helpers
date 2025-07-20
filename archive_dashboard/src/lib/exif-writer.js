import piexif from 'piexifjs';

export async function addExifData(imageBlob, parsedDate, imageName) {
    if (!parsedDate || !window.piexif) {
        return imageBlob;
    }

    try {
        // Use FileReader to safely convert the blob to a Data URL.
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(new Error(`FileReader error: ${error.message}`));
            reader.readAsDataURL(imageBlob);
        });

        // EXIF data can only be written to JPEG files.
        if (!dataUrl.startsWith('data:image/jpeg')) {
            return imageBlob; // Not a JPEG, return original blob.
        }

        // Format date for EXIF (YYYY:MM:DD HH:MM:SS)
        const exifDate = parsedDate.getFullYear() + ':' +
            (parsedDate.getMonth() + 1).toString().padStart(2, '0') + ':' +
            parsedDate.getDate().toString().padStart(2, '0') + ' ' +
            parsedDate.getHours().toString().padStart(2, '0') + ':' +
            parsedDate.getMinutes().toString().padStart(2, '0') + ':' +
            parsedDate.getSeconds().toString().padStart(2, '0');

        // Construct the EXIF data object using piexif constants for readability.
        const exifDict = {
            "0th": {
                [piexif.ImageIFD.DateTime]: exifDate
            },
            "Exif": {
                [piexif.ExifIFD.DateTimeOriginal]: exifDate,
                [piexif.ExifIFD.DateTimeDigitized]: exifDate
            },
             "GPS": {},
             "1st": {},
             "thumbnail": null
        };
        
        const exifBytes = piexif.dump(exifDict);

        // Insert new EXIF data into the image's Data URL.
        const newImageDataUrl = piexif.insert(exifBytes, dataUrl);

        // Convert the new Data URL back to a Blob efficiently using fetch.
        const response = await fetch(newImageDataUrl);
        return await response.blob();

    } catch (error) {
        console.warn(`Failed to add EXIF data to ${imageName}: ${error.message}`);
        return imageBlob; // Return original blob on any error.
    }
}