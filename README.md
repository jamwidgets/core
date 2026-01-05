# @seriphxyz/core

> **Note:** This repo is a read-only mirror. Source lives in a private monorepo.
> For issues/PRs, please open them here and we'll sync changes back.

Framework-agnostic API client, types, and headless controllers for [Seriph](https://seriph.xyz) widgets.

## Installation

```bash
npm install @seriphxyz/core
```

This is the base package used by `@seriphxyz/astro`, `@seriphxyz/react`, and `@seriphxyz/solid`. Use it directly when building custom integrations or with any JavaScript framework.

## API Functions

### Comments

```ts
import { fetchComments, postComment } from "@seriphxyz/core";

// Fetch comments for a page
const comments = await fetchComments({
  siteKey: "your-key",
  pageId: "my-page",
});

// Post a new comment
await postComment({
  siteKey: "your-key",
  pageId: "my-page",
  authorName: "John",
  content: "Great post!",
  authorEmail: "john@example.com", // optional
  parentId: "comment-id", // optional, for replies
});
```

### Reactions

```ts
import { fetchReactions, addReaction, removeReaction } from "@seriphxyz/core";

// Fetch reactions for a page
const { counts, userReactions } = await fetchReactions({
  siteKey: "your-key",
  pageId: "my-page",
});

// Add a reaction
await addReaction({
  siteKey: "your-key",
  pageId: "my-page",
  reactionType: "like", // or 'clap', 'heart', etc.
});

// Remove a reaction
await removeReaction({
  siteKey: "your-key",
  pageId: "my-page",
  reactionType: "like",
});
```

### Forms

```ts
import { submitForm } from "@seriphxyz/core";

await submitForm({
  siteKey: "your-key",
  formSlug: "contact",
  data: {
    name: "John",
    email: "john@example.com",
    message: "Hello!",
  },
});
```

### Subscriptions

```ts
import { subscribe } from "@seriphxyz/core";

await subscribe({
  siteKey: "your-key",
  email: "user@example.com",
});
```

### Waitlist

```ts
import { joinWaitlist } from "@seriphxyz/core";

await joinWaitlist({
  siteKey: "your-key",
  email: "user@example.com",
  name: "John", // optional
  source: "homepage", // optional
});
```

### Feedback

```ts
import { submitFeedback } from "@seriphxyz/core";

await submitFeedback({
  siteKey: "your-key",
  type: "bug", // 'bug' | 'feature' | 'general'
  content: "Found an issue...",
  email: "user@example.com", // optional
  pageUrl: "/about", // optional
});
```

### Polls

```ts
import { fetchPoll, votePoll } from "@seriphxyz/core";

// Fetch poll data
const poll = await fetchPoll({
  siteKey: "your-key",
  slug: "favorite-framework",
});

// Vote on a poll
await votePoll({
  siteKey: "your-key",
  slug: "favorite-framework",
  selectedOptions: ["option-1", "option-2"],
});
```

### Views

```ts
import { getViewCounts, recordView } from "@seriphxyz/core";

// Get view counts
const { views, uniqueVisitors } = await getViewCounts({
  siteKey: "your-key",
  pageId: "my-page",
});

// Record a view
await recordView({
  siteKey: "your-key",
  pageId: "my-page",
});
```

### Announcements

```ts
import { fetchAnnouncements, dismissAnnouncement } from "@seriphxyz/core";

// Fetch active announcements
const announcements = await fetchAnnouncements({
  siteKey: "your-key",
});

// Dismiss an announcement
await dismissAnnouncement({
  siteKey: "your-key",
  announcementId: 123,
});
```

### Posts

```ts
import { fetchPosts, fetchPost } from "@seriphxyz/core";

// Fetch all published posts
const posts = await fetchPosts({
  siteKey: "your-key",
  tag: "tutorials", // optional filter
  limit: 10, // optional
});

// Fetch a single post
const post = await fetchPost({
  siteKey: "your-key",
  slug: "my-post",
});
```

## Headless Controllers

Controllers manage state without any DOM dependencies. Use them to build custom UI or integrate with any framework.

```ts
import {
  SubscribeController,
  FormController,
  ReactionsController,
  CommentsController,
  WaitlistController,
  FeedbackController,
  PollController,
  AnnouncementsController,
  ViewCountsController,
} from "@seriphxyz/core";

// Example: Subscribe controller
const controller = new SubscribeController({ siteKey: "your-key" });

// Subscribe to state changes
controller.subscribe((state) => {
  console.log(state.status); // 'idle' | 'loading' | 'success' | 'error'
  console.log(state.message);
  console.log(state.error);
});

// Submit
await controller.submit("user@example.com");

// Reset
controller.reset();
```

### Available Controllers

| Controller | Purpose |
|------------|---------|
| `SubscribeController` | Email subscriptions |
| `FormController` | Form submissions |
| `ReactionsController` | Page reactions |
| `CommentsController` | Threaded comments |
| `WaitlistController` | Waitlist signups |
| `FeedbackController` | Feedback forms |
| `PollController` | Polls and voting |
| `AnnouncementsController` | Site announcements |
| `ViewCountsController` | Page view tracking |

## Visitor Management

Reactions and views track visitors using localStorage. For authenticated users, you can set a custom visitor ID:

```ts
import { setVisitorId, getVisitorId } from "@seriphxyz/core";

// Set custom visitor ID (e.g., for logged-in users)
setVisitorId("user-123");

// Get current visitor ID
const visitorId = getVisitorId();

// Revert to localStorage-based ID
setVisitorId(null);
```

## Types

All types are exported for TypeScript users:

```ts
import type {
  SeriphConfig,
  Comment,
  ReactionCounts,
  SeriphPost,
  Poll,
  Announcement,
  FeedbackType,
  ControllerStatus,
} from "@seriphxyz/core";
```

## License

MIT
