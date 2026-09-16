import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeNode } from '#components/task/task-row-test-fixtures'
import type { TreeNode } from '#hooks/use-tasks'
import { useExpandedIds, useTreeOutliner } from '#hooks/use-tree-outliner'

function fireKey(
  key: string,
  opts: KeyboardEventInit = {},
  target: EventTarget = document.body,
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  })
  target.dispatchEvent(event)
  return event
}

function buildTree(): TreeNode[] {
  return [
    makeNode({
      id: 'a',
      number: 1,
      context: 'work',
      projectId: 'proj-1',
      labels: ['x'],
      children: [
        makeNode({
          id: 'b',
          number: 2,
          parentId: 'a',
          context: 'personal',
          labels: [],
        }),
      ],
      childCompletionCount: { completed: 0, total: 1 },
    }),
    makeNode({ id: 'c', number: 3 }),
  ]
}

describe('useTreeOutliner', () => {
  it('starts with every node expanded and nothing selected', () => {
    const { result } = renderHook(() =>
      useTreeOutliner(buildTree(), {
        enabled: true,
        onOpenSiblingCreate: () => {},
      }),
    )

    const observed: unknown[] = []
    observed.push(result.current.isExpanded('a'))
    observed.push(result.current.selectedRowId)

    expect(observed).toEqual([true, null])
  })

  it('toggles a node between expanded and collapsed', () => {
    const { result } = renderHook(() =>
      useTreeOutliner(buildTree(), {
        enabled: true,
        onOpenSiblingCreate: () => {},
      }),
    )

    act(() => {
      result.current.toggleExpand('a')
    })
    expect(result.current.isExpanded('a')).toBe(false)

    act(() => {
      result.current.toggleExpand('a')
    })
    expect(result.current.isExpanded('a')).toBe(true)
  })

  it('selects a row via selectRow', () => {
    const { result } = renderHook(() =>
      useTreeOutliner(buildTree(), {
        enabled: true,
        onOpenSiblingCreate: () => {},
      }),
    )

    act(() => {
      result.current.selectRow('b')
    })

    expect(result.current.selectedRowId).toBe('b')
  })

  it('calls onOpenSiblingCreate with null when "o" is pressed on a root row', () => {
    const onOpenSiblingCreate = vi.fn()
    const { result } = renderHook(() =>
      useTreeOutliner(buildTree(), { enabled: true, onOpenSiblingCreate }),
    )

    act(() => {
      result.current.selectRow('c')
    })
    act(() => {
      fireKey('o')
    })

    expect(onOpenSiblingCreate).toHaveBeenCalledWith(null)
  })

  it("calls onOpenSiblingCreate with the selected row's parent when 'o' is pressed on a child row", () => {
    const onOpenSiblingCreate = vi.fn()
    const tree = buildTree()
    const { result } = renderHook(() =>
      useTreeOutliner(tree, { enabled: true, onOpenSiblingCreate }),
    )

    act(() => {
      result.current.selectRow('b')
    })
    act(() => {
      fireKey('o')
    })

    expect(onOpenSiblingCreate).toHaveBeenCalledWith(tree[0])
  })

  it('does not call onOpenSiblingCreate on "o" when no row is selected', () => {
    const onOpenSiblingCreate = vi.fn()
    renderHook(() =>
      useTreeOutliner(buildTree(), { enabled: true, onOpenSiblingCreate }),
    )

    act(() => {
      fireKey('o')
    })

    expect(onOpenSiblingCreate).not.toHaveBeenCalled()
  })

  it('ignores "o" while a modifier key is held', () => {
    const onOpenSiblingCreate = vi.fn()
    const { result } = renderHook(() =>
      useTreeOutliner(buildTree(), { enabled: true, onOpenSiblingCreate }),
    )
    act(() => {
      result.current.selectRow('a')
    })

    act(() => {
      fireKey('o', { metaKey: true })
    })

    expect(onOpenSiblingCreate).not.toHaveBeenCalled()
  })

  it('ignores "o" while an editable element is focused', () => {
    const onOpenSiblingCreate = vi.fn()
    const input = document.createElement('input')
    document.body.appendChild(input)
    const { result } = renderHook(() =>
      useTreeOutliner(buildTree(), { enabled: true, onOpenSiblingCreate }),
    )
    act(() => {
      result.current.selectRow('a')
    })

    act(() => {
      fireKey('o', {}, input)
    })

    expect(onOpenSiblingCreate).not.toHaveBeenCalled()
    input.remove()
  })

  describe('arrow-key row selection', () => {
    it('moves selection to the next visible row on ArrowDown', () => {
      const { result } = renderHook(() =>
        useTreeOutliner(buildTree(), {
          enabled: true,
          onOpenSiblingCreate: () => {},
        }),
      )
      act(() => {
        result.current.selectRow('a')
      })

      act(() => {
        fireKey('ArrowDown')
      })

      expect(result.current.selectedRowId).toBe('b')
    })

    it('moves selection to the previous visible row on ArrowUp', () => {
      const { result } = renderHook(() =>
        useTreeOutliner(buildTree(), {
          enabled: true,
          onOpenSiblingCreate: () => {},
        }),
      )
      act(() => {
        result.current.selectRow('c')
      })

      act(() => {
        fireKey('ArrowUp')
      })

      expect(result.current.selectedRowId).toBe('b')
    })

    it('skips a collapsed subtree when moving selection', () => {
      const { result } = renderHook(() =>
        useTreeOutliner(buildTree(), {
          enabled: true,
          onOpenSiblingCreate: () => {},
        }),
      )
      act(() => {
        result.current.toggleExpand('a')
      })
      act(() => {
        result.current.selectRow('a')
      })

      act(() => {
        fireKey('ArrowDown')
      })

      expect(result.current.selectedRowId).toBe('c')
    })

    it('clamps at the last row on ArrowDown', () => {
      const { result } = renderHook(() =>
        useTreeOutliner(buildTree(), {
          enabled: true,
          onOpenSiblingCreate: () => {},
        }),
      )
      act(() => {
        result.current.selectRow('c')
      })

      act(() => {
        fireKey('ArrowDown')
      })

      expect(result.current.selectedRowId).toBe('c')
    })

    it('selects the first row on ArrowDown when nothing is selected yet', () => {
      const { result } = renderHook(() =>
        useTreeOutliner(buildTree(), {
          enabled: true,
          onOpenSiblingCreate: () => {},
        }),
      )

      act(() => {
        fireKey('ArrowDown')
      })

      expect(result.current.selectedRowId).toBe('a')
    })
  })

  it('does not attach a keydown listener when disabled', () => {
    const { result } = renderHook(() =>
      useTreeOutliner(buildTree(), {
        enabled: false,
        onOpenSiblingCreate: () => {},
      }),
    )

    act(() => {
      fireKey('ArrowDown')
    })

    expect(result.current.selectedRowId).toBeNull()
  })

  it('uses injected isExpanded/toggleExpand instead of its own state when provided', () => {
    const { result: expandState } = renderHook(() => useExpandedIds(false))
    const { result } = renderHook(() =>
      useTreeOutliner(buildTree(), {
        enabled: true,
        isExpanded: expandState.current.isExpanded,
        toggleExpand: expandState.current.toggleExpand,
      }),
    )

    expect(result.current.isExpanded('a')).toBe(false)

    act(() => {
      result.current.toggleExpand('a')
    })

    expect(expandState.current.isExpanded('a')).toBe(true)
  })
})

