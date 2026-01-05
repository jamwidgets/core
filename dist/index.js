/**
 * @seriphxyz/core
 *
 * Framework-agnostic API client, types, and controllers for Seriph widgets.
 * Use this package directly or through framework-specific wrappers like @seriphxyz/astro.
 */
// =============================================================================
// Constants
// =============================================================================
export const DEFAULT_ENDPOINT = "https://seriph.xyz";
export const API_PATH = "/api/v1";
export const VISITOR_STORAGE_KEY = "seriph_visitor_id";
// =============================================================================
// Helpers
// =============================================================================
/** Build full API URL from endpoint and path */
export function buildUrl(endpoint, path) {
    const base = (endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, "");
    return `${base}${API_PATH}${path}`;
}
/**
 * Read Seriph config from meta tags in the document head.
 * Looks for:
 * - <meta name="seriph-site-key" content="sk-xxx" />
 * - <meta name="seriph-endpoint" content="https://..." /> (optional)
 *
 * @example
 * // In your HTML head:
 * <meta name="seriph-site-key" content="sk-xxx" />
 *
 * // In your JS:
 * const config = getConfigFromMeta();
 * if (config) {
 *   const poll = createPoll({ ...config, slug: "my-poll" });
 * }
 */
export function getConfigFromMeta() {
    if (typeof document === "undefined") {
        return null;
    }
    const siteKeyMeta = document.querySelector('meta[name="seriph-site-key"]');
    const siteKey = siteKeyMeta?.getAttribute("content");
    if (!siteKey) {
        return null;
    }
    const endpointMeta = document.querySelector('meta[name="seriph-endpoint"]');
    const endpoint = endpointMeta?.getAttribute("content") || undefined;
    return { siteKey, endpoint };
}
/** Get site key from config, with fallback to meta tag */
export function getSiteKey(config) {
    if (config.siteKey) {
        return config.siteKey;
    }
    // Try reading from meta tag
    const metaConfig = getConfigFromMeta();
    if (metaConfig?.siteKey) {
        return metaConfig.siteKey;
    }
    throw new Error("siteKey is required. Either pass it as a prop or add <meta name=\"seriph-site-key\" content=\"your-key\" /> to your document head.");
}
/** Resolve full config, merging props with meta tag fallbacks */
export function resolveConfig(config) {
    const metaConfig = getConfigFromMeta();
    const siteKey = config.siteKey || metaConfig?.siteKey;
    if (!siteKey) {
        throw new Error("siteKey is required. Either pass it as a prop or add <meta name=\"seriph-site-key\" content=\"your-key\" /> to your document head.");
    }
    return {
        siteKey,
        endpoint: config.endpoint || metaConfig?.endpoint,
    };
}
// =============================================================================
// Visitor Token Management
// =============================================================================
/** Custom visitor ID set by the site (e.g., authenticated user ID) */
let customVisitorId = null;
/** Generate a random UUID v4 */
function generateUUID() {
    // Use crypto.randomUUID if available, otherwise fallback
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older environments
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
/**
 * Set a custom visitor ID (e.g., authenticated user ID).
 * Useful for non-static sites where you have user sessions.
 * Set to null to revert to localStorage-based ID.
 */
export function setVisitorId(id) {
    customVisitorId = id;
}
/**
 * Get the current visitor ID.
 * Priority: custom ID > localStorage > generated UUID (SSR fallback)
 */
export function getVisitorId() {
    // Use custom ID if set (for authenticated users)
    if (customVisitorId) {
        return customVisitorId;
    }
    // SSR check - localStorage only exists in browser
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
        // Return a temporary UUID for SSR - will be replaced client-side
        return generateUUID();
    }
    // Use localStorage for anonymous visitors
    let visitorId = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!visitorId) {
        visitorId = generateUUID();
        localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
    }
    return visitorId;
}
/** Get common headers for API requests */
function getHeaders(siteKey) {
    let visitorId;
    try {
        visitorId = getVisitorId();
    }
    catch {
        // Fallback if localStorage access fails (e.g., private browsing, SSR)
        visitorId = generateUUID();
    }
    return {
        "X-Seriph-Key": siteKey,
        "X-Seriph-Visitor": visitorId,
    };
}
export async function submitForm(options) {
    const { endpoint, formSlug, data, formLoadTime } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, `/forms/${formSlug}/submit`);
    const payload = {
        ...data,
        _seriph_ts: formLoadTime || Math.floor(Date.now() / 1000),
    };
    const response = await fetch(url, {
        method: "POST",
        headers: {
            ...getHeaders(siteKey),
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Form submission failed: ${response.statusText}`);
    }
    return response.json();
}
export async function fetchComments(options) {
    const { endpoint, pageId } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, `/comments/${encodeURIComponent(pageId)}`);
    const response = await fetch(url, {
        headers: getHeaders(siteKey),
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.statusText}`);
    }
    const data = await response.json();
    return data.comment_threads || [];
}
export async function postComment(options) {
    const { endpoint, pageId, authorName, authorEmail, content, parentId } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, `/comments/${encodeURIComponent(pageId)}`);
    const response = await fetch(url, {
        method: "POST",
        headers: {
            ...getHeaders(siteKey),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            authorName,
            authorEmail,
            content,
            parentId,
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to post comment: ${response.statusText}`);
    }
    const data = await response.json();
    return data.comment;
}
export async function fetchReactions(options) {
    const { endpoint, pageId } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, `/reactions/${encodeURIComponent(pageId)}`);
    const response = await fetch(url, {
        headers: getHeaders(siteKey),
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch reactions: ${response.statusText}`);
    }
    const data = await response.json();
    const result = data.reaction_counts_with_user;
    return {
        ...result,
        userReactions: result.userReactions || [],
    };
}
export async function addReaction(options) {
    const { endpoint, pageId, reactionType = "like" } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, `/reactions/${encodeURIComponent(pageId)}`);
    const response = await fetch(url, {
        method: "POST",
        headers: {
            ...getHeaders(siteKey),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ reactionType }),
    });
    if (!response.ok) {
        throw new Error(`Failed to add reaction: ${response.statusText}`);
    }
    const data = await response.json();
    return data.reaction;
}
export async function removeReaction(options) {
    const { endpoint, pageId, reactionType = "like" } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, `/reactions/${encodeURIComponent(pageId)}`);
    const response = await fetch(url, {
        method: "DELETE",
        headers: {
            ...getHeaders(siteKey),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ reactionType }),
    });
    if (!response.ok) {
        throw new Error(`Failed to remove reaction: ${response.statusText}`);
    }
    const data = await response.json();
    return data.reaction;
}
export async function subscribe(options) {
    const { endpoint, email } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, "/subscribe");
    const response = await fetch(url, {
        method: "POST",
        headers: {
            ...getHeaders(siteKey),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
    });
    if (!response.ok) {
        throw new Error(`Subscription failed: ${response.statusText}`);
    }
    return response.json();
}
export async function fetchPosts(options) {
    const { endpoint, tag, limit = 500 } = options;
    const siteKey = getSiteKey(options);
    const baseUrl = (endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, "") + API_PATH;
    const url = new URL(`${baseUrl}/posts`);
    url.searchParams.set("limit", String(limit));
    if (tag) {
        url.searchParams.set("tag", tag);
    }
    const response = await fetch(url.toString(), {
        headers: getHeaders(siteKey),
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.posts;
}
export async function fetchPost(options) {
    const { endpoint, slug } = options;
    const siteKey = getSiteKey(options);
    const baseUrl = (endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, "") + API_PATH;
    const response = await fetch(`${baseUrl}/posts/${encodeURIComponent(slug)}`, {
        headers: getHeaders(siteKey),
    });
    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        throw new Error(`Failed to fetch post: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.public_post || data;
}
export async function joinWaitlist(options) {
    const { endpoint, email, name, source } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, "/waitlist");
    const response = await fetch(url, {
        method: "POST",
        headers: {
            ...getHeaders(siteKey),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, name, source }),
    });
    if (!response.ok) {
        throw new Error(`Failed to join waitlist: ${response.statusText}`);
    }
    return response.json();
}
export async function getViewCounts(options) {
    const { endpoint, pageId } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, `/views/${encodeURIComponent(pageId)}`);
    const response = await fetch(url, {
        headers: getHeaders(siteKey),
    });
    if (!response.ok) {
        throw new Error(`Failed to get view counts: ${response.statusText}`);
    }
    const data = await response.json();
    return data.page_view_counts;
}
export async function recordView(options) {
    const { endpoint, pageId } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, `/views/${encodeURIComponent(pageId)}`);
    const response = await fetch(url, {
        method: "POST",
        headers: getHeaders(siteKey),
    });
    if (!response.ok) {
        throw new Error(`Failed to record view: ${response.statusText}`);
    }
    const data = await response.json();
    return data.record_view_response;
}
export async function submitFeedback(options) {
    const { endpoint, type, content, email, pageUrl } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, "/feedback");
    const response = await fetch(url, {
        method: "POST",
        headers: {
            ...getHeaders(siteKey),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            feedback_type: type,
            content,
            email,
            page_url: pageUrl,
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to submit feedback: ${response.statusText}`);
    }
    return response.json();
}
export async function fetchPoll(options) {
    const { endpoint, slug } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, `/polls/${slug}`);
    const response = await fetch(url, {
        headers: getHeaders(siteKey),
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch poll: ${response.statusText}`);
    }
    const data = await response.json();
    return data.poll_with_results;
}
export async function votePoll(options) {
    const { endpoint, slug, selectedOptions } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, `/polls/${slug}/vote`);
    const response = await fetch(url, {
        method: "POST",
        headers: {
            ...getHeaders(siteKey),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ selected_options: selectedOptions }),
    });
    if (!response.ok) {
        throw new Error(`Failed to vote: ${response.statusText}`);
    }
    const data = await response.json();
    return data.vote_response;
}
export async function fetchAnnouncements(options) {
    const { endpoint } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, "/announcements");
    const response = await fetch(url, {
        headers: getHeaders(siteKey),
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch announcements: ${response.statusText}`);
    }
    const data = await response.json();
    return data.announcements || [];
}
export async function dismissAnnouncement(options) {
    const { endpoint, announcementId } = options;
    const siteKey = getSiteKey(options);
    const url = buildUrl(endpoint, `/announcements/${announcementId}/dismiss`);
    const response = await fetch(url, {
        method: "POST",
        headers: getHeaders(siteKey),
    });
    if (!response.ok) {
        throw new Error(`Failed to dismiss announcement: ${response.statusText}`);
    }
}
/**
 * Headless controller for subscribe forms.
 * Manages state without any DOM/framework dependencies.
 *
 * @example
 * const controller = new SubscribeController({ siteKey: 'xxx' });
 * controller.subscribe((state) => {
 *   console.log(state.status, state.message, state.error);
 * });
 * await controller.submit('user@example.com');
 */
