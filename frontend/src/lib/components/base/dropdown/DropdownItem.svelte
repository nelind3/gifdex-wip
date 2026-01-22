<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		variant?: 'default' | 'danger';
		href?: string;
		onclick?: (event: MouseEvent) => void;
		disabled?: boolean;
	}

	let { children, variant = 'default', href, onclick, disabled = false }: Props = $props();
</script>

{#if href}
	<a {href} class="dropdown-item" class:danger={variant === 'danger'} class:disabled {onclick}>
		{@render children()}
	</a>
{:else}
	<button
		type="button"
		class="dropdown-item"
		class:danger={variant === 'danger'}
		{disabled}
		{onclick}
	>
		{@render children()}
	</button>
{/if}

<style>
	.dropdown-item {
		--dropdown-item-gap: var(--space-sm);
		--dropdown-item-padding: var(--space-sm);
		--dropdown-item-radius: var(--radius-sm);

		display: flex;
		align-items: center;
		gap: var(--dropdown-item-gap);
		width: 100%;
		padding: var(--dropdown-item-padding);
		border: none;
		border-radius: var(--dropdown-item-radius);
		background: transparent;
		color: var(--ctp-text);
		font-size: var(--text-sm);
		font-family: inherit;
		text-decoration: none;
		text-align: left;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.dropdown-item:hover:not(.disabled) {
		background: var(--ctp-surface0);
	}

	.dropdown-item.danger {
		color: var(--ctp-red);
	}

	.dropdown-item.danger:hover:not(.disabled) {
		background: color-mix(in srgb, var(--ctp-red) 15%, transparent);
	}

	.dropdown-item.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
