<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		fileUploaded: { file: File };
	}>();

	let isDragOver = false;
	let fileInput: HTMLInputElement;

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			handleFile(files[0]);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			handleFile(target.files[0]);
		}
	}

	function handleFile(file: File) {
		console.log('🔍 FileUpload.handleFile called with:', file.name, file.size);
		
		// Validate file type
		if (!file.name.toLowerCase().endsWith('.zip')) {
			console.log('❌ File validation failed: not a ZIP file');
			alert('Please select a ZIP file.');
			return;
		}

		// Validate file size (limit to 500MB for browser processing)
		const maxSize = 500 * 1024 * 1024; // 500MB
		if (file.size > maxSize) {
			console.log('❌ File validation failed: file too large');
			alert('File is too large. Please select a file smaller than 500MB.');
			return;
		}

		console.log('✅ File validation passed, dispatching fileUploaded event');
		dispatch('fileUploaded', { file });
	}

	function triggerFileSelect() {
		fileInput.click();
	}
</script>

<div
	class="upload-area"
	class:drag-over={isDragOver}
	on:drop={handleDrop}
	on:dragover={handleDragOver}
	on:dragleave={handleDragLeave}
	role="button"
	tabindex="0"
	on:click={triggerFileSelect}
	on:keydown={(e) => e.key === 'Enter' && triggerFileSelect()}
>
	<input
		bind:this={fileInput}
		type="file"
		accept=".zip"
		on:change={handleFileSelect}
		style="display: none;"
	/>

	<div class="upload-content">
		<div class="upload-icon">📁</div>
		<h3>Drop your VK archive here</h3>
		<p>or click to browse files</p>
		<small>Supported format: ZIP files (up to 500MB)</small>
	</div>
</div>

<style>
	.upload-area {
		border: 2px dashed #4a90e2;
		border-radius: 8px;
		padding: 3rem 2rem;
		text-align: center;
		background: #f8f9fa;
		transition: all 0.3s ease;
		cursor: pointer;
		min-height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.upload-area:hover,
	.upload-area.drag-over {
		background: #e3f2fd;
		border-color: #2196f3;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(74, 144, 226, 0.2);
	}

	.upload-content {
		max-width: 300px;
	}

	.upload-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	h3 {
		color: #333;
		margin-bottom: 0.5rem;
		font-size: 1.2rem;
	}

	p {
		color: #666;
		margin-bottom: 1rem;
	}

	small {
		color: #888;
		font-size: 0.9rem;
	}

	.upload-area:focus {
		outline: 2px solid #4a90e2;
		outline-offset: 2px;
	}
</style>