export class SubscribeController {
    config;
    listeners = new Set();
    _state = { status: "idle", message: null, error: null };
    constructor(config) {
        this.config = config;
    }
    /** Get current state */
    getState() {
        return { ...this._state };
    }
    /** Subscribe to state changes */
    subscribe(listener) {
        this.listeners.add(listener);
        // Immediately call with current state
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }
    notify() {
        const state = this.getState();
        for (const listener of this.listeners) {
            listener(state);
        }
    }
    /** Submit email for subscription */
    async submit(email) {
        this._state = { status: "loading", message: null, error: null };
        this.notify();
        try {
            const result = await subscribe({ ...this.config, email });
            this._state = { status: "success", message: result.message, error: null };
            this.notify();
            return result;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { status: "error", message: error.message, error };
            this.notify();
            throw error;
        }
    }
    /** Reset to idle state */
    reset() {
        this._state = { status: "idle", message: null, error: null };
        this.notify();
    }
}
/**
 * Headless controller for waitlist forms.
 * Manages state without any DOM/framework dependencies.
 *
 * @example
 * const controller = new WaitlistController({ siteKey: 'xxx' });
 * controller.subscribe((state) => {
 *   console.log(state.status, state.message, state.position);
 * });
 * await controller.join('user@example.com', { name: 'John', source: 'homepage' });
 */
