// src/lib/auth.svelte.ts
import { invalidateAll } from '$app/navigation';
import {
	PUBLIC_APPVIEW_URL,
	PUBLIC_OAUTH_CLIENT_ID,
	PUBLIC_OAUTH_REDIRECT_URI,
	PUBLIC_OAUTH_SCOPE
} from '$env/static/public';
import { Client, simpleFetchHandler } from '@atcute/client';
import {
	CompositeDidDocumentResolver,
	CompositeHandleResolver,
	DohJsonHandleResolver,
	LocalActorResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
	WellKnownHandleResolver
} from '@atcute/identity-resolver';
import type { ActorIdentifier, Did } from '@atcute/lexicons';
import { isDid, isHandle } from '@atcute/lexicons/syntax';
import {
	configureOAuth,
	createAuthorizationUrl,
	deleteStoredSession,
	finalizeAuthorization,
	getSession,
	type Session
} from '@atcute/oauth-browser-client';
import { User } from './user.svelte';

const STORED_DIDS_KEY = 'gifdex:storedDids';
const ACTIVE_USER_KEY = 'gifdex:activeUser';
const OAUTH_REDIRECT_KEY = 'oauth-session-storage';

enum OAuthAuthenticationType {
	Account,
	PDS
}

class AuthStore {
	users = $state<Map<Did, User>>(new Map());
	allUsers = $derived([...this.users.values()]);
	activeUserDid = $state<Did | null>(null);
	promptSignIn = $state(false);

	private _unauthenticatedClient: Client = new Client({
		handler: simpleFetchHandler({
			service: PUBLIC_APPVIEW_URL
		})
	});

	activeUser = $derived(this.activeUserDid ? (this.users.get(this.activeUserDid) ?? null) : null);
	client = $derived(this.activeUser?.client ?? this._unauthenticatedClient);

	/**
	 * Initialises required dependencies for performing OAuth operations.
	 */
	private setupOAuth() {
		configureOAuth({
			metadata: {
				client_id: PUBLIC_OAUTH_CLIENT_ID,
				redirect_uri: PUBLIC_OAUTH_REDIRECT_URI
			},
			storageName: 'gifdex-oauth',
			identityResolver: new LocalActorResolver({
				handleResolver: new CompositeHandleResolver({
					strategy: 'race',
					methods: {
						dns: new DohJsonHandleResolver({
							dohUrl: 'https://cloudflare-dns.com/dns-query?'
						}),
						http: new WellKnownHandleResolver()
					}
				}),
				didDocumentResolver: new CompositeDidDocumentResolver({
					methods: {
						plc: new PlcDidDocumentResolver(),
						web: new WebDidDocumentResolver()
					}
				})
			})
		});
	}

	/**
	 * Initialise the auth store.
	 *
	 * This method will setup OAuth ahead of time and make an attempt to restore all
	 * stored sessions, falling back to an unauthenticated state otherwise.
	 */
	async initialize() {
		this.setupOAuth();
		try {
			await this.restoreAllSessions();
		} catch (err) {
			console.error('Failed to restore sessions: ', err);
		}
	}

	/**
	 * Restore all stored sessions.
	 */
	private async restoreAllSessions(): Promise<void> {
		const storedDids = this.getStoredDids();
		if (storedDids.length === 0) return;

		const restoredUsers: User[] = [];
		const failedDids: Did[] = [];

		for (const did of storedDids) {
			try {
				const session = await getSession(did, { allowStale: true });
				const user = new User(did, session);
				this.users.set(did, user);
				restoredUsers.push(user);
			} catch (err) {
				console.error(`Failed to restore session for ${did}:`, err);
				failedDids.push(did);
			}
		}

		// Reassign to trigger reactivity
		this.users = new Map(this.users);

		// Clean up failed DIDs from storage
		for (const did of failedDids) {
			this.removeStoredDid(did);
			deleteStoredSession(did);
		}

		// Set active user
		if (restoredUsers.length > 0) {
			const savedActiveUser = localStorage.getItem(ACTIVE_USER_KEY) as Did | null;
			if (savedActiveUser && this.users.has(savedActiveUser)) {
				this.activeUserDid = savedActiveUser;
			} else {
				// Fall back to first available user
				this.activeUserDid = restoredUsers[0].did;
				localStorage.setItem(ACTIVE_USER_KEY, this.activeUserDid);
			}
		}
	}

	/**
	 * Create a new session from the current URL fragment and immediately switch to it if successful.
	 *
	 * @returns Whether creating and switching to the new session was successful.
	 */
	async createSession(): Promise<{ success: boolean; redirect: string | null }> {
		const params = new URLSearchParams(location.hash.slice(1));
		if (!params.has('state') || (!params.has('code') && !params.has('error'))) {
			return { success: false, redirect: null };
		}

		history.replaceState(null, '', location.pathname + location.search);

		try {
			const auth = await finalizeAuthorization(params);
			const did = auth.session.info.sub;

			// Add to stored DIDs and create user
			this.addStoredDid(did);
			const user = new User(did, auth.session);
			this.users.set(did, user);
			this.users = new Map(this.users); // Reassign to trigger reactivity

			// Set as active user
			this.activeUserDid = did;
			localStorage.setItem(ACTIVE_USER_KEY, did);

			const redirect = sessionStorage.getItem(OAUTH_REDIRECT_KEY);
			sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
			return { success: true, redirect };
		} catch (err) {
			console.error('Failed to create session:', err);
			return { success: false, redirect: null };
		}
	}

