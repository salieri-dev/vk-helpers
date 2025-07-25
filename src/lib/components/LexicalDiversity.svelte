<script lang="ts">

  interface ChatAnalytics {
    messages: Array<{
      id: string;
      sender: string;
      isFromUser: boolean;
      timestamp: Date;
      content: string;
      hasAttachment: boolean;
      attachmentInfo: string;
      attachmentLinks: string[];
      edited: boolean;
    }>;
    chatName: string;
  }

  interface LexicalData {
    chatName: string;
    yourTTR: number;
    theirTTR: number;
    yourUniqueWords: number;
    theirUniqueWords: number;
    yourTotalWords: number;
    theirTotalWords: number;
    totalMessages: number;
    yourVocabularyRichness: string;
    theirVocabularyRichness: string;
    comparisonText: string;
  }

  export let analytics: ChatAnalytics[];
  export let currentUserId: number | null = null;

  // Calculate lexical diversity for each chat
  $: lexicalData = processLexicalDiversity(analytics);
  $: hasData = lexicalData.length > 0;

  function processLexicalDiversity(data: ChatAnalytics[]): LexicalData[] {
    return data.map(chat => {
      const messages = (chat.messages || []).sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const yourWords: string[] = [];
      const theirWords: string[] = [];

      messages.forEach(message => {
        const isFromYou = determineIfFromUser(message, currentUserId);
        const messageText = message.content || '';
        const words = extractWords(messageText);
        
        if (words.length > 0) {
          if (isFromYou) {
            yourWords.push(...words);
          } else {
            theirWords.push(...words);
          }
        }
      });

      // Calculate unique words and TTR
      const yourUniqueWords = new Set(yourWords.map(w => w.toLowerCase())).size;
      const theirUniqueWords = new Set(theirWords.map(w => w.toLowerCase())).size;
      const yourTotalWords = yourWords.length;
      const theirTotalWords = theirWords.length;

      const yourTTR = yourTotalWords > 0 ? yourUniqueWords / yourTotalWords : 0;
      const theirTTR = theirTotalWords > 0 ? theirUniqueWords / theirTotalWords : 0;

      return {
        chatName: chat.chatName,
        yourTTR,
        theirTTR,
        yourUniqueWords,
        theirUniqueWords,
        yourTotalWords,
        theirTotalWords,
        totalMessages: messages.length,
        yourVocabularyRichness: formatTTR(yourTTR),
        theirVocabularyRichness: formatTTR(theirTTR),
        comparisonText: createComparisonText(yourTTR, theirTTR)
      };
    }).filter(data => data.totalMessages > 0 && (data.yourTotalWords > 0 || data.theirTotalWords > 0));
  }

  function determineIfFromUser(message: any, userId: number | null): boolean {
    // The Message interface has isFromUser as a required boolean property
    return message.isFromUser;
  }

  function extractWords(text: string): string[] {
    if (!text) return [];
    
    // Remove common punctuation and split by whitespace
    return text
      .replace(/[.,!?;:()[\]{}"'`~@#$%^&*+=<>\/\\|_-]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
      .filter(word => !/^\d+$/.test(word)); // Filter out pure numbers
  }

  function formatTTR(ttr: number): string {
    return ttr.toFixed(3);
  }

  function createComparisonText(yourTTR: number, theirTTR: number): string {
    if (yourTTR === 0 && theirTTR === 0) {
      return "No vocabulary data available";
    }
    
    if (yourTTR === 0) {
      return `Them: ${formatTTR(theirTTR)} (You have no messages)`;
    }
    
    if (theirTTR === 0) {
      return `You: ${formatTTR(yourTTR)} (They have no messages)`;
    }

    const difference = Math.abs(yourTTR - theirTTR);
    const higherUser = yourTTR > theirTTR ? "You" : "They";
    const percentDiff = ((difference / Math.min(yourTTR, theirTTR)) * 100);

    if (difference < 0.01) {
      return "Very similar vocabulary diversity";
    } else if (percentDiff > 50) {
      return `${higherUser} use significantly more varied vocabulary`;
    } else if (percentDiff > 20) {
      return `${higherUser} use more varied vocabulary`;
    } else {
      return "Similar vocabulary diversity";
    }
  }

  function getTTRLevel(ttr: number): string {
    if (ttr >= 0.7) return "Very High";
    if (ttr >= 0.5) return "High";
    if (ttr >= 0.3) return "Medium";
    if (ttr >= 0.1) return "Low";
    return "Very Low";
  }

  function getTTRColor(ttr: number): string {
    if (ttr >= 0.5) return "#27ae60"; // Green for high diversity
    if (ttr >= 0.3) return "#f39c12"; // Orange for medium diversity
    return "#e74c3c"; // Red for low diversity
  }

</script>

<div class="lexical-diversity">
  <div class="header">
    <h3>⭐ Lexical Diversity (Vocabulary Richness)</h3>
    <p class="description">How complex is the language you use with different people?</p>
  </div>

  {#if hasData}
    <div class="stats-list">
      {#each lexicalData.slice(0, 8) as chat}
        <div class="diversity-item">
          <div class="chat-info">
            <span class="chat-name">{chat.chatName}</span>
            <span class="total-words">{(chat.yourTotalWords + chat.theirTotalWords).toLocaleString()} words</span>
          </div>
          
          <div class="ttr-comparison">
            <div class="ttr-bars">
              <div class="ttr-bar your-bar">
                <div class="ttr-label">You</div>
                <div class="ttr-visual" style="width: {Math.max(chat.yourTTR * 200, 5)}px; background-color: {getTTRColor(chat.yourTTR)}"></div>
                <div class="ttr-value" style="color: {getTTRColor(chat.yourTTR)}">{chat.yourVocabularyRichness}</div>
              </div>
              <div class="ttr-bar their-bar">
                <div class="ttr-label">Them</div>
                <div class="ttr-visual" style="width: {Math.max(chat.theirTTR * 200, 5)}px; background-color: {getTTRColor(chat.theirTTR)}"></div>
                <div class="ttr-value" style="color: {getTTRColor(chat.theirTTR)}">{chat.theirVocabularyRichness}</div>
              </div>
            </div>
            
            <div class="comparison-text">{chat.comparisonText}</div>
          </div>
          
          <div class="word-stats">
            <span class="stat-item">
              <span class="stat-label">Your unique:</span>
              <span class="stat-value">{chat.yourUniqueWords.toLocaleString()}</span>
            </span>
            <span class="stat-item">
              <span class="stat-label">Their unique:</span>
              <span class="stat-value">{chat.theirUniqueWords.toLocaleString()}</span>
            </span>
          </div>
        </div>
      {/each}
    </div>
    
    <div class="explanation">
      <h4>What is Type-Token Ratio (TTR)?</h4>
      <p>TTR = Unique Words ÷ Total Words. Higher numbers mean more varied vocabulary:</p>
      <div class="ttr-legend">
        <span class="legend-item"><span class="legend-color" style="background: #27ae60;"></span>0.5+ Very High</span>
        <span class="legend-item"><span class="legend-color" style="background: #f39c12;"></span>0.3+ Medium</span>
        <span class="legend-item"><span class="legend-color" style="background: #e74c3c;"></span>&lt;0.3 Low</span>
      </div>
    </div>
  {:else}
    <div class="no-data">
      <div class="no-data-icon">📚</div>
      <h4>No Vocabulary Data Available</h4>
      <p>No conversations found to analyze lexical diversity.</p>
    </div>
  {/if}
</div>

<style>
  .lexical-diversity {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    width: 100%;
    overflow: hidden;
  }

  .header {
    text-align: center;
    margin-bottom: 1rem;
  }

  .header h3 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 1.2rem;
  }

  .description {
    margin: 0;
    font-size: 0.85rem;
    color: #666;
    font-style: italic;
  }

  .stats-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .diversity-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #e9ecef;
    gap: 1rem;
  }

  .chat-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 0 0 auto;
    width: 140px;
  }

  .chat-name {
    font-weight: 600;
    color: #333;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .total-words {
    font-size: 0.75rem;
    color: #666;
    margin-top: 0.1rem;
  }

  .ttr-comparison {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ttr-bars {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .ttr-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ttr-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #333;
    width: 40px;
    text-align: right;
  }

  .ttr-visual {
    height: 18px;
    border-radius: 9px;
    min-width: 5px;
    transition: all 0.3s ease;
  }

  .ttr-value {
    font-size: 0.8rem;
    font-weight: 700;
    margin-left: 0.5rem;
  }

  .comparison-text {
    font-size: 0.75rem;
    color: #666;
    text-align: center;
    font-style: italic;
    margin-top: 0.25rem;
  }

  .word-stats {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-end;
    flex: 0 0 auto;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .stat-label {
    font-size: 0.65rem;
    color: #666;
  }

  .stat-value {
    font-size: 0.75rem;
    font-weight: 700;
    color: #4a90e2;
  }

  .explanation {
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    border-radius: 6px;
    padding: 0.75rem;
    border: 1px solid #dee2e6;
  }

  .explanation h4 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 0.9rem;
  }

  .explanation p {
    margin: 0 0 0.5rem 0;
    font-size: 0.8rem;
    color: #666;
  }

  .ttr-legend {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.7rem;
    color: #666;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
  }

  .no-data {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    text-align: center;
    color: #666;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    border-radius: 8px;
    border: 2px dashed #dee2e6;
  }

  .no-data-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.6;
  }

  .no-data h4 {
    margin: 0 0 0.5rem 0;
    color: #495057;
    font-size: 1.2rem;
  }

  .no-data p {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.8;
  }
</style>