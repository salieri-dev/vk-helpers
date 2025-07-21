import piexif from 'piexifjs';

/**
 * Enhanced EXIF data writer with support for chat/album information and geolocation
 * @param {Blob} imageBlob - The image blob to add EXIF data to
 * @param {Date} parsedDate - The parsed date for the image
 * @param {string} imageName - The name of the image file
 * @param {Object} metadata - Additional metadata for EXIF
 * @param {string} metadata.chatName - Name of the chat or album
 * @param {string} metadata.sender - Name of the sender (for chat messages)
 * @param {string} metadata.sourceType - 'chat' or 'album'
 * @param {Object} metadata.geolocation - GPS coordinates if available
 * @param {number} metadata.geolocation.latitude - Latitude in decimal degrees
 * @param {number} metadata.geolocation.longitude - Longitude in decimal degrees
 * @param {number} metadata.geolocation.altitude - Altitude in meters (optional)
 */
export async function addExifData(imageBlob, parsedDate, imageName, metadata = {}) {
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

        // Create user comment with chat/album and sender information
        let userComment = '';
        if (metadata.sourceType === 'chat' && metadata.chatName) {
            userComment = `Source: VK Chat '${metadata.chatName}'`;
            if (metadata.sender) {
                userComment += `. Sender: ${metadata.sender}`;
            }
        } else if (metadata.sourceType === 'album' && metadata.chatName) {
            userComment = `Source: VK Album '${metadata.chatName}'`;
        }

        // Construct the EXIF data object using piexif constants for readability.
        const exifDict = {
            "0th": {
                [piexif.ImageIFD.DateTime]: exifDate,
                [piexif.ImageIFD.ImageDescription]: userComment
            },
            "Exif": {
                [piexif.ExifIFD.DateTimeOriginal]: exifDate,
                [piexif.ExifIFD.DateTimeDigitized]: exifDate
            },
            "GPS": {},
            "1st": {},
            "thumbnail": null
        };

        // Add user comment to EXIF if available
        if (userComment) {
            // Convert string to bytes for UserComment (format: encoding + comment)
            const commentBytes = new TextEncoder().encode(userComment);
            const userCommentData = new Uint8Array(8 + commentBytes.length);
            // First 8 bytes are encoding identifier for ASCII
            userCommentData.set([0x41, 0x53, 0x43, 0x49, 0x49, 0x00, 0x00, 0x00], 0);
            userCommentData.set(commentBytes, 8);
            exifDict.Exif[piexif.ExifIFD.UserComment] = userCommentData;
        }

        // Add GPS data if geolocation is provided
        if (metadata.geolocation && metadata.geolocation.latitude && metadata.geolocation.longitude) {
            const { latitude, longitude, altitude } = metadata.geolocation;
            
            // Convert decimal degrees to degrees, minutes, seconds format for GPS
            function decimalToDMS(decimal) {
                const degrees = Math.floor(Math.abs(decimal));
                const minutesFloat = (Math.abs(decimal) - degrees) * 60;
                const minutes = Math.floor(minutesFloat);
                const seconds = (minutesFloat - minutes) * 60;
                
                return [
                    [degrees, 1],
                    [Math.round(minutes), 1],
                    [Math.round(seconds * 100), 100]  // Store seconds with 2 decimal precision
                ];
            }

            exifDict.GPS = {
                [piexif.GPSIFD.GPSVersionID]: [2, 3, 0, 0],
                [piexif.GPSIFD.GPSLatitudeRef]: latitude >= 0 ? 'N' : 'S',
                [piexif.GPSIFD.GPSLatitude]: decimalToDMS(latitude),
                [piexif.GPSIFD.GPSLongitudeRef]: longitude >= 0 ? 'E' : 'W',
                [piexif.GPSIFD.GPSLongitude]: decimalToDMS(longitude)
            };

            // Add altitude if provided
            if (altitude !== undefined) {
                exifDict.GPS[piexif.GPSIFD.GPSAltitudeRef] = altitude >= 0 ? 0 : 1; // 0 for above sea level, 1 for below
                exifDict.GPS[piexif.GPSIFD.GPSAltitude] = [Math.abs(Math.round(altitude * 100)), 100]; // Store with 2 decimal precision
            }
        }
        
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

/**
 * Parse geolocation data from VK photo comments or metadata
 * @param {string} htmlContent - HTML content that might contain location data
 * @returns {Object|null} - Geolocation object or null if not found
 */
export function parseGeolocation(htmlContent) {
    if (!htmlContent) return null;
    
    // Look for common patterns that might indicate GPS coordinates
    // VK sometimes includes coordinates in various formats
    const coordPatterns = [
        // Decimal degrees: lat,lng or lat, lng
        /(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/g,
        // Degrees minutes seconds patterns
        /(\d+)°\s*(\d+)['′]\s*(\d+\.?\d*)["″]?\s*([NSEW])/gi
    ];
    
    for (const pattern of coordPatterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        for (const match of matches) {
            let lat, lng;
            
            if (pattern === coordPatterns[0]) {
                // Decimal degrees format
                lat = parseFloat(match[1]);
                lng = parseFloat(match[2]);
                
                // Basic validation for reasonable coordinate ranges
                if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    return { latitude: lat, longitude: lng };
                }
            }
            // Add more coordinate format parsing as needed
        }
    }
    
    return null;
}