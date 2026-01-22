<script lang="ts">
	import AccountSwitcher from '$lib/components/auth/AccountDropdown.svelte';
	import Button from '$lib/components/base/button/Button.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import Input from '../base/input/Input.svelte';
</script>

<header>
	<div class="header-content">
		<a href={'/'} class="logo">Gifdex <small>(alpha)</small></a>
		<div class="search-container">
			<Input type="text" class="search-input" placeholder="Search for GIFs or profiles..." />
		</div>
		<div class="header-actions">
			{#if authStore.isAuthenticated()}
				<Button variant="primary">Upload</Button>
				<AccountSwitcher />
			{:else}
				<Button
					variant="neutral"
					onclick={() => {
						authStore.promptSignIn = true;
					}}>Sign in</Button
				>
			{/if}
		</div>
	</div>
</header>

<style>
	header {
		background: var(--ctp-mantle);
		border-bottom: 1px solid var(--ctp-surface0);
		padding: 16px 20px;
		width: 100%;
	}

	.header-content {
		max-width: 1400px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
	}

	@media (max-width: 768px) {
		.header-content {
			gap: 12px;
		}

		.search-container {
			display: none;
		}

		.logo {
			font-size: 20px;
		}
	}

	@media (max-width: 480px) {
		header {
			padding: 12px 16px;
		}
	}

	.header-actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.logo {
		font-size: 24px;
		font-weight: 700;
		color: var(--ctp-text);
		flex-shrink: 0;
	}

	.search-container {
		flex: 1;
		max-width: 600px;
		position: relative;
	}
</style>
