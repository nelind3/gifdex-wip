<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {}

	let { ...restProps }: Props = $props();
</script>

<input {...restProps} />

<style>
	input {
		width: 100%;
		padding: 10px 16px;
		border: 2px solid var(--ctp-surface0);
		border-radius: 8px;
		background: var(--ctp-base);
		color: var(--ctp-text);
		font-size: 14px;
		transition: border-color 0.2s;
	}

	input:focus {
		outline: none;
		border-color: var(--ctp-mauve);
	}

	input::placeholder {
		color: var(--ctp-subtext0);
	}
</style>
