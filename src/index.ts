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
// Types
// =============================================================================

export interface SeriphConfig {
  /** Your site key (required) */
  siteKey: string;
  /** Base URL of your Seriph instance (default: 'https://seriph.xyz') */
  endpoint?: string;
}

export interface Comment {
  id: string;
  pageId: string;
  parentId?: string;
  authorName: string;
  content: string;
  createdAt: string;
  replies: Comment[];
}

export interface ReactionCounts {
  pageId: string;
  counts: Record<string, number>;
}

export interface FormSubmitResponse {
  success: boolean;
  message: string;
}

export interface SubscribeResponse {
  success: boolean;
  message: string;
}

export interface SeriphPost {
  id: string;
  title: string;
  slug: string;
  /** Post content as Markdown */
  content: string;
  /** Raw TipTap/ProseMirror JSON content (for custom rendering) */
  contentJson?: string;
  excerpt?: string;
  coverImage?: string;
  metaTitle?: string;
  metaDescription?: string;
  tags: string[];
  publishedAt: string;
}

// =============================================================================
// Helpers
// =============================================================================

/** Build full API URL from endpoint and path */
export function buildUrl(endpoint: string | undefined, path: string): string {
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
export function getConfigFromMeta(): { siteKey: string; endpoint?: string } | null {
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
export function getSiteKey(config: SeriphConfig): string {
  if (config.siteKey) {
    return config.siteKey;
  }

  // Try reading from meta tag
  const metaConfig = getConfigFromMeta();
  if (metaConfig?.siteKey) {
    return metaConfig.siteKey;
  }

  throw new Error(
    "siteKey is required. Either pass it as a prop or add <meta name=\"seriph-site-key\" content=\"your-key\" /> to your document head."
  );
}

/** Resolve full config, merging props with meta tag fallbacks */
export function resolveConfig(config: Partial<SeriphConfig>): SeriphConfig {
  const metaConfig = getConfigFromMeta();

  const siteKey = config.siteKey || metaConfig?.siteKey;
  if (!siteKey) {
    throw new Error(
      "siteKey is required. Either pass it as a prop or add <meta name=\"seriph-site-key\" content=\"your-key\" /> to your document head."
    );
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
let customVisitorId: string | null = null;

/** Generate a random UUID v4 */
function generateUUID(): string {
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
export function setVisitorId(id: string | null): void {
  customVisitorId = id;
}

/**
 * Get the current visitor ID.
 * Priority: custom ID > localStorage > generated UUID (SSR fallback)
 */
export function getVisitorId(): string {
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
function getHeaders(siteKey: string): Record<string, string> {
  let visitorId: string;
  try {
    visitorId = getVisitorId();
  } catch {
    // Fallback if localStorage access fails (e.g., private browsing, SSR)
    visitorId = generateUUID();
  }
  return {
    "X-Seriph-Key": siteKey,
    "X-Seriph-Visitor": visitorId,
  };
}

// =============================================================================
// API Functions - Forms
// =============================================================================

export interface SubmitFormOptions extends SeriphConfig {
  formSlug: string;
  data: Record<string, unknown>;
  /** Form load timestamp for spam detection (auto-set if not provided) */
  formLoadTime?: number;
}

export async function submitForm(options: SubmitFormOptions): Promise<FormSubmitResponse> {
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

// =============================================================================
// API Functions - Comments
// =============================================================================

export interface FetchCommentsOptions extends SeriphConfig {
  pageId: string;
}

export async function fetchComments(options: FetchCommentsOptions): Promise<Comment[]> {
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

export interface PostCommentOptions extends SeriphConfig {
  pageId: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  parentId?: string;
}

export async function postComment(options: PostCommentOptions): Promise<Comment> {
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

// =============================================================================
// API Functions - Reactions
// =============================================================================

export interface FetchReactionsOptions extends SeriphConfig {
  pageId: string;
}

export interface FetchReactionsResponse extends ReactionCounts {
  /** Reaction types the current visitor has added (based on visitor token) */
  userReactions: string[];
}

export async function fetchReactions(options: FetchReactionsOptions): Promise<FetchReactionsResponse> {
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

export interface AddReactionOptions extends SeriphConfig {
  pageId: string;
  reactionType?: string;
}

export async function addReaction(
  options: AddReactionOptions
): Promise<{ reactionType: string; count: number }> {
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

export interface RemoveReactionOptions extends SeriphConfig {
  pageId: string;
  reactionType?: string;
}

export async function removeReaction(
  options: RemoveReactionOptions
): Promise<{ reactionType: string; count: number }> {
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

// =============================================================================
// API Functions - Subscriptions
// =============================================================================

export interface SubscribeOptions extends SeriphConfig {
  email: string;
}

export async function subscribe(options: SubscribeOptions): Promise<SubscribeResponse> {
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

// =============================================================================
// API Functions - Posts
// =============================================================================

export interface FetchPostsOptions extends SeriphConfig {
  /** Filter posts by tag */
  tag?: string;
  /** Maximum number of posts to fetch (default: 500) */
  limit?: number;
}

export async function fetchPosts(options: FetchPostsOptions): Promise<SeriphPost[]> {
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

export interface FetchPostOptions extends SeriphConfig {
  /** The post slug to fetch */
  slug: string;
}

export async function fetchPost(options: FetchPostOptions): Promise<SeriphPost | null> {
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

// =============================================================================
// API Functions - Waitlist
// =============================================================================

export interface JoinWaitlistOptions extends SeriphConfig {
  email: string;
  name?: string;
  /** Where the signup came from (e.g., "homepage", "blog") */
  source?: string;
}

export interface JoinWaitlistResponse {
  success: boolean;
  message: string;
  /** Position in waitlist (if site chooses to show it) */
  position?: number;
}

export async function joinWaitlist(options: JoinWaitlistOptions): Promise<JoinWaitlistResponse> {
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

// =============================================================================
// API Functions - Views
// =============================================================================

export interface ViewCountsOptions extends SeriphConfig {
  pageId: string;
}

export interface ViewCounts {
  pageId: string;
  views: number;
  uniqueVisitors: number;
}

export interface RecordViewResponse extends ViewCounts {
  isNewVisitor: boolean;
}

export async function getViewCounts(options: ViewCountsOptions): Promise<ViewCounts> {
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

export async function recordView(options: ViewCountsOptions): Promise<RecordViewResponse> {
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

// =============================================================================
// API Functions - Feedback
// =============================================================================

export type FeedbackType = "bug" | "feature" | "general";

export interface SubmitFeedbackOptions extends SeriphConfig {
  type: FeedbackType;
  content: string;
  email?: string;
  /** Page URL where feedback was submitted */
  pageUrl?: string;
}

export interface SubmitFeedbackResponse {
  success: boolean;
  message: string;
}

export async function submitFeedback(options: SubmitFeedbackOptions): Promise<SubmitFeedbackResponse> {
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

// =============================================================================
// API Functions - Polls
// =============================================================================

export type ShowResultsMode = "always" | "after_vote" | "after_end" | "never";

export interface PollOption {
  id: string;
  text: string;
}

export interface PollSettings {
  multiSelect: boolean;
  showResults: ShowResultsMode;
}

export interface Poll {
  id: number;
  question: string;
  options: PollOption[];
  settings: PollSettings;
  endsAt?: string;
  isActive: boolean;
}

export interface PollWithResults extends Poll {
  results: Record<string, number>;
  totalVotes: number;
  /** Options the current visitor has voted for */
  userVotes?: string[];
}

export interface FetchPollOptions extends SeriphConfig {
  slug: string;
}

export async function fetchPoll(options: FetchPollOptions): Promise<PollWithResults> {
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

export interface VotePollOptions extends SeriphConfig {
  slug: string;
  selectedOptions: string[];
}

export interface VotePollResponse {
  success: boolean;
  results: Record<string, number>;
  totalVotes: number;
}

export async function votePoll(options: VotePollOptions): Promise<VotePollResponse> {
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

// =============================================================================
// API Functions - Announcements
// =============================================================================

export type AnnouncementType = "info" | "warning" | "success" | "error";

export interface Announcement {
  id: number;
  content: string;
  announcementType: AnnouncementType;
  linkUrl?: string;
  linkText?: string;
  isDismissible: boolean;
}

export interface FetchAnnouncementsOptions extends SeriphConfig {}

export async function fetchAnnouncements(options: FetchAnnouncementsOptions): Promise<Announcement[]> {
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

export interface DismissAnnouncementOptions extends SeriphConfig {
  announcementId: number;
}

export async function dismissAnnouncement(options: DismissAnnouncementOptions): Promise<void> {
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

// =============================================================================
// Controllers - Headless state management
// =============================================================================

export type ControllerStatus = "idle" | "loading" | "success" | "error";

/** State for subscribe controllers */
export interface SubscribeState {
  status: ControllerStatus;
  message: string | null;
  error: Error | null;
}

/** State for form controllers */
export interface FormState {
  status: ControllerStatus;
  message: string | null;
  error: Error | null;
}

/** State for reactions controllers */
export interface ReactionsState {
  counts: Record<string, number>;
  userReactions: string[];
  status: ControllerStatus;
  error: Error | null;
}

/** State for comments controllers */
export interface CommentsState {
  comments: Comment[];
  status: ControllerStatus;
  error: Error | null;
}

/** State for waitlist controllers */
export interface WaitlistState {
  status: ControllerStatus;
  message: string | null;
  position: number | null;
  error: Error | null;
}

export interface ControllerListener<T> {
  (state: T): void;
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
  private config: SeriphConfig;
  private listeners: Set<ControllerListener<SubscribeState>> = new Set();
  private _state: SubscribeState = { status: "idle", message: null, error: null };

  constructor(config: SeriphConfig) {
    this.config = config;
  }

  /** Get current state */
  getState(): SubscribeState {
    return { ...this._state };
  }

  /** Subscribe to state changes */
  subscribe(listener: ControllerListener<SubscribeState>): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /** Submit email for subscription */
  async submit(email: string): Promise<SubscribeResponse> {
    this._state = { status: "loading", message: null, error: null };
    this.notify();

    try {
      const result = await subscribe({ ...this.config, email });
      this._state = { status: "success", message: result.message, error: null };
      this.notify();
      return result;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { status: "error", message: error.message, error };
      this.notify();
      throw error;
    }
  }

  /** Reset to idle state */
  reset(): void {
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
  private config: SeriphConfig;
  private listeners: Set<ControllerListener<WaitlistState>> = new Set();
  private _state: WaitlistState = { status: "idle", message: null, position: null, error: null };

  constructor(config: SeriphConfig) {
    this.config = config;
  }

  getState(): WaitlistState {
    return { ...this._state };
  }

  subscribe(listener: ControllerListener<WaitlistState>): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /** Join the waitlist */
  async join(email: string, options?: { name?: string; source?: string }): Promise<JoinWaitlistResponse> {
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
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { status: "error", message: error.message, position: null, error };
      this.notify();
      throw error;
    }
  }

  reset(): void {
    this._state = { status: "idle", message: null, position: null, error: null };
    this.notify();
  }
}

/**
 * Headless controller for forms.
 * Manages state without any DOM/framework dependencies.
 */
export class FormController {
  private config: SeriphConfig;
  private formSlug: string;
  private listeners: Set<ControllerListener<FormState>> = new Set();
  private loadTime: number;
  private _state: FormState = { status: "idle", message: null, error: null };

  constructor(config: SeriphConfig, formSlug: string) {
    this.config = config;
    this.formSlug = formSlug;
    this.loadTime = Math.floor(Date.now() / 1000);
  }

  getState(): FormState {
    return { ...this._state };
  }

  subscribe(listener: ControllerListener<FormState>): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  async submit(data: Record<string, unknown>): Promise<FormSubmitResponse> {
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
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { status: "error", message: error.message, error };
      this.notify();
      throw error;
    }
  }

  reset(): void {
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
  private config: SeriphConfig;
  private pageId: string;
  private listeners: Set<ControllerListener<ReactionsState>> = new Set();
  private _state: ReactionsState = { counts: {}, userReactions: [], status: "idle", error: null };

  constructor(config: SeriphConfig, pageId: string) {
    this.config = config;
    this.pageId = pageId;
  }

  getState(): ReactionsState {
    return { ...this._state, counts: { ...this._state.counts }, userReactions: [...this._state.userReactions] };
  }

  subscribe(listener: ControllerListener<ReactionsState>): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /** Fetch reactions from the server */
  async fetch(): Promise<ReactionsState> {
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
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { ...this._state, status: "error", error };
      this.notify();
      throw error;
    }
  }

  async add(reactionType: string = "like"): Promise<void> {
    try {
      const result = await addReaction({ ...this.config, pageId: this.pageId, reactionType });
      this._state.counts[reactionType] = result.count;
      if (!this._state.userReactions.includes(reactionType)) {
        this._state.userReactions = [...this._state.userReactions, reactionType];
      }
      this.notify();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { ...this._state, error };
      this.notify();
      throw error;
    }
  }

  async remove(reactionType: string = "like"): Promise<void> {
    try {
      const result = await removeReaction({ ...this.config, pageId: this.pageId, reactionType });
      this._state.counts[reactionType] = result.count;
      this._state.userReactions = this._state.userReactions.filter(r => r !== reactionType);
      this.notify();
    } catch (e) {
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
  private config: SeriphConfig;
  private pageId: string;
  private listeners: Set<ControllerListener<CommentsState>> = new Set();
  private _state: CommentsState = { comments: [], status: "idle", error: null };

  constructor(config: SeriphConfig, pageId: string) {
    this.config = config;
    this.pageId = pageId;
  }

  getState(): CommentsState {
    return { ...this._state, comments: [...this._state.comments] };
  }

  subscribe(listener: ControllerListener<CommentsState>): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /** Fetch comments from the server */
  async fetch(): Promise<Comment[]> {
    this._state = { ...this._state, status: "loading", error: null };
    this.notify();

    try {
      const comments = await fetchComments({ ...this.config, pageId: this.pageId });
      this._state = { comments, status: "success", error: null };
      this.notify();
      return comments;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { ...this._state, status: "error", error };
      this.notify();
      throw error;
    }
  }

  async post(authorName: string, content: string, options?: { authorEmail?: string; parentId?: string }): Promise<Comment> {
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
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { ...this._state, error };
      this.notify();
      throw error;
    }
  }
}

/** State for feedback controllers */
export interface FeedbackState {
  status: ControllerStatus;
  message: string | null;
  error: Error | null;
}

/**
 * Headless controller for feedback forms.
 * Manages state without any DOM/framework dependencies.
 */
export class FeedbackController {
  private config: SeriphConfig;
  private listeners: Set<ControllerListener<FeedbackState>> = new Set();
  private _state: FeedbackState = { status: "idle", message: null, error: null };

  constructor(config: SeriphConfig) {
    this.config = config;
  }

  getState(): FeedbackState {
    return { ...this._state };
  }

  subscribe(listener: ControllerListener<FeedbackState>): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  async submit(
    type: FeedbackType,
    content: string,
    options?: { email?: string; pageUrl?: string }
  ): Promise<SubmitFeedbackResponse> {
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
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { status: "error", message: error.message, error };
      this.notify();
      throw error;
    }
  }

  reset(): void {
    this._state = { status: "idle", message: null, error: null };
    this.notify();
  }
}

/** State for poll controllers */
export interface PollState {
  poll: PollWithResults | null;
  status: ControllerStatus;
  error: Error | null;
}

/**
 * Headless controller for polls.
 * Manages poll state, voting, and results.
 */
export class PollController {
  private config: SeriphConfig;
  private slug: string;
  private listeners: Set<ControllerListener<PollState>> = new Set();
  private _state: PollState = { poll: null, status: "idle", error: null };

  constructor(config: SeriphConfig, slug: string) {
    this.config = config;
    this.slug = slug;
  }

  getState(): PollState {
    return { ...this._state };
  }

  subscribe(listener: ControllerListener<PollState>): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /** Fetch poll data from the server */
  async fetch(): Promise<PollWithResults> {
    this._state = { ...this._state, status: "loading", error: null };
    this.notify();

    try {
      const poll = await fetchPoll({ ...this.config, slug: this.slug });
      this._state = { poll, status: "success", error: null };
      this.notify();
      return poll;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { ...this._state, status: "error", error };
      this.notify();
      throw error;
    }
  }

  /** Vote on the poll */
  async vote(selectedOptions: string[]): Promise<VotePollResponse> {
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
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { ...this._state, error };
      this.notify();
      throw error;
    }
  }

  /** Check if user has voted */
  hasVoted(): boolean {
    return !!this._state.poll?.userVotes && this._state.poll.userVotes.length > 0;
  }
}

/** State for announcements controllers */
export interface AnnouncementsState {
  announcements: Announcement[];
  dismissed: Set<number>;
  status: ControllerStatus;
  error: Error | null;
}

/**
 * Headless controller for announcements.
 * Manages announcement list and dismissals.
 */
export class AnnouncementsController {
  private config: SeriphConfig;
  private listeners: Set<ControllerListener<AnnouncementsState>> = new Set();
  private _state: AnnouncementsState = {
    announcements: [],
    dismissed: new Set(),
    status: "idle",
    error: null,
  };

  constructor(config: SeriphConfig) {
    this.config = config;
  }

  getState(): AnnouncementsState {
    return {
      ...this._state,
      announcements: [...this._state.announcements],
      dismissed: new Set(this._state.dismissed),
    };
  }

  /** Get visible (non-dismissed) announcements */
  getVisibleAnnouncements(): Announcement[] {
    return this._state.announcements.filter((a) => !this._state.dismissed.has(a.id));
  }

  subscribe(listener: ControllerListener<AnnouncementsState>): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /** Fetch announcements from the server */
  async fetch(): Promise<Announcement[]> {
    this._state = { ...this._state, status: "loading", error: null };
    this.notify();

    try {
      const announcements = await fetchAnnouncements(this.config);
      this._state = { ...this._state, announcements, status: "success", error: null };
      this.notify();
      return announcements;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { ...this._state, status: "error", error };
      this.notify();
      throw error;
    }
  }

  /** Dismiss an announcement */
  async dismiss(announcementId: number): Promise<void> {
    try {
      await dismissAnnouncement({ ...this.config, announcementId });
      this._state.dismissed.add(announcementId);
      this.notify();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { ...this._state, error };
      this.notify();
      throw error;
    }
  }
}

/** State for view counts controllers */
export interface ViewCountsState {
  pageId: string;
  views: number;
  uniqueVisitors: number;
  status: ControllerStatus;
  error: Error | null;
}

/**
 * Headless controller for view counts.
 * Tracks page views and unique visitors.
 */
export class ViewCountsController {
  private config: SeriphConfig;
  private pageId: string;
  private listeners: Set<ControllerListener<ViewCountsState>> = new Set();
  private _state: ViewCountsState;

  constructor(config: SeriphConfig, pageId: string) {
    this.config = config;
    this.pageId = pageId;
    this._state = { pageId, views: 0, uniqueVisitors: 0, status: "idle", error: null };
  }

  getState(): ViewCountsState {
    return { ...this._state };
  }

  subscribe(listener: ControllerListener<ViewCountsState>): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /** Fetch view counts from the server */
  async fetch(): Promise<ViewCounts> {
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
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { ...this._state, status: "error", error };
      this.notify();
      throw error;
    }
  }

  /** Record a view (automatically tracks unique visitors via visitor token) */
  async record(): Promise<RecordViewResponse> {
    try {
      const result = await recordView({ ...this.config, pageId: this.pageId });
      this._state = {
        ...this._state,
        views: result.views,
        uniqueVisitors: result.uniqueVisitors,
      };
      this.notify();
      return result;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this._state = { ...this._state, error };
      this.notify();
      throw error;
    }
  }
}