export class WaitlistController {
    config;
    listeners = new Set();
    _state = { status: "idle", message: null, position: null, error: null };
    constructor(config) {
        this.config = config;
    }
    getState() {
        return { ...this._state };
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }
    notify() {
        const state = this.getState();
        for (const listener of this.listeners) {
            listener(state);
        }
    }
    /** Join the waitlist */
    async join(email, options) {
        this._state = { status: "loading", message: null, position: null, error: null };
        this.notify();
        try {
            const result = await joinWaitlist({
                ...this.config,
                email,
                name: options?.name,
                source: options?.source,
            });
            this._state = {
                status: "success",
                message: result.message,
                position: result.position ?? null,
                error: null,
            };
            this.notify();
            return result;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { status: "error", message: error.message, position: null, error };
            this.notify();
            throw error;
        }
    }
    reset() {
        this._state = { status: "idle", message: null, position: null, error: null };
        this.notify();
    }
}
/**
 * Headless controller for forms.
 * Manages state without any DOM/framework dependencies.
 */
export class FormController {
    config;
    formSlug;
    listeners = new Set();
    loadTime;
    _state = { status: "idle", message: null, error: null };
    constructor(config, formSlug) {
        this.config = config;
        this.formSlug = formSlug;
        this.loadTime = Math.floor(Date.now() / 1000);
    }
    getState() {
        return { ...this._state };
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }
    notify() {
        const state = this.getState();
        for (const listener of this.listeners) {
            listener(state);
        }
    }
    async submit(data) {
        this._state = { status: "loading", message: null, error: null };
        this.notify();
        try {
            const result = await submitForm({
                ...this.config,
                formSlug: this.formSlug,
                data,
                formLoadTime: this.loadTime,
            });
            this._state = { status: "success", message: result.message, error: null };
            this.notify();
            return result;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { status: "error", message: error.message, error };
            this.notify();
            throw error;
        }
    }
    reset() {
        this._state = { status: "idle", message: null, error: null };
        this.loadTime = Math.floor(Date.now() / 1000);
        this.notify();
    }
}
/**
 * Headless controller for reactions.
 * Manages state and counts without any DOM/framework dependencies.
 */
