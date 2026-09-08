import { describe, expect, it } from "vitest";

import {
  collaborationActorCreateSchema,
  contactCreateSchema,
  municipalityCreateSchema,
  newsletterSetSchema,
} from "./schemas.js";

describe("CRM MCP schemas", () => {
  it("accepts a municipality with a four-digit municipality code", () => {
    const parsed = municipalityCreateSchema.parse({
      name: "Örebro kommun",
      municipality_code: "1880",
    });

    expect(parsed.country).toBe("Sweden");
    expect(parsed.municipality_code).toBe("1880");
  });

  it("rejects an invalid municipality code", () => {
    expect(() =>
      municipalityCreateSchema.parse({
        name: "Örebro kommun",
        municipality_code: "188",
      }),
    ).toThrow();
  });

  it("accepts a county administrative board as a collaboration actor", () => {
    const parsed = collaborationActorCreateSchema.parse({
      name: "Länsstyrelsen i Örebro län",
      organization_type: "county_administrative_board",
    });

    expect(parsed.organization_type).toBe("county_administrative_board");
  });

  it("requires a valid contact email", () => {
    expect(() =>
      contactCreateSchema.parse({
        organization_id: 1,
        first_name: "Sara",
        last_name: "Meurling",
        email: "not-an-email",
      }),
    ).toThrow();
  });

  it("accepts explicit newsletter subscription dates with timezone", () => {
    const parsed = newsletterSetSchema.parse({
      contact_id: 1,
      subscribed: true,
      effective_at: "2026-09-08T09:00:00+02:00",
    });

    expect(parsed.subscribed).toBe(true);
  });
});
