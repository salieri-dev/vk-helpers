<script lang="ts">

  interface ChatAnalytics {
    messages: Array<{
      timestamp: Date;
      isFromUser?: boolean;
      text?: string;
      from_id?: number;
      user_id?: number;
      [key: string]: any;
    }>;
    chatName: string;
  }

  interface BalanceData {
    chatName: string;
    yourMessages: number;
    theirMessages: number;
    yourWords: number;
    theirWords: number;
    yourInitiations: number;
    theirInitiations: number;
    totalMessages: number;
    messageRatio: string;
    wordRatio: string;
    initiationRatio: string;
    youPercentage: number;
    themPercentage: number;
  }

  export let analytics: ChatAnalytics[];
  export let currentUserId: number | null = null;

  // Calculate conversation balance for each chat
  $: balanceData = processConversationBalance(analytics);
  $: hasData = balanceData.length > 0;

  function processConversationBalance(data: ChatAnalytics[]): BalanceData[] {
    return data.map(chat => {
      const messages = chat.messages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let yourMessages = 0;
      let theirMessages = 0;
      let yourWords = 0;
      let theirWords = 0;
      let yourInitiations = 0;
      let theirInitiations = 0;

      let lastMessageTime: Date | null = null;
      const CONVERSATION_GAP_HOURS = 12;

      messages.forEach(message => {
        const messageTime = new Date(message.timestamp);
        const isFromYou = determineIfFromUser(message, currentUserId);
        
        // Count messages
        if (isFromYou) {
          yourMessages++;
        } else {
          theirMessages++;
        }

        // Count words
        const wordCount = countWords(message.text || '');
        if (isFromYou) {
          yourWords += wordCount;
        } else {
          theirWords += wordCount;
        }

        // Check for conversation initiation (after 12+ hour gap)
        if (lastMessageTime) {
          const hoursSinceLastMessage = (messageTime.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastMessage >= CONVERSATION_GAP_HOURS) {
            if (isFromYou) {
              yourInitiations++;
            } else {
              theirInitiations++;
            }
          }
        } else {
          // First message in chat counts as initiation
          if (isFromYou) {
            yourInitiations++;
          } else {
            theirInitiations++;
          }
        }

        lastMessageTime = messageTime;
      });

      const totalMessages = yourMessages + theirMessages;
      const youPercentage = totalMessages > 0 ? (yourMessages / totalMessages) * 100 : 0;
      const themPercentage = 100 - youPercentage;

      return {
        chatName: chat.chatName,
        yourMessages,
        theirMessages,
        yourWords,
        theirWords,
        yourInitiations,
        theirInitiations,
        totalMessages,
        messageRatio: calculateRatio(yourMessages, theirMessages),
        wordRatio: calculateRatio(yourWords, theirWords),
        initiationRatio: calculateRatio(yourInitiations, theirInitiations),
        youPercentage,
        themPercentage
      };
    }).filter(data => data.totalMessages > 0);
  }

  function determineIfFromUser(message: any, userId: number | null): boolean {
    // Try different ways to determine if message is from current user
    if (message.isFromUser !== undefined) {
      return message.isFromUser;
    }
    if (userId !== null && message.from_id !== undefined) {
      return message.from_id === userId;
    }
    if (userId !== null && message.user_id !== undefined) {
      return message.user_id === userId;
    }
    // Fallback: assume alternating pattern or use other heuristics
    return Math.random() > 0.5; // This should be replaced with actual logic
  }

  function countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  function calculateRatio(yours: number, theirs: number): string {
    if (yours === 0 && theirs === 0) return "0 : 0";
    if (yours === 0) return `0 : 1`;
    if (theirs === 0) return `1 : 0`;
    
    const ratio = theirs / yours;
    return `1 : ${ratio.toFixed(1)}`;
  }

</script>

<div class="conversation-balance">
  <div class="header">
    <h3>⭐ Conversation Balance</h3>
  </div>

  {#if hasData}
    <div class="stats-list">
      {#each balanceData.slice(0, 8) as chat}
        <div class="balance-item">
          <div class="chat-info">
            <span class="chat-name">{chat.chatName}</span>
            <span class="total-messages">{chat.totalMessages.toLocaleString()} msgs</span>
          </div>
          
          <div class="balance-bar">
            <div class="balance-progress">
              <div class="you-bar" style="width: {chat.youPercentage}%"></div>
              <div class="them-bar" style="width: {chat.themPercentage}%"></div>
            </div>
            <div class="balance-labels">
              <span class="you-label">You ({chat.youPercentage.toFixed(0)}%)</span>
              <span class="them-label">Them ({chat.themPercentage.toFixed(0)}%)</span>
            </div>
          </div>
          
          <div class="ratios">
            <span class="ratio-item">
              <span class="ratio-label">Messages:</span>
              <span class="ratio-value">{chat.messageRatio}</span>
            </span>
            <span class="ratio-item">
              <span class="ratio-label">Words:</span>
              <span class="ratio-value">{chat.wordRatio}</span>
            </span>
            <span class="ratio-item">
              <span class="ratio-label">Starts:</span>
              <span class="ratio-value">{chat.initiationRatio}</span>
            </span>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="no-data">
      <div class="no-data-icon">⚖️</div>
      <h4>No Conversation Data Available</h4>
      <p>No conversations found to analyze balance.</p>
    </div>
  {/if}
</div>

<style>
  .conversation-balance {
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
    margin: 0;
    color: #333;
    font-size: 1.2rem;
  }

  .stats-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .balance-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 4px;
    border: 1px solid #e9ecef;
    gap: 1rem;
  }

  .chat-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 0 0 auto;
    width: 150px;
  }

  .chat-name {
    font-weight: 600;
    color: #333;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .total-messages {
    font-size: 0.75rem;
    color: #666;
    margin-top: 0.1rem;
  }

  .balance-bar {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .balance-progress {
    display: flex;
    height: 20px;
    background: #e9ecef;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
  }

  .you-bar {
    background: linear-gradient(90deg, #4a90e2, #357abd);
    transition: width 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .them-bar {
    background: linear-gradient(90deg, #e74c3c, #c0392b);
    transition: width 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .balance-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: #666;
  }

  .you-label {
    color: #4a90e2;
    font-weight: 600;
  }

  .them-label {
    color: #e74c3c;
    font-weight: 600;
  }

  .ratios {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex: 0 0 auto;
  }

  .ratio-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .ratio-label {
    font-size: 0.65rem;
    color: #666;
    margin-bottom: 0.1rem;
  }

  .ratio-value {
    font-size: 0.75rem;
    font-weight: 700;
    color: #4a90e2;
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