export interface CsvRow {
  id: string
  rowIndex: number
  rawData: Record<string, string>
  isSelected?: boolean
}

export interface ColumnMapping {
  firstNameCol: string | null
  lastNameCol: string | null
  fullNameCol: string | null
  emailCol: string
  clusterCol: string | null
  criteriaColumns: string[]
}

export interface ClusterConfig {
  id?: string | null
  value: string
  maxCount: number | null
  filters: Record<string, string[]>
  // live status (from GET /clusters)
  currentCount?: number
  remainingSlots?: number | null
}
