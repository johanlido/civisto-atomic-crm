export const organizationTypes = [
  { id: "municipality", name: "Kommun" },
  {
    id: "county_administrative_board",
    name: "Länsstyrelse",
  },
  { id: "government_agency", name: "Statlig myndighet" },
  { id: "region", name: "Region" },
  { id: "municipal_company", name: "Kommunalt bolag" },
  { id: "nonprofit", name: "Ideell organisation" },
  { id: "university", name: "Universitet eller högskola" },
  { id: "private_company", name: "Privat bolag" },
  { id: "other", name: "Annan organisation" },
] as const;

export type OrganizationType = (typeof organizationTypes)[number]["id"];

export const organizationTypeLabels = Object.fromEntries(
  organizationTypes.map(({ id, name }) => [id, name]),
) as Record<OrganizationType, string>;
