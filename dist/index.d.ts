/**
 * @seriphxyz/core
 *
 * Framework-agnostic API client, types, and controllers for Seriph widgets.
 * Use this package directly or through framework-specific wrappers like @seriphxyz/astro.
 */
export declare const DEFAULT_ENDPOINT = "https://seriph.xyz";
export declare const API_PATH = "/api/v1";
export declare const VISITOR_STORAGE_KEY = "seriph_visitor_id";
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
/** Build full API URL from endpoint and path */
export declare function buildUrl(endpoint: string | undefined, path: string): string;
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
export declare function getConfigFromMeta(): {
    siteKey: string;
    endpoint?: string;
} | null;
/** Get site key from config, with fallback to meta tag */
export declare function getSiteKey(config: SeriphConfig): string;
/** Resolve full config, merging props with meta tag fallbacks */
export declare function resolveConfig(config: Partial<SeriphConfig>): SeriphConfig;
/**
 * Set a custom visitor ID (e.g., authenticated user ID).
 * Useful for non-static sites where you have user sessions.
 * Set to null to revert to localStorage-based ID.
 */
export declare function setVisitorId(id: string | null): void;
/**
 * Get the current visitor ID.
 * Priority: custom ID > localStorage > generated UUID (SSR fallback)
 */
export declare function getVisitorId(): string;
export interface SubmitFormOptions extends SeriphConfig {
    formSlug: string;
    data: Record<string, unknown>;
    /** Form load timestamp for spam detection (auto-set if not provided) */
    formLoadTime?: number;
}
export declare function submitForm(options: SubmitFormOptions): Promise<FormSubmitResponse>;
export interface FetchCommentsOptions extends SeriphConfig {
    pageId: string;
}
export declare function fetchComments(options: FetchCommentsOptions): Promise<Comment[]>;
export interface PostCommentOptions extends SeriphConfig {
    pageId: string;
    authorName: string;
    authorEmail?: string;
    content: string;
    parentId?: string;
}
export declare function postComment(options: PostCommentOptions): Promise<Comment>;
export interface FetchReactionsOptions extends SeriphConfig {
    pageId: string;
}
export interface FetchReactionsResponse extends ReactionCounts {
    /** Reaction types the current visitor has added (based on visitor token) */
    userReactions: string[];
}
export declare function fetchReactions(options: FetchReactionsOptions): Promise<FetchReactionsResponse>;
export interface AddReactionOptions extends SeriphConfig {
    pageId: string;
    reactionType?: string;
}
export declare function addReaction(options: AddReactionOptions): Promise<{
    reactionType: string;
    count: number;
}>;
export interface RemoveReactionOptions extends SeriphConfig {
    pageId: string;
    reactionType?: string;
}
export declare function removeReaction(options: RemoveReactionOptions): Promise<{
    reactionType: string;
    count: number;
}>;
export interface SubscribeOptions extends SeriphConfig {
    email: string;
}
export declare function subscribe(options: SubscribeOptions): Promise<SubscribeResponse>;
export interface FetchPostsOptions extends SeriphConfig {
    /** Filter posts by tag */
    tag?: string;
    /** Maximum number of posts to fetch (default: 500) */
    limit?: number;
}
export declare function fetchPosts(options: FetchPostsOptions): Promise<SeriphPost[]>;
export interface FetchPostOptions extends SeriphConfig {
    /** The post slug to fetch */
    slug: string;
}
export declare function fetchPost(options: FetchPostOptions): Promise<SeriphPost | null>;
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
export declare function joinWaitlist(options: JoinWaitlistOptions): Promise<JoinWaitlistResponse>;
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
export declare function getViewCounts(options: ViewCountsOptions): Promise<ViewCounts>;
export declare function recordView(options: ViewCountsOptions): Promise<RecordViewResponse>;
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
export declare function submitFeedback(options: SubmitFeedbackOptions): Promise<SubmitFeedbackResponse>;
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
export declare function fetchPoll(options: FetchPollOptions): Promise<PollWithResults>;
export interface VotePollOptions extends SeriphConfig {
    slug: string;
    selectedOptions: string[];
}
export interface VotePollResponse {
    success: boolean;
    results: Record<string, number>;
    totalVotes: number;
}
export declare function votePoll(options: VotePollOptions): Promise<VotePollResponse>;
export type AnnouncementType = "info" | "warning" | "success" | "error";
export interface Announcement {
    id: number;
    content: string;
    announcementType: AnnouncementType;
    linkUrl?: string;
    linkText?: string;
    isDismissible: boolean;
}
export interface FetchAnnouncementsOptions extends SeriphConfig {
}
export declare function fetchAnnouncements(options: FetchAnnouncementsOptions): Promise<Announcement[]>;
export interface DismissAnnouncementOptions extends SeriphConfig {
    announcementId: number;
}
export declare function dismissAnnouncement(options: DismissAnnouncementOptions): Promise<void>;
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
export declare class SubscribeController {
    private config;
    private listeners;
    private _state;
    constructor(config: SeriphConfig);
    /** Get current state */
    getState(): SubscribeState;
    /** Subscribe to state changes */
    subscribe(listener: ControllerListener<SubscribeState>): () => void;
    private notify;
    /** Submit email for subscription */
    submit(email: string): Promise<SubscribeResponse>;
    /** Reset to idle state */
    reset(): void;
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
export declare class WaitlistController {
    private config;
    private listeners;
    private _state;
    constructor(config: SeriphConfig);
    getState(): WaitlistState;
    subscribe(listener: ControllerListener<WaitlistState>): () => void;
    private notify;
    /** Join the waitlist */
    join(email: string, options?: {
        name?: string;
        source?: string;
    }): Promise<JoinWaitlistResponse>;
    reset(): void;
}
/**
 * Headless controller for forms.
 * Manages state without any DOM/framework dependencies.
 */
export declare class FormController {
    private config;
    private formSlug;
    private listeners;
    private loadTime;
    private _state;
    constructor(config: SeriphConfig, formSlug: string);
    getState(): FormState;
    subscribe(listener: ControllerListener<FormState>): () => void;
    private notify;
    submit(data: Record<string, unknown>): Promise<FormSubmitResponse>;
    reset(): void;
}
/**
 * Headless controller for reactions.
 * Manages state and counts without any DOM/framework dependencies.
 */
export declare class ReactionsController {
    private config;
    private pageId;
    private listeners;
    private _state;
    constructor(config: SeriphConfig, pageId: string);
    getState(): ReactionsState;
    subscribe(listener: ControllerListener<ReactionsState>): () => void;
    private notify;
    /** Fetch reactions from the server */
    fetch(): Promise<ReactionsState>;
    add(reactionType?: string): Promise<void>;
    remove(reactionType?: string): Promise<void>;
}
/**
 * Headless controller for comments.
 * Manages state and comment list without any DOM/framework dependencies.
 */
export declare class CommentsController {
    private config;
    private pageId;
    private listeners;
    private _state;
    constructor(config: SeriphConfig, pageId: string);
    getState(): CommentsState;
    subscribe(listener: ControllerListener<CommentsState>): () => void;
    private notify;
    /** Fetch comments from the server */
    fetch(): Promise<Comment[]>;
    post(authorName: string, content: string, options?: {
        authorEmail?: string;
        parentId?: string;
    }): Promise<Comment>;
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
export declare class FeedbackController {
    private config;
    private listeners;
    private _state;
    constructor(config: SeriphConfig);
    getState(): FeedbackState;
    subscribe(listener: ControllerListener<FeedbackState>): () => void;
    private notify;
    submit(type: FeedbackType, content: string, options?: {
        email?: string;
        pageUrl?: string;
    }): Promise<SubmitFeedbackResponse>;
    reset(): void;
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
export declare class PollController {
    private config;
    private slug;
    private listeners;
    private _state;
    constructor(config: SeriphConfig, slug: string);
    getState(): PollState;
    subscribe(listener: ControllerListener<PollState>): () => void;
    private notify;
    /** Fetch poll data from the server */
    fetch(): Promise<PollWithResults>;
    /** Vote on the poll */
    vote(selectedOptions: string[]): Promise<VotePollResponse>;
    /** Check if user has voted */
    hasVoted(): boolean;
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
export declare class AnnouncementsController {
    private config;
    private listeners;
    private _state;
    constructor(config: SeriphConfig);
    getState(): AnnouncementsState;
    /** Get visible (non-dismissed) announcements */
    getVisibleAnnouncements(): Announcement[];
    subscribe(listener: ControllerListener<AnnouncementsState>): () => void;
    private notify;
    /** Fetch announcements from the server */
    fetch(): Promise<Announcement[]>;
    /** Dismiss an announcement */
    dismiss(announcementId: number): Promise<void>;
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
export declare class ViewCountsController {
    private config;
    private pageId;
    private listeners;
    private _state;
    constructor(config: SeriphConfig, pageId: string);
    getState(): ViewCountsState;
    subscribe(listener: ControllerListener<ViewCountsState>): () => void;
    private notify;
    /** Fetch view counts from the server */
    fetch(): Promise<ViewCounts>;
    /** Record a view (automatically tracks unique visitors via visitor token) */
    record(): Promise<RecordViewResponse>;
}
//# sourceMappingURL=index.d.ts.map