export class ReactionsController {
    config;
    pageId;
    listeners = new Set();
    _state = { counts: {}, userReactions: [], status: "idle", error: null };
    constructor(config, pageId) {
        this.config = config;
        this.pageId = pageId;
    }
    getState() {
        return { ...this._state, counts: { ...this._state.counts }, userReactions: [...this._state.userReactions] };
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }
    notify() {
        const state = this.getState();
        for (const listener of this.listeners) {
            listener(state);
        }
    }
    /** Fetch reactions from the server */
    async fetch() {
        this._state = { ...this._state, status: "loading", error: null };
        this.notify();
        try {
            const result = await fetchReactions({ ...this.config, pageId: this.pageId });
            this._state = {
                ...this._state,
                counts: result.counts,
                userReactions: result.userReactions,
                status: "success",
                error: null,
            };
            this.notify();
            return this.getState();
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { ...this._state, status: "error", error };
            this.notify();
            throw error;
        }
    }
    async add(reactionType = "like") {
        try {
            const result = await addReaction({ ...this.config, pageId: this.pageId, reactionType });
            this._state.counts[reactionType] = result.count;
            if (!this._state.userReactions.includes(reactionType)) {
                this._state.userReactions = [...this._state.userReactions, reactionType];
            }
            this.notify();
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { ...this._state, error };
            this.notify();
            throw error;
        }
    }
    async remove(reactionType = "like") {
        try {
            const result = await removeReaction({ ...this.config, pageId: this.pageId, reactionType });
            this._state.counts[reactionType] = result.count;
            this._state.userReactions = this._state.userReactions.filter(r => r !== reactionType);
            this.notify();
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { ...this._state, error };
            this.notify();
            throw error;
        }
    }
}
/**
 * Headless controller for comments.
 * Manages state and comment list without any DOM/framework dependencies.
 */
export class CommentsController {
    config;
    pageId;
    listeners = new Set();
    _state = { comments: [], status: "idle", error: null };
    constructor(config, pageId) {
        this.config = config;
        this.pageId = pageId;
    }
    getState() {
        return { ...this._state, comments: [...this._state.comments] };
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }
    notify() {
        const state = this.getState();
        for (const listener of this.listeners) {
            listener(state);
        }
    }
    /** Fetch comments from the server */
    async fetch() {
        this._state = { ...this._state, status: "loading", error: null };
        this.notify();
        try {
            const comments = await fetchComments({ ...this.config, pageId: this.pageId });
            this._state = { comments, status: "success", error: null };
            this.notify();
            return comments;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { ...this._state, status: "error", error };
            this.notify();
            throw error;
        }
    }
    async post(authorName, content, options) {
        try {
            const comment = await postComment({
                ...this.config,
                pageId: this.pageId,
                authorName,
                content,
                authorEmail: options?.authorEmail,
                parentId: options?.parentId,
            });
            // Reload to get updated tree structure
            await this.fetch();
            return comment;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { ...this._state, error };
            this.notify();
            throw error;
        }
    }
}
/**
 * Headless controller for feedback forms.
 * Manages state without any DOM/framework dependencies.
 */
export class FeedbackController {
    config;
    listeners = new Set();
    _state = { status: "idle", message: null, error: null };
    constructor(config) {
        this.config = config;
    }
    getState() {
        return { ...this._state };
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }
    notify() {
        const state = this.getState();
        for (const listener of this.listeners) {
            listener(state);
        }
    }
    async submit(type, content, options) {
        this._state = { status: "loading", message: null, error: null };
        this.notify();
        try {
            const result = await submitFeedback({
                ...this.config,
                type,
                content,
                email: options?.email,
                pageUrl: options?.pageUrl,
            });
            this._state = { status: "success", message: result.message, error: null };
            this.notify();
            return result;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { status: "error", message: error.message, error };
            this.notify();
            throw error;
        }
    }
    reset() {
        this._state = { status: "idle", message: null, error: null };
        this.notify();
    }
}
/**
 * Headless controller for polls.
 * Manages poll state, voting, and results.
 */
