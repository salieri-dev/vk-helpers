<script lang="ts">
	import type { ChatAnalytics } from '$lib/utils/messageParser';

	export let analytics: ChatAnalytics[];
	export let maxContacts: number = 10;

	interface NetworkNode {
		id: string;
		name: string;
		totalMessages: number;
		x: number;
		y: number;
		radius: number;
		color: string;
	}

	interface NetworkEdge {
		from: string;
		to: string;
		weight: number;
		strokeWidth: number;
	}

	// Calculate network data
	$: networkData = (() => {
		if (analytics.length === 0) return { nodes: [], edges: [], maxMessages: 0 };

		// Create user node (center)
		const userNode: NetworkNode = {
			id: 'user',
			name: 'You',
			totalMessages: analytics.reduce((sum, chat) => sum + chat.userMessages, 0),
			x: 250,
			y: 200,
			radius: 30,
			color: '#4a90e2'
		};

		// Get top contacts from all chats
		const contactStats = new Map<string, { totalMessages: number; chatNames: string[] }>();
		
		analytics.forEach(chat => {
			chat.userStats.forEach(user => {
				if (user.sender !== 'You') {
					const existing = contactStats.get(user.sender) || { totalMessages: 0, chatNames: [] };
					existing.totalMessages += user.totalMessages;
					if (!existing.chatNames.includes(chat.chatName)) {
						existing.chatNames.push(chat.chatName);
					}
					contactStats.set(user.sender, existing);
				}
			});
		});

		// Sort and limit contacts
		const topContacts = Array.from(contactStats.entries())
			.sort(([,a], [,b]) => b.totalMessages - a.totalMessages)
			.slice(0, maxContacts);

		const maxMessages = Math.max(
			userNode.totalMessages,
			...topContacts.map(([,data]) => data.totalMessages)
		);

		// Create contact nodes in a circle around the user
		const contactNodes: NetworkNode[] = topContacts.map(([name, data], index) => {
			const angle = (index / topContacts.length) * 2 * Math.PI;
			const distance = 120;
			const x = 250 + Math.cos(angle) * distance;
			const y = 200 + Math.sin(angle) * distance;
			
			const radius = Math.max(15, Math.min(25, (data.totalMessages / maxMessages) * 25));
			
			return {
				id: name,
				name,
				totalMessages: data.totalMessages,
				x,
				y,
				radius,
				color: `hsl(${(index * 137.508) % 360}, 70%, 60%)`
			};
		});

		// Create edges from user to contacts
		const edges: NetworkEdge[] = contactNodes.map(contact => {
			const weight = contact.totalMessages;
			const strokeWidth = Math.max(1, Math.min(8, (weight / maxMessages) * 8));
			
			return {
				from: 'user',
				to: contact.id,
				weight,
				strokeWidth
			};
		});

		return {
			nodes: [userNode, ...contactNodes],
			edges,
			maxMessages
		};
	})();

	function formatNumber(num: number): string {
		return new Intl.NumberFormat('ru-RU').format(num);
	}

	let hoveredNode: string | null = null;
</script>

