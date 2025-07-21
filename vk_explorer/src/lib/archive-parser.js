import { parseGeolocation } from './exif-writer.js';

/**
 * Parse photo comments from zip file to extract geolocation and additional context
 * @param {JSZip} zipFile - The zip file containing the archive
 * @param {string} photoId - The photo ID to look for comments
 * @param {TextDecoder} decoder - Text decoder for reading files
 * @returns {Promise<Object>} - Object with geolocation and comments
 */
export async function parsePhotoComments(zipFile, photoId, decoder) {
    const commentPath = `photos/photo-comments/${photoId}/comments0.html`;
    const commentFile = zipFile.file(commentPath);
    
    if (!commentFile) {
        return { geolocation: null, comments: [] };
    }

    try {
        const htmlContent = decoder.decode(await commentFile.async('uint8array'));
        const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
        
        const comments = [];
        const geolocation = parseGeolocation(htmlContent);
        
        // Parse individual comments for additional context
        doc.querySelectorAll('.item').forEach(item => {
            const commentText = item.textContent.trim();
            if (commentText) {
                comments.push(commentText);
            }
        });
        
        return { geolocation, comments };
    } catch (error) {
        console.warn(`Failed to parse comments for photo ${photoId}:`, error.message);
        return { geolocation: null, comments: [] };
    }
}

export async function parseAlbumHtml(albumName, htmlContent, zipFile, decoder) {
    const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
    const images = [];
    const sanitizedAlbumName = albumName.replace(/[\<\>:"/\\|?*]/g, ""); // Sanitize for folder names
    
    const itemElements = doc.querySelectorAll('.item');
    
    for (const itemEl of itemElements) {
        const imgEl = itemEl.querySelector('img');
        if (imgEl && imgEl.src) {
            // Extract VK photo URL
            const vkUrlEl = itemEl.querySelector('a[href*="vk.com/photo"]');
            const vkUrl = vkUrlEl ? vkUrlEl.getAttribute('href') : "";
            
            // Extract photo ID from VK URL for comment parsing
            let photoId = null;
            if (vkUrl) {
                const photoMatch = vkUrl.match(/photo\d+_(\d+)/);
                if (photoMatch) {
                    photoId = photoMatch[1];
                }
            }
            
            // Extract date from clear_fix div
            let dateStr = null;
            const dateEl = itemEl.querySelector('.clear_fix');
            if (dateEl) {
                const fullDateStr = dateEl.textContent.trim();
                // Clean date string (remove comments info)
                dateStr = fullDateStr.replace(/\s*Комментарии.*/, '').replace(' в ', ' ').replace(/\s+/g, ' ').trim();
            }
            
            // Extract filename and remove query parameters
            const urlPart = imgEl.src.substring(imgEl.src.lastIndexOf('/') + 1);
            const cleanFilename = urlPart.split('?')[0]; // Remove query parameters
            const finalFilename = `${imgEl.alt || 'photo'}_${cleanFilename}`;
            
            // Try to parse geolocation from the item content first
            let geolocation = parseGeolocation(itemEl.innerHTML);
            
            // If no geolocation found and we have a photo ID, try to parse comments
            if (!geolocation && photoId && zipFile && decoder) {
                const commentData = await parsePhotoComments(zipFile, photoId, decoder);
                if (commentData.geolocation) {
                    geolocation = commentData.geolocation;
                }
            }
            
            images.push({
                url: imgEl.src,
                path: `albums/${sanitizedAlbumName}/${finalFilename}`,
                vkUrl: vkUrl,
                date: dateStr,
                filename: imgEl.alt || 'photo',
                // Enhanced metadata for EXIF
                metadata: {
                    chatName: albumName,
                    sourceType: 'album',
                    geolocation: geolocation
                }
            });
        }
    }
    
    console.log(`- Queued ${images.length} images from album "${albumName}".`);
    return images;
}

export async function parseChatHtml(chatData, decoder) {
    const mediaFiles = [];
    const sanitizedChatName = chatData.name.replace(/[\<\>:"/\\|?*]/g, "");

    for (const file of chatData.files) {
        const htmlContent = decoder.decode(await file.async('uint8array'));
        const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
        
        doc.querySelectorAll('.item').forEach(itemEl => {
            const attachmentLinks = itemEl.querySelectorAll('.attachment__link');
            attachmentLinks.forEach(link => {
                const messageEl = link.closest('.message');
                const messageId = messageEl?.dataset.id || 'unknown';
                
                // Extract date and sender from message header
                let dateStr = null;
                let sender = null;
                const headerEl = messageEl?.querySelector('.message__header');
                if (headerEl) {
                    // Parse sender information
                    const linkEl = headerEl.querySelector('a');
                    if (linkEl) {
                        // If there's a link, the sender name is in the link text
                        sender = linkEl.textContent.trim();
                    } else {
                        // If no link, extract sender from the beginning of the header text
                        const headerText = headerEl.textContent.trim();
                        // Pattern: "Sender, date" - extract sender before the first comma and date
                        const match = headerText.match(/^([^,]+),\s*\d/);
                        if (match) {
                            sender = match[1].trim();
                        } else {
                            // Fallback: take text before the first date pattern
                            const dateMatch = headerText.match(/\d+\s+\w+\s+\d{4}/);
                            if (dateMatch) {
                                sender = headerText.substring(0, dateMatch.index).replace(/,$/, '').trim();
                            }
                        }
                    }
                    
                    // Remove editing info spans and clean up for date extraction
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = headerEl.innerHTML;
                    tempDiv.querySelectorAll('span').forEach(span => span.remove());
                    dateStr = tempDiv.textContent.trim();
                }
                
                // Determine media type and process accordingly
                let mediaType = 'unknown';
                let subPath = '';
                let finalFilename = '';
                
                // Check for images
                if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(link.href)) {
                    mediaType = 'image';
                    subPath = '';
                    const urlPart = link.href.substring(link.href.lastIndexOf('/') + 1);
                    const cleanFilename = urlPart.split('?')[0];
                    finalFilename = `msg_${messageId}_${cleanFilename}`;
                }
                // Check for audio files
                else if (/\.(ogg|mp3|wav|m4a|aac|flac)(\?|$)/i.test(link.href)) {
                    mediaType = 'audio';
                    subPath = 'audio/';
                    const urlPart = link.href.substring(link.href.lastIndexOf('/') + 1);
                    const cleanFilename = urlPart.split('?')[0];
                    finalFilename = `msg_${messageId}_${cleanFilename}`;
                }
                
                // Try to parse geolocation from the message content
                const geolocation = parseGeolocation(itemEl.innerHTML);
                
                // Only add if we recognized the media type
                if (mediaType !== 'unknown') {
                    mediaFiles.push({
                        url: link.href,
                        path: `chats/${sanitizedChatName}/${subPath}${finalFilename}`,
                        messageId: messageId,
                        date: dateStr,
                        filename: finalFilename,
                        mediaType: mediaType,
                        // Enhanced metadata for EXIF
                        metadata: {
                            chatName: chatData.name,
                            sender: sender,
                            sourceType: 'chat',
                            geolocation: geolocation
                        }
                    });
                }
            });
        });
    }
    
    const imageCount = mediaFiles.filter(f => f.mediaType === 'image').length;
    const audioCount = mediaFiles.filter(f => f.mediaType === 'audio').length;
    
    console.log(`- Queued ${mediaFiles.length} media files from chat "${chatData.name}" (${imageCount} images, ${audioCount} audio).`);
    return mediaFiles;
}