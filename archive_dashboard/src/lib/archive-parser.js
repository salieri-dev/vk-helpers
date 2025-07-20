export function parseAlbumHtml(albumName, htmlContent) {
    const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
    const images = [];
    const sanitizedAlbumName = albumName.replace(/[\<\>:"/\\|?*]/g, ""); // Sanitize for folder names
    
    doc.querySelectorAll('.item').forEach(itemEl => {
        const imgEl = itemEl.querySelector('img');
        if (imgEl && imgEl.src) {
            // Extract VK photo URL
            const vkUrlEl = itemEl.querySelector('a[href*="vk.com/photo"]');
            const vkUrl = vkUrlEl ? vkUrlEl.getAttribute('href') : "";
            
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
            
            images.push({
                url: imgEl.src,
                path: `albums/${sanitizedAlbumName}/${finalFilename}`,
                vkUrl: vkUrl,
                date: dateStr,
                filename: imgEl.alt || 'photo'
            });
        }
    });
    console.log(`- Queued ${images.length} images from album "${albumName}".`);
    return images;
}

export async function parseChatHtml(chatData, decoder) {
    const mediaFiles = [];
    const sanitizedChatName = chatData.name.replace(/[\<\>:"/\\|?*]/g, "");

    for (const file of chatData.files) {
        const doc = new DOMParser().parseFromString(decoder.decode(await file.async('uint8array')), 'text/html');
        doc.querySelectorAll('.item').forEach(itemEl => {
            const attachmentLinks = itemEl.querySelectorAll('.attachment__link');
            attachmentLinks.forEach(link => {
                const messageEl = link.closest('.message');
                const messageId = messageEl?.dataset.id || 'unknown';
                
                // Extract date from message header
                let dateStr = null;
                const headerEl = messageEl?.querySelector('.message__header');
                if (headerEl) {
                    // Remove editing info spans and clean up
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
                
                // Only add if we recognized the media type
                if (mediaType !== 'unknown') {
                    mediaFiles.push({
                        url: link.href,
                        path: `chats/${sanitizedChatName}/${subPath}${finalFilename}`,
                        messageId: messageId,
                        date: dateStr,
                        filename: finalFilename,
                        mediaType: mediaType
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