<div class="contacts-network">
	<div class="network-header">
		<h4>Top Contacts Network</h4>
		<p class="network-description">
			Interactive network showing your communication patterns. Node size represents message volume.
		</p>
	</div>

	{#if networkData.nodes.length === 0}
		<div class="no-data">
			<p>No contact data available</p>
		</div>
	{:else}
		<div class="network-container">
			<svg viewBox="0 0 500 400" class="network-svg">
				<!-- Edges -->
				<g class="edges">
					{#each networkData.edges as edge}
						<line
							x1={networkData.nodes.find(n => n.id === edge.from)?.x}
							y1={networkData.nodes.find(n => n.id === edge.from)?.y}
							x2={networkData.nodes.find(n => n.id === edge.to)?.x}
							y2={networkData.nodes.find(n => n.id === edge.to)?.y}
							stroke="#dee2e6"
							stroke-width={edge.strokeWidth}
							opacity="0.6"
							class="edge"
							class:highlighted={hoveredNode === edge.from || hoveredNode === edge.to}
						/>
					{/each}
				</g>

				<!-- Nodes -->
				<g class="nodes">
					{#each networkData.nodes as node}
						<g 
							class="node"
							class:user-node={node.id === 'user'}
							class:hovered={hoveredNode === node.id}
							on:mouseenter={() => hoveredNode = node.id}
							on:mouseleave={() => hoveredNode = null}
						>
							<circle
								cx={node.x}
								cy={node.y}
								r={node.radius}
								fill={node.color}
								stroke="white"
								stroke-width="2"
								class="node-circle"
							/>
							
							<!-- Node label -->
							<text
								x={node.x}
								y={node.y + node.radius + 15}
								text-anchor="middle"
								class="node-label"
								class:user-label={node.id === 'user'}
							>
								{node.name.length > 12 ? node.name.substring(0, 12) + '...' : node.name}
							</text>
							
							<!-- Message count on hover -->
							{#if hoveredNode === node.id}
								<g class="tooltip">
									<rect
										x={node.x - 40}
										y={node.y - node.radius - 35}
										width="80"
										height="25"
										fill="rgba(0,0,0,0.8)"
										rx="4"
									/>
									<text
										x={node.x}
										y={node.y - node.radius - 18}
										text-anchor="middle"
										fill="white"
										font-size="11"
										class="tooltip-text"
									>
										{formatNumber(node.totalMessages)} msgs
									</text>
								</g>
							{/if}
						</g>
					{/each}
				</g>
			</svg>
		</div>

		<!-- Legend and Stats -->
		<div class="network-footer">
			<div class="network-stats">
				<div class="stat-item">
					<span class="stat-label">Total Contacts:</span>
					<span class="stat-value">{networkData.nodes.length - 1}</span>
				</div>
				<div class="stat-item">
					<span class="stat-label">Total Messages:</span>
					<span class="stat-value">{formatNumber(networkData.maxMessages)}</span>
				</div>
			</div>
			
			<div class="network-legend">
				<div class="legend-item">
					<div class="legend-icon user-icon"></div>
					<span>You (center)</span>
				</div>
				<div class="legend-item">
					<div class="legend-icon contact-icon"></div>
					<span>Contacts (size = message count)</span>
				</div>
				<div class="legend-item">
					<div class="legend-line"></div>
					<span>Connection strength</span>
				</div>
			</div>
		</div>

		<!-- Top Contacts List -->
		<div class="top-contacts-list">
			<h5>Top {Math.min(maxContacts, networkData.nodes.length - 1)} Contacts</h5>
			<div class="contacts-grid">
				{#each networkData.nodes.filter(n => n.id !== 'user').sort((a, b) => b.totalMessages - a.totalMessages) as contact, index}
					<div class="contact-item">
						<div class="contact-rank">#{index + 1}</div>
						<div class="contact-color" style="background-color: {contact.color}"></div>
						<div class="contact-info">
							<div class="contact-name">{contact.name}</div>
							<div class="contact-messages">{formatNumber(contact.totalMessages)} messages</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.contacts-network {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.network-header {
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.network-header h4 {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 1.1rem;
	}

	.network-description {
		margin: 0;
		color: #6c757d;
		font-size: 0.9rem;
	}

	.no-data {
		text-align: center;
		padding: 2rem;
		color: #6c757d;
	}

	.network-container {
		margin-bottom: 1.5rem;
	}

	.network-svg {
		width: 100%;
		height: 400px;
		border: 1px solid #e9ecef;
		border-radius: 6px;
		background: #fafafa;
	}

	.edge {
		transition: all 0.2s ease;
	}

	.edge.highlighted {
		stroke: #4a90e2;
		opacity: 0.8;
	}

	.node {
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.node-circle {
		transition: all 0.2s ease;
		filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
	}

	.node.hovered .node-circle {
		transform: scale(1.1);
		filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
	}

	.node.user-node .node-circle {
		stroke-width: 3;
		filter: drop-shadow(0 3px 6px rgba(74,144,226,0.3));
	}

	.node-label {
		font-size: 11px;
		fill: #495057;
		font-weight: 500;
		pointer-events: none;
	}

	.node-label.user-label {
		font-weight: 600;
		fill: #4a90e2;
	}

	.tooltip-text {
		pointer-events: none;
	}

	.network-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 1rem;
		border-top: 1px solid #e9ecef;
		margin-bottom: 1.5rem;
	}

	.network-stats {
		display: flex;
		gap: 1.5rem;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #6c757d;
		margin-bottom: 0.25rem;
	}

	.stat-value {
		font-weight: 600;
		color: #495057;
	}

	.network-legend {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: #6c757d;
	}

	.legend-icon {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	.legend-icon.user-icon {
		background: #4a90e2;
		border: 2px solid white;
		box-shadow: 0 0 0 1px #4a90e2;
	}

	.legend-icon.contact-icon {
		background: linear-gradient(45deg, #28a745, #20c997, #17a2b8);
	}

	.legend-line {
		width: 20px;
		height: 3px;
		background: #dee2e6;
		border-radius: 2px;
	}

	.top-contacts-list h5 {
		margin: 0 0 1rem 0;
		color: #495057;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.contacts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.75rem;
	}

	.contact-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 6px;
	}

	.contact-rank {
		font-weight: 600;
		color: #4a90e2;
		min-width: 24px;
		text-align: center;
	}

	.contact-color {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid white;
		box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
	}

	.contact-info {
		flex: 1;
	}

	.contact-name {
		font-weight: 500;
		color: #495057;
		font-size: 0.9rem;
		line-height: 1.2;
	}

	.contact-messages {
		font-size: 0.8rem;
		color: #6c757d;
	}

	@media (max-width: 768px) {
		.contacts-network {
			padding: 1rem;
		}
		
		.network-footer {
			flex-direction: column;
			gap: 1rem;
			align-items: flex-start;
		}
		
		.network-legend {
			flex-wrap: wrap;
		}
		
		.contacts-grid {
			grid-template-columns: 1fr;
		}
		
		.network-svg {
			height: 300px;
		}
	}
</style>