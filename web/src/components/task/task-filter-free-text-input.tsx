import { Input } from '@fohte/ui/input'
import { List, ListItem } from '@fohte/ui/list'
import { Popover, PopoverContent } from '@fohte/ui/popover'
import { buildSearchQuery, parseSearchQuery } from 'api/search-query-parser'
import { useEffect, useRef, useState } from 'react'

import { type SearchSyntaxHelpOptions } from '#components/search/search-syntax-help-data'
import { SearchSyntaxHelpPopover } from '#components/search/search-syntax-help-popover'
import type { Suggestion } from '#hooks/use-search'
import {
  applySuggestionToQuery,
  extractCurrentPrefix,
  useSearchSuggestions,
} from '#hooks/use-search'
import { useSearchSyntaxHelpSections } from '#hooks/use-search-syntax-help-sections'

interface TaskFilterFreeTextInputProps {
  id: string
  freeText: string
  projectFieldsAsChips?: boolean
  onCommit: (freeText: string) => void
  onBackspaceEmpty: () => void
  disabledSuggestionCategories?: readonly string[]
  placeholder?: string
  autoFocus?: boolean
  syntaxHelpOptions?: Omit<SearchSyntaxHelpOptions, 'prioritySettings'>
}

// チップ対応の条件は commit 時に入力から外す。project field 条件は、
// field chip が有効な行では chip に移し、それ以外では query text に残す。
export function TaskFilterFreeTextInput({
  id,
  freeText,
  projectFieldsAsChips = false,
  onCommit,
  onBackspaceEmpty,
  disabledSuggestionCategories = [],
  placeholder,
  autoFocus = false,
  syntaxHelpOptions,
}: TaskFilterFreeTextInputProps) {
  const [value, setValue] = useState(freeText)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasUncommittedChanges = useRef(false)
  const isHelpOpen = isFocused && value.trim() === ''
  const syntaxHelpSections = useSearchSyntaxHelpSections({
    ...(syntaxHelpOptions ?? { audience: 'task-filter' }),
    enabled: isHelpOpen,
  })

  // 未送信の編集がなければ、フォーカス中でも外部の条件変更に合わせて入力を同期する。
  useEffect(() => {
    if (
      document.activeElement === inputRef.current &&
      hasUncommittedChanges.current
    ) {
      return
    }
    setValue(freeText)
    hasUncommittedChanges.current = false
  }, [freeText])

  const currentPrefix = extractCurrentPrefix(value)
  const { data: suggestions } = useSearchSuggestions(currentPrefix)
  const availableSuggestions = suggestions?.filter(
    (suggestion) => !disabledSuggestionCategories.includes(suggestion.category),
  )
  const hasSuggestions =
    availableSuggestions != null &&
    availableSuggestions.length > 0 &&
    currentPrefix.length > 0

  const applySuggestion = (suggestion: Suggestion) => {
    setValue(applySuggestionToQuery(value, suggestion))
    hasUncommittedChanges.current = true
    setSelectedIndex(0)
  }

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed === freeText.trim()) {
      hasUncommittedChanges.current = false
      return
    }
    onCommit(trimmed)
    const typed = parseSearchQuery(trimmed)
    const remainingQuery = buildSearchQuery({
      freeText: typed.freeText,
      ...(!projectFieldsAsChips && typed.fields !== undefined
        ? { fields: typed.fields }
        : {}),
    })
    setValue(remainingQuery === '' ? '' : `${remainingQuery} `)
    hasUncommittedChanges.current = false
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return

    switch (e.key) {
      case 'ArrowDown':
        if (!hasSuggestions) return
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % availableSuggestions.length)
        break
      case 'ArrowUp':
        if (!hasSuggestions) return
        e.preventDefault()
        setSelectedIndex(
          (prev) =>
            (prev - 1 + availableSuggestions.length) %
            availableSuggestions.length,
        )
        break
      case 'Tab': {
        if (!hasSuggestions) return
        const selected = availableSuggestions[selectedIndex]
        if (selected == null) return
        e.preventDefault()
        applySuggestion(selected)
        break
      }
      case 'Enter': {
        e.preventDefault()
        const selected = hasSuggestions
          ? (availableSuggestions[selectedIndex] ?? null)
          : null
        if (selected != null) {
          applySuggestion(selected)
        } else {
          commit()
        }
        break
      }
      case 'Escape':
        e.preventDefault()
        setValue(freeText)
        hasUncommittedChanges.current = false
        break
      case 'Backspace':
        if (value === '') {
          onBackspaceEmpty()
        }
        break
    }
  }

  return (
    <div className="flex min-w-32 flex-1 items-center px-1">
      <Input
        id={id}
        ref={inputRef}
        autoFocus={autoFocus}
        type="text"
        variant="ghost"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          hasUncommittedChanges.current = true
          setSelectedIndex(0)
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setIsFocused(true)
        }}
        onBlur={() => {
          commit()
          setIsFocused(false)
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1"
        aria-label="Filter query"
      />
      <Popover open={isFocused && hasSuggestions} anchor={inputRef}>
        <PopoverContent
          initialFocus={false}
          padding="none"
          className="min-w-(--anchor-width)"
        >
          <List role="listbox">
            {availableSuggestions?.map((suggestion, index) => (
              <ListItem
                key={suggestion.value}
                highlighted={index === selectedIndex}
                onSelect={() => {
                  applySuggestion(suggestion)
                }}
              >
                <span>{suggestion.value}</span>
                <span className="text-muted-foreground">
                  {suggestion.display}
                </span>
              </ListItem>
            ))}
          </List>
        </PopoverContent>
      </Popover>
      <SearchSyntaxHelpPopover
        anchor={inputRef}
        open={isHelpOpen}
        sections={syntaxHelpSections}
      />
    </div>
  )
}
