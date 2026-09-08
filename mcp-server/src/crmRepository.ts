import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CollaborationActorCreateInput,
  ContactCreateInput,
  MunicipalityCreateInput,
  NewsletterSetInput,
} from "./schemas.js";

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

type AuditInput = {
  toolName: string;
  success: boolean;
  entityTable?: string;
  entityId?: string | number;
  idempotencyKey?: string;
  inputSummary?: Record<string, unknown>;
  error?: unknown;
};

export class CrmRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createMunicipality(input: MunicipalityCreateInput) {
    const existing = await this.findOrganization({
      organizationType: "municipality",
      name: input.name,
      municipalityCode: input.municipality_code,
      organizationNumber: input.organization_number,
    });

    if (existing) {
      await this.audit({
        toolName: "kommun_create",
        success: true,
        entityTable: "companies",
        entityId: existing.id,
        idempotencyKey: input.idempotency_key,
        inputSummary: {
          matched_existing: true,
          municipality_code: input.municipality_code,
        },
      });
      return { created: false, organization: existing };
    }

    const { data, error } = await this.supabase
      .from("companies")
      .insert({
        ...compact({
          name: input.name,
          organization_type: "municipality",
          municipality_code: input.municipality_code,
          organization_number: input.organization_number,
          website: input.website,
          linkedin_url: input.linkedin_url,
          phone_number: input.phone_number,
          address: input.address,
          zipcode: input.zipcode,
          city: input.city,
          country: input.country,
          description: input.description,
          sector: input.sector ?? "Municipal & Government",
          sales_id: input.sales_id,
        }),
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !data) {
      await this.auditFailure("kommun_create", input.idempotency_key, error, {
        municipality_code: input.municipality_code,
      });
      throw toRepositoryError(error, "COMMUNE_CREATE_FAILED");
    }

    await this.audit({
      toolName: "kommun_create",
      success: true,
      entityTable: "companies",
      entityId: data.id,
      idempotencyKey: input.idempotency_key,
      inputSummary: { municipality_code: input.municipality_code },
    });
    return { created: true, organization: data };
  }

  async createCollaborationActor(input: CollaborationActorCreateInput) {
    const existing = await this.findOrganization({
      organizationType: input.organization_type,
      name: input.name,
      organizationNumber: input.organization_number,
    });

    if (existing) {
      await this.audit({
        toolName: "samverkansaktor_create",
        success: true,
        entityTable: "companies",
        entityId: existing.id,
        idempotencyKey: input.idempotency_key,
        inputSummary: {
          matched_existing: true,
          organization_type: input.organization_type,
        },
      });
      return { created: false, organization: existing };
    }

    const { data, error } = await this.supabase
      .from("companies")
      .insert({
        ...compact({
          name: input.name,
          organization_type: input.organization_type,
          organization_number: input.organization_number,
          website: input.website,
          linkedin_url: input.linkedin_url,
          phone_number: input.phone_number,
          address: input.address,
          zipcode: input.zipcode,
          city: input.city,
          country: input.country,
          description: input.description,
          sector: input.sector,
          sales_id: input.sales_id,
        }),
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !data) {
      await this.auditFailure(
        "samverkansaktor_create",
        input.idempotency_key,
        error,
        { organization_type: input.organization_type },
      );
      throw toRepositoryError(error, "COLLABORATION_ACTOR_CREATE_FAILED");
    }

    await this.audit({
      toolName: "samverkansaktor_create",
      success: true,
      entityTable: "companies",
      entityId: data.id,
      idempotencyKey: input.idempotency_key,
      inputSummary: { organization_type: input.organization_type },
    });
    return { created: true, organization: data };
  }

  async createContact(input: ContactCreateInput) {
    const organization = await this.getOrganization(input.organization_id);
    const existing = await this.findContactByEmail(input.email);

    if (existing) {
      await this.audit({
        toolName: "kontakt_create",
        success: true,
        entityTable: "contacts",
        entityId: existing.id,
        idempotencyKey: input.idempotency_key,
        inputSummary: {
          matched_existing: true,
          organization_id: input.organization_id,
        },
      });
      return { created: false, contact: existing, organization };
    }

    const now = new Date().toISOString();
    const newsletterEffectiveAt = input.newsletter_effective_at ?? now;
    const { data, error } = await this.supabase
      .from("contacts")
      .insert(
        compact({
          first_name: input.first_name,
          last_name: input.last_name,
          title: input.title,
          company_id: input.organization_id,
          email_jsonb: [
            { email: input.email.toLowerCase(), type: input.email_type },
          ],
          phone_jsonb: input.phone
            ? [{ number: input.phone, type: input.phone_type }]
            : [],
          linkedin_url: input.linkedin_url,
          background: input.background,
          status: input.status,
          sales_id: input.sales_id,
          first_seen: now,
          last_seen: now,
          has_newsletter: input.newsletter_subscribed,
          newsletter_subscribed_at: input.newsletter_subscribed
            ? newsletterEffectiveAt
            : null,
          newsletter_unsubscribed_at: null,
          tags: [],
        }),
      )
      .select("*")
      .single();

    if (error || !data) {
      await this.auditFailure("kontakt_create", input.idempotency_key, error, {
        organization_id: input.organization_id,
      });
      throw toRepositoryError(error, "CONTACT_CREATE_FAILED");
    }

    await this.audit({
      toolName: "kontakt_create",
      success: true,
      entityTable: "contacts",
      entityId: data.id,
      idempotencyKey: input.idempotency_key,
      inputSummary: {
        organization_id: input.organization_id,
        newsletter_subscribed: input.newsletter_subscribed,
      },
    });
    return { created: true, contact: data, organization };
  }

  async setNewsletterSubscription(input: NewsletterSetInput) {
    const current = await this.getContact(input.contact_id);
    const effectiveAt = input.effective_at ?? new Date().toISOString();

    const patch = input.subscribed
      ? {
          has_newsletter: true,
          newsletter_subscribed_at: effectiveAt,
          newsletter_unsubscribed_at: null,
        }
      : {
          has_newsletter: false,
          newsletter_unsubscribed_at: effectiveAt,
        };

    const { data, error } = await this.supabase
      .from("contacts")
      .update(patch)
      .eq("id", input.contact_id)
      .select("*")
      .single();

    if (error || !data) {
      await this.auditFailure(
        "kontakt_nyhetsbrev_set",
        input.idempotency_key,
        error,
        { contact_id: input.contact_id, subscribed: input.subscribed },
      );
      throw toRepositoryError(error, "NEWSLETTER_UPDATE_FAILED");
    }

    await this.audit({
      toolName: "kontakt_nyhetsbrev_set",
      success: true,
      entityTable: "contacts",
      entityId: data.id,
      idempotencyKey: input.idempotency_key,
      inputSummary: {
        contact_id: input.contact_id,
        previous_subscribed: current.has_newsletter,
        subscribed: input.subscribed,
        source: input.source,
      },
    });
    return data;
  }

  async getContact(contactId: number) {
    const { data, error } = await this.supabase
      .from("contacts_summary")
      .select(
        "id,first_name,last_name,title,email_jsonb,phone_jsonb,company_id,company_name,has_newsletter,newsletter_subscribed_at,newsletter_unsubscribed_at,status",
      )
      .eq("id", contactId)
      .maybeSingle();

    if (error) throw toRepositoryError(error, "CONTACT_READ_FAILED");
    if (!data)
      throw new RepositoryError("Kontakten hittades inte", "CONTACT_NOT_FOUND");
    return data;
  }

  private async getOrganization(organizationId: number) {
    const { data, error } = await this.supabase
      .from("companies")
      .select("id,name,organization_type,municipality_code,organization_number")
      .eq("id", organizationId)
      .maybeSingle();

    if (error) throw toRepositoryError(error, "ORGANIZATION_READ_FAILED");
    if (!data) {
      throw new RepositoryError(
        "Organisationen hittades inte",
        "ORGANIZATION_NOT_FOUND",
      );
    }
    return data;
  }

  private async findContactByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await this.supabase
      .from("contacts")
      .select("*")
      .contains("email_jsonb", [{ email: normalizedEmail }])
      .limit(1);

    if (error) throw toRepositoryError(error, "CONTACT_LOOKUP_FAILED");
    return data?.[0] ?? null;
  }

