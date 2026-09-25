import {
  ArrowDownWideNarrow,
  BriefcaseBusiness,
  CircleDot,
  FileText,
  FolderKanban,
  ListTree,
  type LucideIcon,
  Tag,
} from 'lucide-react'

export const taskFilterAxisIcons: Record<
  'is' | 'project' | 'label' | 'has' | 'parent' | 'sort',
  LucideIcon
> = {
  is: CircleDot,
  project: FolderKanban,
  label: Tag,
  has: FileText,
  parent: ListTree,
  sort: ArrowDownWideNarrow,
}

export const taskFilterSyntaxIcons: Record<string, LucideIcon> = {
  ...taskFilterAxisIcons,
  context: BriefcaseBusiness,
}
