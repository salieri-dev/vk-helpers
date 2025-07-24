import type { Message } from './messageParser';

const emojiRegex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff])[\ufe0e\ufe0f]?(?:[\u0300-\u036f\ufe20-\ufe23\u20d0-\u20f0]|\ud83c[\udffb-\udfff])?(?:\u200d(?:[^\u0000-\u007f]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff])[\ufe0e\ufe0f]?(?:[\u0300-\u036f\ufe20-\ufe23\u20d0-\u20f0]|\ud83c[\udffb-\udfff])?)*/g;

export const getEmojiStats = (messages: Message[]) => {
	const emojiMap = new Map<string, number>();

	for (const message of messages) {
		const emojis = message.content.match(emojiRegex);
		if (emojis) {
			for (const emoji of emojis) {
				emojiMap.set(emoji, (emojiMap.get(emoji) || 0) + 1);
			}
		}
	}

	return emojiMap;
};