import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import {
  NewsletterBlocks,
  NewsletterCampaigns,
  NewsletterIssues,
  and,
  db,
  eq,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedCampaign(campaignId: string, userId: string) {
  const [campaign] = await db
    .select()
    .from(NewsletterCampaigns)
    .where(and(eq(NewsletterCampaigns.id, campaignId), eq(NewsletterCampaigns.userId, userId)));

  if (!campaign) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Campaign not found.",
    });
  }

  return campaign;
}

async function getOwnedIssue(issueId: string, userId: string) {
  const [issue] = await db
    .select()
    .from(NewsletterIssues)
    .where(and(eq(NewsletterIssues.id, issueId), eq(NewsletterIssues.userId, userId)));

  if (!issue) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Newsletter issue not found.",
    });
  }

  return issue;
}

export const server = {
  createCampaign: defineAction({
    input: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      audienceDescription: z.string().optional(),
      senderName: z.string().optional(),
      senderEmail: z.string().optional(),
      defaultLanguage: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [campaign] = await db
        .insert(NewsletterCampaigns)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          name: input.name,
          description: input.description,
          audienceDescription: input.audienceDescription,
          senderName: input.senderName,
          senderEmail: input.senderEmail,
          defaultLanguage: input.defaultLanguage,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { campaign } };
    },
  }),

  updateCampaign: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        audienceDescription: z.string().optional(),
        senderName: z.string().optional(),
        senderEmail: z.string().optional(),
        defaultLanguage: z.string().optional(),
      })
      .refine(
        (input) =>
          input.name !== undefined ||
          input.description !== undefined ||
          input.audienceDescription !== undefined ||
          input.senderName !== undefined ||
          input.senderEmail !== undefined ||
          input.defaultLanguage !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedCampaign(input.id, user.id);

      const [campaign] = await db
        .update(NewsletterCampaigns)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.audienceDescription !== undefined
            ? { audienceDescription: input.audienceDescription }
            : {}),
          ...(input.senderName !== undefined ? { senderName: input.senderName } : {}),
          ...(input.senderEmail !== undefined ? { senderEmail: input.senderEmail } : {}),
          ...(input.defaultLanguage !== undefined
            ? { defaultLanguage: input.defaultLanguage }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(NewsletterCampaigns.id, input.id))
        .returning();

      return { success: true, data: { campaign } };
    },
  }),

  listCampaigns: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const campaigns = await db
        .select()
        .from(NewsletterCampaigns)
        .where(eq(NewsletterCampaigns.userId, user.id));

      return { success: true, data: { items: campaigns, total: campaigns.length } };
    },
  }),

  createIssue: defineAction({
    input: z.object({
      campaignId: z.string().min(1),
      issueNumber: z.number().optional(),
      subjectLine: z.string().min(1),
      preheaderText: z.string().optional(),
      status: z.string().optional(),
      scheduledAt: z.date().optional(),
      sentAt: z.date().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedCampaign(input.campaignId, user.id);
      const now = new Date();

      const [issue] = await db
        .insert(NewsletterIssues)
        .values({
          id: crypto.randomUUID(),
          campaignId: input.campaignId,
          userId: user.id,
          issueNumber: input.issueNumber,
          subjectLine: input.subjectLine,
          preheaderText: input.preheaderText,
          status: input.status,
          scheduledAt: input.scheduledAt,
          sentAt: input.sentAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { issue } };
    },
  }),

  updateIssue: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        campaignId: z.string().min(1),
        issueNumber: z.number().optional(),
        subjectLine: z.string().optional(),
        preheaderText: z.string().optional(),
        status: z.string().optional(),
        scheduledAt: z.date().optional(),
        sentAt: z.date().optional(),
      })
      .refine(
        (input) =>
          input.issueNumber !== undefined ||
          input.subjectLine !== undefined ||
          input.preheaderText !== undefined ||
          input.status !== undefined ||
          input.scheduledAt !== undefined ||
          input.sentAt !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedCampaign(input.campaignId, user.id);

      const [existing] = await db
        .select()
        .from(NewsletterIssues)
        .where(
          and(
            eq(NewsletterIssues.id, input.id),
            eq(NewsletterIssues.campaignId, input.campaignId),
            eq(NewsletterIssues.userId, user.id)
          )
        );

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Issue not found.",
        });
      }

      const [issue] = await db
        .update(NewsletterIssues)
        .set({
          ...(input.issueNumber !== undefined ? { issueNumber: input.issueNumber } : {}),
          ...(input.subjectLine !== undefined ? { subjectLine: input.subjectLine } : {}),
          ...(input.preheaderText !== undefined ? { preheaderText: input.preheaderText } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
          ...(input.sentAt !== undefined ? { sentAt: input.sentAt } : {}),
          updatedAt: new Date(),
        })
        .where(eq(NewsletterIssues.id, input.id))
        .returning();

      return { success: true, data: { issue } };
    },
  }),

  listIssues: defineAction({
    input: z.object({
      campaignId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedCampaign(input.campaignId, user.id);

      const issues = await db
        .select()
        .from(NewsletterIssues)
        .where(
          and(
            eq(NewsletterIssues.campaignId, input.campaignId),
            eq(NewsletterIssues.userId, user.id)
          )
        );

      return { success: true, data: { items: issues, total: issues.length } };
    },
  }),

  createBlock: defineAction({
    input: z.object({
      issueId: z.string().min(1),
      orderIndex: z.number().int().optional(),
      blockType: z.string().optional(),
      heading: z.string().optional(),
      body: z.string().optional(),
      ctaLabel: z.string().optional(),
      ctaUrl: z.string().optional(),
      imageUrl: z.string().optional(),
      metaJson: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const issue = await getOwnedIssue(input.issueId, user.id);

      await getOwnedCampaign(issue.campaignId, user.id);

      const [block] = await db
        .insert(NewsletterBlocks)
        .values({
          id: crypto.randomUUID(),
          issueId: input.issueId,
          orderIndex: input.orderIndex ?? 1,
          blockType: input.blockType,
          heading: input.heading,
          body: input.body,
          ctaLabel: input.ctaLabel,
          ctaUrl: input.ctaUrl,
          imageUrl: input.imageUrl,
          metaJson: input.metaJson,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { block } };
    },
  }),

  updateBlock: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        issueId: z.string().min(1),
        orderIndex: z.number().int().optional(),
        blockType: z.string().optional(),
        heading: z.string().optional(),
        body: z.string().optional(),
        ctaLabel: z.string().optional(),
        ctaUrl: z.string().optional(),
        imageUrl: z.string().optional(),
        metaJson: z.string().optional(),
      })
      .refine(
        (input) =>
          input.orderIndex !== undefined ||
          input.blockType !== undefined ||
          input.heading !== undefined ||
          input.body !== undefined ||
          input.ctaLabel !== undefined ||
          input.ctaUrl !== undefined ||
          input.imageUrl !== undefined ||
          input.metaJson !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      const issue = await getOwnedIssue(input.issueId, user.id);
      await getOwnedCampaign(issue.campaignId, user.id);

      const [existing] = await db
        .select()
        .from(NewsletterBlocks)
        .where(and(eq(NewsletterBlocks.id, input.id), eq(NewsletterBlocks.issueId, input.issueId)));

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Block not found.",
        });
      }

      const [block] = await db
        .update(NewsletterBlocks)
        .set({
          ...(input.orderIndex !== undefined ? { orderIndex: input.orderIndex } : {}),
          ...(input.blockType !== undefined ? { blockType: input.blockType } : {}),
          ...(input.heading !== undefined ? { heading: input.heading } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.ctaLabel !== undefined ? { ctaLabel: input.ctaLabel } : {}),
          ...(input.ctaUrl !== undefined ? { ctaUrl: input.ctaUrl } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          ...(input.metaJson !== undefined ? { metaJson: input.metaJson } : {}),
        })
        .where(eq(NewsletterBlocks.id, input.id))
        .returning();

      return { success: true, data: { block } };
    },
  }),

  deleteBlock: defineAction({
    input: z.object({
      id: z.string().min(1),
      issueId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const issue = await getOwnedIssue(input.issueId, user.id);
      await getOwnedCampaign(issue.campaignId, user.id);

      const result = await db
        .delete(NewsletterBlocks)
        .where(and(eq(NewsletterBlocks.id, input.id), eq(NewsletterBlocks.issueId, input.issueId)));

      if (result.rowsAffected === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Block not found.",
        });
      }

      return { success: true };
    },
  }),

  listBlocks: defineAction({
    input: z.object({
      issueId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const issue = await getOwnedIssue(input.issueId, user.id);
      await getOwnedCampaign(issue.campaignId, user.id);

      const blocks = await db
        .select()
        .from(NewsletterBlocks)
        .where(eq(NewsletterBlocks.issueId, input.issueId));

      return { success: true, data: { items: blocks, total: blocks.length } };
    },
  }),
};
