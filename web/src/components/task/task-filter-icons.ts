import {
  ArrowDownWideNarrow,
  BriefcaseBusiness,
  CircleDot,
  FileText,
  FolderKanban,
  ListFilter,
  ListTree,
  type LucideIcon,
  Tag,
} from 'lucide-react'

export const taskFilterAxisIcons: Record<
  'is' | 'project' | 'label' | 'priority' | 'has' | 'parent' | 'sort' | 'field',
  LucideIcon
> = {
  is: CircleDot,
  project: FolderKanban,
  label: Tag,
  priority: CircleDot,
  has: FileText,
  parent: ListTree,
  sort: ArrowDownWideNarrow,
  field: ListFilter,
}

export const taskFilterSyntaxIcons: Record<string, LucideIcon> = {
  ...taskFilterAxisIcons,
  context: BriefcaseBusiness,
}
