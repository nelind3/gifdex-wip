<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		label?: string;
	}

	let { children, label }: Props = $props();
</script>

<div class="dropdown-section">
	{#if label}
		<div class="section-label">{label}</div>
	{/if}
	{@render children()}
</div>

<style>
	.dropdown-section {
		--dropdown-section-padding: var(--space-xs);
		padding: var(--dropdown-section-padding);
	}

	.section-label {
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--ctp-subtext0);
		text-transform: uppercase;
	}
</style>