export class PollController {
    config;
    slug;
    listeners = new Set();
    _state = { poll: null, status: "idle", error: null };
    constructor(config, slug) {
        this.config = config;
        this.slug = slug;
    }
    getState() {
        return { ...this._state };
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }
    notify() {
        const state = this.getState();
        for (const listener of this.listeners) {
            listener(state);
        }
    }
    /** Fetch poll data from the server */
    async fetch() {
        this._state = { ...this._state, status: "loading", error: null };
        this.notify();
        try {
            const poll = await fetchPoll({ ...this.config, slug: this.slug });
            this._state = { poll, status: "success", error: null };
            this.notify();
            return poll;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { ...this._state, status: "error", error };
            this.notify();
            throw error;
        }
    }
    /** Vote on the poll */
    async vote(selectedOptions) {
        try {
            const result = await votePoll({
                ...this.config,
                slug: this.slug,
                selectedOptions,
            });
            // Update state with new results
            if (this._state.poll) {
                this._state.poll = {
                    ...this._state.poll,
                    results: result.results,
                    totalVotes: result.totalVotes,
                    userVotes: selectedOptions,
                };
            }
            this.notify();
            return result;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { ...this._state, error };
            this.notify();
            throw error;
        }
    }
    /** Check if user has voted */
    hasVoted() {
        return !!this._state.poll?.userVotes && this._state.poll.userVotes.length > 0;
    }
}
/**
 * Headless controller for announcements.
 * Manages announcement list and dismissals.
 */
export class AnnouncementsController {
    config;
    listeners = new Set();
    _state = {
        announcements: [],
        dismissed: new Set(),
        status: "idle",
        error: null,
    };
    constructor(config) {
        this.config = config;
    }
    getState() {
        return {
            ...this._state,
            announcements: [...this._state.announcements],
            dismissed: new Set(this._state.dismissed),
        };
    }
    /** Get visible (non-dismissed) announcements */
    getVisibleAnnouncements() {
        return this._state.announcements.filter((a) => !this._state.dismissed.has(a.id));
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }
    notify() {
        const state = this.getState();
        for (const listener of this.listeners) {
            listener(state);
        }
    }
    /** Fetch announcements from the server */
    async fetch() {
        this._state = { ...this._state, status: "loading", error: null };
        this.notify();
        try {
            const announcements = await fetchAnnouncements(this.config);
            this._state = { ...this._state, announcements, status: "success", error: null };
            this.notify();
            return announcements;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { ...this._state, status: "error", error };
            this.notify();
            throw error;
        }
    }
    /** Dismiss an announcement */
    async dismiss(announcementId) {
        try {
            await dismissAnnouncement({ ...this.config, announcementId });
            this._state.dismissed.add(announcementId);
            this.notify();
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { ...this._state, error };
            this.notify();
            throw error;
        }
    }
}
/**
 * Headless controller for view counts.
 * Tracks page views and unique visitors.
 */
export class ViewCountsController {
    config;
    pageId;
    listeners = new Set();
    _state;
    constructor(config, pageId) {
        this.config = config;
        this.pageId = pageId;
        this._state = { pageId, views: 0, uniqueVisitors: 0, status: "idle", error: null };
    }
    getState() {
        return { ...this._state };
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }
    notify() {
        const state = this.getState();
        for (const listener of this.listeners) {
            listener(state);
        }
    }
    /** Fetch view counts from the server */
    async fetch() {
        this._state = { ...this._state, status: "loading", error: null };
        this.notify();
        try {
            const counts = await getViewCounts({ ...this.config, pageId: this.pageId });
            this._state = {
                ...this._state,
                views: counts.views,
                uniqueVisitors: counts.uniqueVisitors,
                status: "success",
                error: null,
            };
            this.notify();
            return counts;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { ...this._state, status: "error", error };
            this.notify();
            throw error;
        }
    }
    /** Record a view (automatically tracks unique visitors via visitor token) */
    async record() {
        try {
            const result = await recordView({ ...this.config, pageId: this.pageId });
            this._state = {
                ...this._state,
                views: result.views,
                uniqueVisitors: result.uniqueVisitors,
            };
            this.notify();
            return result;
        }
        catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            this._state = { ...this._state, error };
            this.notify();
            throw error;
        }
    }
}
