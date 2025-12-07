/**
 * Email Newsletter Writer - draft structured newsletters for recurring campaigns.
 *
 * Design goals:
 * - Campaign-level entity (per audience / brand).
 * - Multiple newsletter issues under a campaign.
 * - Each issue can store sections/blocks for richer layouts.
 */

import { defineTable, column, NOW } from "astro:db";

export const NewsletterCampaigns = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    name: column.text(),                             // e.g. "Weekly Dev Tips"
    description: column.text({ optional: true }),
    audienceDescription: column.text({ optional: true }),
    senderName: column.text({ optional: true }),
    senderEmail: column.text({ optional: true }),
    defaultLanguage: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const NewsletterIssues = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    campaignId: column.text({
      references: () => NewsletterCampaigns.columns.id,
    }),
    userId: column.text(),                           // duplicated for easier queries
    issueNumber: column.number({ optional: true }),  // e.g. 1, 2, 3...
    subjectLine: column.text(),
    preheaderText: column.text({ optional: true }),  // short preview line
    status: column.text({ optional: true }),         // "draft", "ready", "sent"
    scheduledAt: column.date({ optional: true }),
    sentAt: column.date({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const NewsletterBlocks = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    issueId: column.text({
      references: () => NewsletterIssues.columns.id,
    }),
    orderIndex: column.number(),
    blockType: column.text({ optional: true }),      // "header", "text", "cta", "image", "quote", etc.
    heading: column.text({ optional: true }),
    body: column.text({ optional: true }),           // main text of the block
    ctaLabel: column.text({ optional: true }),
    ctaUrl: column.text({ optional: true }),
    imageUrl: column.text({ optional: true }),
    metaJson: column.text({ optional: true }),       // any extra block config as JSON
    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  NewsletterCampaigns,
  NewsletterIssues,
  NewsletterBlocks,
} as const;
