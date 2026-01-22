<script lang="ts">
	import {
		Dropdown,
		DropdownDivider,
		DropdownItem,
		DropdownSection
	} from '$lib/components/base/dropdown';
	import Shimmer from '$lib/components/base/Shimmer.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import type { User } from '$lib/stores/user.svelte';
	import { ChevronDown, CircleUser, LogOut, Plus, User as UserIcon } from 'lucide-svelte';

	let dropdownOpen = $state(false);

	const inactiveUsers = $derived(
		authStore.allUsers.filter((u) => u.did !== authStore.activeUserDid)
	);

	function handleAddAccount() {
		authStore.promptSignIn = true;
		dropdownOpen = false;
	}

	async function handleSwitchAccount(user: User) {
		await authStore.switchUser(user.did);
		dropdownOpen = false;
	}

	async function handleSignOut(user: User) {
		await authStore.signOutUser(user.did);
	}
</script>

<Dropdown bind:open={dropdownOpen}>
	{#snippet trigger()}
		<button class="trigger" onclick={() => (dropdownOpen = !dropdownOpen)}>
			{#if authStore.activeUser?.isLoadingProfile && !authStore.activeUser?.profile}
				<Shimmer width={28} height={28} radius="circle" />
				<Shimmer width={80} height={14} class="handle-shimmer" />
			{:else if authStore.activeUser?.avatar}
				<img
					src={authStore.activeUser.avatar}
					alt={authStore.activeUser.displayName}
					class="avatar"
				/>
				<span class="handle">@{authStore.activeUser.handle}</span>
			{:else}
				<div class="avatar-fallback">
					<CircleUser size={28} />
				</div>
				<span class="handle">@{authStore.activeUser?.handle ?? authStore.activeUser?.did}</span>
			{/if}
			<ChevronDown size={16} class="chevron" />
		</button>
	{/snippet}

	<DropdownSection>
		<DropdownItem
			href="/profile/{authStore.activeUser!.did}"
			onclick={() => (dropdownOpen = false)}
		>
			<UserIcon size={16} />
			<span>Profile</span>
		</DropdownItem>
	</DropdownSection>

	{#if inactiveUsers.length > 0}
		<DropdownDivider />
		<DropdownSection label="Switch account">
			{#each inactiveUsers as user (user.did)}
				<div class="account-row">
					<DropdownItem onclick={() => handleSwitchAccount(user)}>
						{#if user.avatar}
							<img src={user.avatar} alt={user.displayName} class="small-avatar" />
						{:else}
							<div class="small-avatar-fallback">
								<CircleUser size={20} />
							</div>
						{/if}
						<span class="account-name">@{user.handle ?? user.did}</span>
					</DropdownItem>
					<button class="sign-out-small" title="Sign out" onclick={() => handleSignOut(user)}>
						<LogOut size={14} />
					</button>
				</div>
			{/each}
		</DropdownSection>
	{/if}

	<DropdownDivider />
	<DropdownSection>
		<DropdownItem onclick={handleAddAccount}>
			<Plus size={16} />
			<span>Add account</span>
		</DropdownItem>
		<DropdownItem variant="danger" onclick={() => handleSignOut(authStore.activeUser!)}>
			<LogOut size={16} />
			<span>Sign out</span>
		</DropdownItem>
	</DropdownSection>
</Dropdown>

<style>
	.trigger {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border: 2px solid var(--ctp-surface0);
		border-radius: 8px;
		background: transparent;
		color: var(--ctp-text);
		cursor: pointer;
		transition: all 0.2s;
	}

	.trigger:hover {
		background: var(--ctp-surface0);
	}

	.avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-fallback {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--ctp-subtext0);
	}

	.handle,
	:global(.handle-shimmer) {
		font-size: 14px;
		font-weight: 500;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 768px) {
		.handle,
		:global(.handle-shimmer) {
			display: none;
		}
	}

	.trigger :global(.chevron) {
		color: var(--ctp-subtext0);
	}

	/* Account switching */
	.account-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.account-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.small-avatar {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.small-avatar-fallback {
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--ctp-subtext0);
		flex-shrink: 0;
	}

	.sign-out-small {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--ctp-subtext0);
		cursor: pointer;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.sign-out-small:hover {
		background: color-mix(in srgb, var(--ctp-red) 15%, transparent);
		color: var(--ctp-red);
	}
</style>