	/**
	 * Whether the auth store is currently authenticated with an active user.
	 */
	isAuthenticated(): this is this & {
		activeUser: User;
		activeUserDid: Did;
		session: Session;
	} {
		return this.activeUser != null;
	}

	/**
	 * Switch to a different signed-in user.
	 *
	 * @param did The DID of the user to switch to.
	 */
	async switchUser(did: Did): Promise<boolean> {
		if (!this.users.has(did)) {
			console.error(`Cannot switch to unknown user: ${did}`);
			return false;
		}

		this.activeUserDid = did;
		localStorage.setItem(ACTIVE_USER_KEY, did);
		await invalidateAll();
		return true;
	}

	/**
	 * Sign out a specific user by DID.
	 *
	 * @param did The DID of the user to sign out.
	 */
	async signOutUser(did: Did): Promise<void> {
		const user = this.users.get(did);
		if (!user) {
			console.warn(`Attempted to sign out unknown user: ${did}`);
			return;
		}

		await user.agent.signOut();
		deleteStoredSession(did);
		this.users.delete(did);
		this.users = new Map(this.users); // Reassign to trigger reactivity
		this.removeStoredDid(did);

		// If we signed out the active user, switch to another or clear
		if (this.activeUserDid === did) {
			const remainingUsers = [...this.users.keys()];
			if (remainingUsers.length > 0) {
				this.activeUserDid = remainingUsers[0];
				localStorage.setItem(ACTIVE_USER_KEY, this.activeUserDid);
			} else {
				this.activeUserDid = null;
				localStorage.removeItem(ACTIVE_USER_KEY);
			}
		}

		await invalidateAll();
	}

	/**
	 * Sign out all users and clear all stored sessions.
	 */
	async signOutAll(): Promise<void> {
		for (const user of this.users.values()) {
			await user.agent.signOut();
			deleteStoredSession(user.did);
		}

		this.users.clear();
		this.users = new Map(this.users); // Reassign to trigger reactivity
		this.activeUserDid = null;
		localStorage.removeItem(STORED_DIDS_KEY);
		localStorage.removeItem(ACTIVE_USER_KEY);
		sessionStorage.removeItem(OAUTH_REDIRECT_KEY);

		await invalidateAll();
		window.location.reload();
	}

	/**
	 * Initiate an OAuth sign in flow for the provided identifier.
	 *
	 * @param identifier Either a Handle, DID or PDS url.
	 * @returns Whether initiating the OAuth sign-in was successful.
	 */
	async oauthSignIn(identifier: string): Promise<boolean> {
		if (!identifier) {
			console.error('Empty identifier provided');
			return false;
		}

		const authType = this.getAuthTypeForIdentifier(identifier);
		if (authType === null) {
			console.error('Invalid login identifier:', identifier);
			return false;
		}

		try {
			// Strip leading @ if present as OAuth doesn't accept this
			const cleanIdentifier = identifier.startsWith('@') ? identifier.substring(1) : identifier;
			const authUrl = await createAuthorizationUrl({
				target:
					authType === OAuthAuthenticationType.Account
						? { type: 'account', identifier: cleanIdentifier as ActorIdentifier }
						: { type: 'pds', serviceUrl: cleanIdentifier },
				scope: PUBLIC_OAUTH_SCOPE
			});
			sessionStorage.setItem(OAUTH_REDIRECT_KEY, window.location.toString());
			window.location.assign(authUrl);
			return true;
		} catch (err) {
			console.error('Failed to create authorization URL:', err);
			return false;
		}
	}

	/**
	 * Determine whether the given identifier is valid/supported for authentication operations.
	 * @param identifier The identifier to analyse
	 * @returns True if supported, false if unsupported or type is unknown.
	 */
	isValidIdentifier(identifier: string): boolean {
		return this.getAuthTypeForIdentifier(identifier) !== null;
	}

	/**
	 * Determine the type of authentication required for the given identifier.
	 * @param identifier The identifier to analyse.
	 * @returns Either the `OAuthAuthenticationType` if determined, or null if the identifier is invalid or could not be determined.
	 */
	private getAuthTypeForIdentifier(identifier: string): OAuthAuthenticationType | null {
		const cleanIdentifier = identifier.startsWith('@') ? identifier.substring(1) : identifier;

		// Account (Handle or DID)
		if (isHandle(cleanIdentifier) || isDid(cleanIdentifier)) {
			return OAuthAuthenticationType.Account;
		}

		// PDS (URL)
		try {
			const url = new URL(cleanIdentifier);
			if (url.protocol === 'https:' || url.protocol === 'http:') {
				return OAuthAuthenticationType.PDS;
			}
		} catch {
			//
		}

		return null;
	}

	private getStoredDids(): Did[] {
		try {
			const stored = localStorage.getItem(STORED_DIDS_KEY);
			if (!stored) return [];
			return JSON.parse(stored) as Did[];
		} catch {
			return [];
		}
	}

	private addStoredDid(did: Did): void {
		const dids = this.getStoredDids();
		if (!dids.includes(did)) {
			dids.push(did);
			localStorage.setItem(STORED_DIDS_KEY, JSON.stringify(dids));
		}
	}

	private removeStoredDid(did: Did): void {
		const dids = this.getStoredDids().filter((d) => d !== did);
		if (dids.length > 0) {
			localStorage.setItem(STORED_DIDS_KEY, JSON.stringify(dids));
		} else {
			localStorage.removeItem(STORED_DIDS_KEY);
		}
	}
}

export const authStore = new AuthStore();
