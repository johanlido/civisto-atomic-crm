import * as z from "zod/v4";

export const organizationTypeSchema = z.enum([
  "municipality",
  "county_administrative_board",
  "government_agency",
  "region",
  "municipal_company",
  "nonprofit",
  "university",
  "private_company",
  "other",
]);

export const collaborationActorTypeSchema = z.enum([
  "county_administrative_board",
  "government_agency",
  "region",
  "municipal_company",
  "nonprofit",
  "university",
  "private_company",
  "other",
]);

const optionalUrl = z.url().optional();
const optionalText = z.string().trim().min(1).max(2_000).optional();
const optionalSalesId = z.int().positive().optional();
const optionalIdempotencyKey = z.string().trim().min(8).max(200).optional();

const organizationBaseSchema = z.object({
  name: z.string().trim().min(2).max(300),
  organization_number: z.string().trim().min(2).max(64).optional(),
  website: optionalUrl,
  linkedin_url: optionalUrl,
  phone_number: z.string().trim().min(3).max(80).optional(),
  address: optionalText,
  zipcode: z.string().trim().min(2).max(32).optional(),
  city: z.string().trim().min(2).max(120).optional(),
  country: z.string().trim().min(2).max(120).default("Sweden"),
  description: optionalText,
  sector: z.string().trim().min(2).max(160).optional(),
  sales_id: optionalSalesId,
  idempotency_key: optionalIdempotencyKey,
});

export const municipalityCreateSchema = organizationBaseSchema.extend({
  municipality_code: z
    .string()
    .regex(/^\d{4}$/, "Kommunkod ska vara fyra siffror")
    .optional(),
});

export const collaborationActorCreateSchema = organizationBaseSchema.extend({
  organization_type: collaborationActorTypeSchema,
});

export const contactCreateSchema = z.object({
  organization_id: z.int().positive(),
  first_name: z.string().trim().min(1).max(120),
  last_name: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200).optional(),
  email: z.email(),
  email_type: z.enum(["Work", "Home", "Other"]).default("Work"),
  phone: z.string().trim().min(3).max(80).optional(),
  phone_type: z.enum(["Work", "Home", "Other"]).default("Work"),
  linkedin_url: optionalUrl,
  background: optionalText,
  status: z.string().trim().min(1).max(100).optional(),
  sales_id: optionalSalesId,
  newsletter_subscribed: z.boolean().default(false),
  newsletter_effective_at: z.iso.datetime({ offset: true }).optional(),
  idempotency_key: optionalIdempotencyKey,
});

export const newsletterSetSchema = z.object({
  contact_id: z.int().positive(),
  subscribed: z.boolean(),
  effective_at: z.iso.datetime({ offset: true }).optional(),
  source: z.string().trim().min(2).max(160).optional(),
  idempotency_key: optionalIdempotencyKey,
});

export const contactGetSchema = z.object({
  contact_id: z.int().positive(),
});

export type MunicipalityCreateInput = z.infer<typeof municipalityCreateSchema>;
export type CollaborationActorCreateInput = z.infer<
  typeof collaborationActorCreateSchema
>;
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type NewsletterSetInput = z.infer<typeof newsletterSetSchema>;
