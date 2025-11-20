import { Mars, NonBinary, Venus } from "lucide-react";

export const defaultDarkModeLogo = "./logos/logo_atomic_crm_dark.svg";
export const defaultLightModeLogo = "./logos/logo_atomic_crm_light.svg";

export const defaultTitle = "Atomic CRM";

// Civisto-specific company sectors for indoor/outdoor monitoring
export const defaultCompanySectors = [
  "Hotels & Hospitality",
  "Office Buildings",
  "Investment company",
  "Commercial Real Estate",
  "Residential Buildings",
  "Healthcare Facilities",
  "Educational Institutions",
  "Municipal & Government",
  "Retail & Shopping Centers",
  "Industrial & Manufacturing",
  "Data Centers",
  "Sports & Recreation Facilities",
  "Transportation & Infrastructure",
  "Cultural & Entertainment Venues",
  "Co-working Spaces",
  "Property Management",
  "Facility Management Services",
  "Construction & Development",
  "Other",
];

// Deal stages (keeping original values for backward compatibility)
export const defaultDealStages = [
  { value: "initial-contact", label: "Initial Contact" },
  { value: "opportunity", label: "Opportunity" },
  { value: "proposal-sent", label: "Proposal Sent" },
  { value: "in-negociation", label: "In Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "delayed", label: "Delayed" },
];

export const defaultDealPipelineStatuses = ["won"];

// Civisto service offerings
export const defaultDealCategories = [
  "Indoor QR-Code reporting",
  "Outdoor Geo reorting",
  "API Integration",
  "Consulting Services",
  "Indoor Air Quality Monitoring",
  "Outdoor Environmental Monitoring",
  "Energy Monitoring & Reporting",
  "Climate Data Analytics",
  "Other",
];

// Lead temperature and customer status
export const defaultNoteStatuses = [
  { value: "cold", label: "Cold Lead", color: "#7dbde8" },
  { value: "warm", label: "Warm Lead", color: "#e8cb7d" },
  { value: "hot", label: "Hot Lead", color: "#e88b7d" },
  { value: "customer", label: "Active Customer", color: "#a4e87d" },
  { value: "churned", label: "Churned", color: "#e87d7d" },
];

// SaaS sales and customer success task types
export const defaultTaskTypes = [
  "Discovery Call",
  "Follow-up Email",
  "Demo Call",
  "Send Proposal",
  "Contract Review",
  "Onboarding Call",
  "Technical Setup",
  "Training Session",
  "Consulting",
  "Check-in Call",
  "Renewal Discussion",
  "Upsell Meeting",
  "Support Ticket",
  "Site Visit",
  "Sensor Installation",
  "Data Review",
  "None",
];

export const defaultContactGender = [
  { value: "male", label: "He/Him", icon: Mars },
  { value: "female", label: "She/Her", icon: Venus },
];
