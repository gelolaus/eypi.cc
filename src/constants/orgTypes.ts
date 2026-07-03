export const ORG_TYPE_VALUES = [
  'shs_academic',
  'soar_academic',
  'socit_academic',
  'soe_academic',
  'som_academic',
  'soma_academic',
  'special_interest',
  'socio_civic',
  'performing_arts',
] as const

export type OrgType = (typeof ORG_TYPE_VALUES)[number]

export const ORG_TYPE_OPTIONS: { value: OrgType; label: string }[] = [
  { value: 'shs_academic', label: 'SHS Academic Org' },
  { value: 'soar_academic', label: 'SoAR Academic Org' },
  { value: 'socit_academic', label: 'SoCIT Academic Org' },
  { value: 'soe_academic', label: 'SoE Academic Org' },
  { value: 'som_academic', label: 'SoM Academic Org' },
  { value: 'soma_academic', label: 'SoMA Academic Org' },
  { value: 'special_interest', label: 'Special Interest Org' },
  { value: 'socio_civic', label: 'Socio-Civic Org' },
  { value: 'performing_arts', label: 'Performing Arts Group' },
]

const LABEL_BY_VALUE = Object.fromEntries(
  ORG_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<OrgType, string>

export function orgTypeLabel(type: OrgType | string | null | undefined): string | null {
  if (!type) return null
  return LABEL_BY_VALUE[type as OrgType] ?? null
}
