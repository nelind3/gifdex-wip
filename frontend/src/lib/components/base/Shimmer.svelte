<script lang="ts">
	interface Props {
		width?: number | string;
		height?: number | string;
		radius?: number | string | 'circle';
		class?: string;
	}

	let { width = '100%', height = '100%', radius = 4, class: className = '' }: Props = $props();

	const style = $derived(
		[
			`width: ${typeof width === 'number' ? `${width}px` : width}`,
			`height: ${typeof height === 'number' ? `${height}px` : height}`,
			`border-radius: ${radius === 'circle' ? '50%' : typeof radius === 'number' ? `${radius}px` : radius}`
		].join('; ')
	);
</script>

<div class="shimmer {className}" {style}></div>

<style>
	.shimmer {
		background: linear-gradient(
			90deg,
			var(--ctp-surface0) 0%,
			var(--ctp-surface1) 50%,
			var(--ctp-surface0) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
</style>
