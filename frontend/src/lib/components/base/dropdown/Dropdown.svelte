<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		trigger: Snippet;
		children: Snippet;
		open?: boolean;
		align?: 'left' | 'right' | 'center';
		width?: string;
		minWidth?: string;
		maxWidth?: string;
		zIndex?: number;
	}

	let {
		trigger,
		children,
		open = $bindable(false),
		align = 'right',
		width,
		minWidth,
		maxWidth,
		zIndex = 100
	}: Props = $props();

	let containerRef = $state<HTMLDivElement | null>(null);

	function handleClickOutside(event: MouseEvent) {
		if (containerRef && !containerRef.contains(event.target as Node)) {
			open = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			open = false;
			event.preventDefault();
		}
	}
</script>

<svelte:window onclick={handleClickOutside} onkeydown={handleKeydown} />

<div class="dropdown-container" bind:this={containerRef}>
	{@render trigger()}
	{#if open}
		<div
			class="dropdown-content"
			class:align-left={align === 'left'}
			class:align-right={align === 'right'}
			class:align-center={align === 'center'}
			style:width
			style:min-width={minWidth}
			style:max-width={maxWidth}
			style:z-index={zIndex}
		>
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.dropdown-container {
		position: relative;
		--dropdown-offset: var(--space-md);
		--dropdown-radius: var(--radius-lg);
		--dropdown-min-width: 220px;
		--dropdown-max-width: 400px;
	}

	.dropdown-content {
		position: absolute;
		top: calc(100% + var(--dropdown-top-offset, var(--dropdown-offset)));
		min-width: var(--dropdown-min-width);
		max-width: var(--dropdown-max-width);
		background: var(--ctp-mantle);
		border: 1px solid var(--ctp-surface0);
		border-radius: var(--dropdown-radius);
		overflow: hidden;
	}

	.dropdown-content.align-right {
		right: 0;
	}

	.dropdown-content.align-left {
		left: 0;
	}

	.dropdown-content.align-center {
		left: 50%;
		transform: translateX(-50%);
	}
</style>