  private async findOrganization(input: {
    organizationType: string;
    name: string;
    municipalityCode?: string;
    organizationNumber?: string;
  }) {
    if (input.municipalityCode) {
      const { data, error } = await this.supabase
        .from("companies")
        .select("*")
        .eq("municipality_code", input.municipalityCode)
        .maybeSingle();
      if (error) throw toRepositoryError(error, "ORGANIZATION_LOOKUP_FAILED");
      if (data) return data;
    }

    if (input.organizationNumber) {
      const { data, error } = await this.supabase
        .from("companies")
        .select("*")
        .ilike("organization_number", input.organizationNumber.trim())
        .limit(1);
      if (error) throw toRepositoryError(error, "ORGANIZATION_LOOKUP_FAILED");
      if (data?.[0]) return data[0];
    }

    const { data, error } = await this.supabase
      .from("companies")
      .select("*")
      .eq("organization_type", input.organizationType)
      .ilike("name", input.name.trim())
      .limit(1);
    if (error) throw toRepositoryError(error, "ORGANIZATION_LOOKUP_FAILED");
    return data?.[0] ?? null;
  }

  private async auditFailure(
    toolName: string,
    idempotencyKey: string | undefined,
    error: unknown,
    inputSummary: Record<string, unknown>,
  ) {
    await this.audit({
      toolName,
      success: false,
      idempotencyKey,
      inputSummary,
      error,
    });
  }

  private async audit(input: AuditInput) {
    const error = normalizeError(input.error);
    const { error: auditError } = await this.supabase
      .from("mcp_audit_log")
      .insert({
        tool_name: input.toolName,
        success: input.success,
        entity_table: input.entityTable,
        entity_id: input.entityId == null ? null : String(input.entityId),
        idempotency_key: input.idempotencyKey,
        input_summary: compact(input.inputSummary ?? {}),
        error_code: error?.code,
        error_message: error?.message,
      });

    if (auditError) {
      console.error("Failed to write MCP audit log", auditError.message);
    }
  }
}

const compact = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;

const normalizeError = (error: unknown) => {
  if (!error) return null;
  if (error instanceof RepositoryError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: error.message };
  }
  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: string; message?: string };
    return {
      code: candidate.code ?? "DATABASE_ERROR",
      message: candidate.message ?? "Databasoperationen misslyckades",
    };
  }
  return { code: "UNKNOWN_ERROR", message: String(error) };
};

const toRepositoryError = (error: unknown, fallbackCode: string) => {
  const normalized = normalizeError(error);
  return new RepositoryError(
    normalized?.message ?? "Databasoperationen misslyckades",
    normalized?.code ?? fallbackCode,
  );
};