describe('useExpandedIds', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('with defaultExpanded true, starts with everything expanded and toggling collapses', () => {
    const { result } = renderHook(() => useExpandedIds(true))

    expect(result.current.isExpanded('a')).toBe(true)

    act(() => {
      result.current.toggleExpand('a')
    })
    expect(result.current.isExpanded('a')).toBe(false)

    act(() => {
      result.current.toggleExpand('a')
    })
    expect(result.current.isExpanded('a')).toBe(true)
  })

  it('with defaultExpanded false, starts with everything collapsed and toggling expands', () => {
    const { result } = renderHook(() => useExpandedIds(false))

    expect(result.current.isExpanded('a')).toBe(false)

    act(() => {
      result.current.toggleExpand('a')
    })
    expect(result.current.isExpanded('a')).toBe(true)

    act(() => {
      result.current.toggleExpand('a')
    })
    expect(result.current.isExpanded('a')).toBe(false)
  })

  it('without a storageKey, does not persist toggled ids across mounts', () => {
    const { result, unmount } = renderHook(() => useExpandedIds(false))
    act(() => {
      result.current.toggleExpand('a')
    })
    unmount()

    const { result: remounted } = renderHook(() => useExpandedIds(false))
    expect(remounted.current.isExpanded('a')).toBe(false)
  })

  it('with a storageKey, persists a toggled-on id across a remount', () => {
    const { result, unmount } = renderHook(() =>
      useExpandedIds(false, 'test:expanded-ids'),
    )
    act(() => {
      result.current.toggleExpand('a')
    })
    unmount()

    const { result: remounted } = renderHook(() =>
      useExpandedIds(false, 'test:expanded-ids'),
    )
    expect(remounted.current.isExpanded('a')).toBe(true)
  })

  it('with a storageKey, persists a toggled-off id across a remount', () => {
    localStorage.setItem('test:expanded-ids', JSON.stringify(['a']))
    const { result, unmount } = renderHook(() =>
      useExpandedIds(false, 'test:expanded-ids'),
    )
    act(() => {
      result.current.toggleExpand('a')
    })
    unmount()

    const { result: remounted } = renderHook(() =>
      useExpandedIds(false, 'test:expanded-ids'),
    )
    expect(remounted.current.isExpanded('a')).toBe(false)
  })

  it('ignores a malformed stored value and falls back to the default state', () => {
    localStorage.setItem('test:expanded-ids', 'not-json')
    const { result } = renderHook(() =>
      useExpandedIds(false, 'test:expanded-ids'),
    )
    expect(result.current.isExpanded('a')).toBe(false)
  })

  it('ignores a stored value that is not a string array and falls back to the default state', () => {
    localStorage.setItem('test:expanded-ids', JSON.stringify({ a: true }))
    const { result } = renderHook(() =>
      useExpandedIds(false, 'test:expanded-ids'),
    )
    expect(result.current.isExpanded('a')).toBe(false)
  })
})
