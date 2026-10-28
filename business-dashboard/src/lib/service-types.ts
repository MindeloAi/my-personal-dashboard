/**
 * What kind of work a project is. Stored as free text (projects.service_type
 * has no CHECK), so adding an option here needs no migration. The first three
 * are the original values; existing projects keep them until re-sorted.
 */
export const SERVICE_TYPES = [
  "Web Dev",
  "Automation",
  "Hybrid",
  "Website",
  "Web App / Operational Software",
  "Business Dashboard",
  "AI Agent (Voice / Chat)",
  "E-commerce",
  "Mobile App",
  "Integration / API",
  "Branding & Design",
  "Marketing & Social Media",
  "Hosting & Maintenance",
  "Consulting",
  "Other",
] as const;

/** The options for a select, keeping a stored value that is not in the list. */
export function serviceTypeOptions(current?: string): string[] {
  const list: string[] = [...SERVICE_TYPES];
  return current && !list.includes(current) ? [current, ...list] : list;
}
