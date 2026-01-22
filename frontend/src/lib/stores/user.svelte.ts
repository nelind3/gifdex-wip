import { PUBLIC_APPVIEW_DID } from '$env/static/public';
import { NetGifdexActorGetProfile } from '$lib/lexicons';
import type { ProfileView } from '$lib/lexicons/types/net/gifdex/actor/defs';
import { Client, ok } from '@atcute/client';
import type { Did } from '@atcute/lexicons';
import { OAuthUserAgent, type Session } from '@atcute/oauth-browser-client';

const APPVIEW_SERVICE_ID = '#gifdex_appview';

export class User {
	readonly did: Did;

	profile = $state<ProfileView | null>(null);
	isLoadingProfile = $state(false);
	profileError = $state<string | null>(null);

	private _session: Session;
	private _agent: OAuthUserAgent;
	readonly client: Client;

	constructor(did: Did, session: Session) {
		this.did = did;
		this._session = session;
		this._agent = new OAuthUserAgent(session);
		this.client = new Client({
			handler: this._agent,
			proxy: {
				did: PUBLIC_APPVIEW_DID as Did,
				serviceId: APPVIEW_SERVICE_ID
			}
		});
		this.fetchProfile();
	}

	/**
	 * Fetch fresh profile data from server and update cache
	 */
	async fetchProfile(): Promise<void> {
		if (this.isLoadingProfile) return;

		this.isLoadingProfile = true;
		this.profileError = null;

		try {
			this.profile = await ok(
				this.client.call(NetGifdexActorGetProfile, {
					params: {
						actor: this.did
					}
				})
			);
		} catch (err) {
			console.error('Failed to fetch profile:', err);
			this.profileError = 'Failed to load profile';
		} finally {
			this.isLoadingProfile = false;
		}
	}

	get session(): Session {
		return this._session;
	}

	get agent(): OAuthUserAgent {
		return this._agent;
	}

	get displayName(): string {
		return this.profile?.displayName || this.profile?.handle || this.did;
	}

	get handle(): string | undefined {
		return this.profile?.handle;
	}

	get avatar(): string | undefined {
		return this.profile?.avatar;
	}
}
