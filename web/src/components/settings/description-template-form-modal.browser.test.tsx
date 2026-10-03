import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps, ReactNode } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { DescriptionTemplateFormModal } from '#components/settings/description-template-form-modal'
import { makeDescriptionTemplate } from '#components/settings/description-template-test-fixtures'
import {
  useCreateDescriptionTemplate,
  useUpdateDescriptionTemplate,
} from '#hooks/use-description-templates'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-description-templates', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-description-templates')>()
  return {
    ...original,
    useCreateDescriptionTemplate: vi.fn(),
    useUpdateDescriptionTemplate: vi.fn(),
  }
})

const mockUseCreateDescriptionTemplate = vi.mocked(useCreateDescriptionTemplate)
const mockUseUpdateDescriptionTemplate = vi.mocked(useUpdateDescriptionTemplate)

beforeAll(async () => {
  await import('#components/ui/markdown-editor-crepe')
}, 20_000)

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function setupMutations() {
  const createMutate =
    vi.fn<ReturnType<typeof useCreateDescriptionTemplate>['mutate']>()
  const updateMutate =
    vi.fn<ReturnType<typeof useUpdateDescriptionTemplate>['mutate']>()

  mockUseCreateDescriptionTemplate.mockReturnValue(
    partialMutation<ReturnType<typeof useCreateDescriptionTemplate>>({
      mutate: createMutate,
      isPending: false,
      isError: false,
    }),
  )
  mockUseUpdateDescriptionTemplate.mockReturnValue(
    partialMutation<ReturnType<typeof useUpdateDescriptionTemplate>>({
      mutate: updateMutate,
      isPending: false,
      isError: false,
    }),
  )

  return { createMutate, updateMutate }
}

function renderForm(
  props: ComponentProps<typeof DescriptionTemplateFormModal>,
) {
  return render(
    <Providers>
      <DescriptionTemplateFormModal {...props} />
    </Providers>,
  )
}

async function enterMarkdown(
  user: ReturnType<typeof userEvent.setup>,
  editorIndex: number,
  text: string,
) {
  const editors = await waitFor(() => {
    const found = Array.from(
      document.body.querySelectorAll<HTMLElement>('.milkdown .ProseMirror'),
    )
    if (found.length !== 2) throw new Error('Both Markdown editors must mount')
    return found
  })
  const editor = editors[editorIndex]
  if (editor == null) {
    throw new Error(`Markdown editor ${String(editorIndex)} is missing`)
  }

  await user.click(editor)
  await user.click(editor)
  await waitFor(() => {
    expect(editor.isContentEditable).toBe(true)
  })
  await user.keyboard(text)
  await waitFor(() => {
    expect(editor.textContent).toBe(text)
  })
  await new Promise((resolve) => setTimeout(resolve, 300))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DescriptionTemplateFormModal', () => {
  it('creates a template with the entered fields and default setting', async () => {
    const { createMutate } = setupMutations()
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderForm({ open: true, onOpenChange })

    await user.type(screen.getByLabelText('名前'), 'Sample template')
    await user.type(
      screen.getByLabelText('使う場面'),
      'Use this for a sample task.',
    )
    await enterMarkdown(user, 0, 'Describe the goal.')
    await enterMarkdown(user, 1, 'Explain each section.')

    await user.click(
      screen.getByRole('checkbox', { name: '新規作成時の既定にする' }),
    )
    await user.click(screen.getByRole('button', { name: '作成' }))
    const createSuccess = createMutate.mock.calls[0]?.[1]?.onSuccess
    if (createSuccess == null)
      throw new Error('Create success callback is missing')
    Reflect.apply(createSuccess, undefined, [])
    const submission = () => ({
      calls: createMutate.mock.calls.map(([input, options]) => ({
        input,
        hasOnSuccess: typeof options?.onSuccess === 'function',
      })),
      openChanges: onOpenChange.mock.calls,
    })

    await waitFor(() => {
      expect(submission()).toEqual({
        calls: [
          {
            input: {
              name: 'Sample template',
              whenToUse: 'Use this for a sample task.',
              body: 'Describe the goal.\n',
              guide: 'Explain each section.\n',
              isDefault: true,
            },
            hasOnSuccess: true,
          },
        ],
        openChanges: [[false]],
      })
    })
  })

  it('updates the original template with edited fields', async () => {
    const { updateMutate } = setupMutations()
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const template = makeDescriptionTemplate({
      id: 'template-id-1',
      name: 'Original template',
      whenToUse: 'Use for an original task.',
      body: '## Goal',
      guide: 'Describe the goal.',
      isDefault: true,
    })
    renderForm({ open: true, onOpenChange, template })

    await user.clear(screen.getByLabelText('名前'))
    await user.type(screen.getByLabelText('名前'), 'Updated template')
    await user.clear(screen.getByLabelText('使う場面'))
    await user.type(
      screen.getByLabelText('使う場面'),
      'Use for an updated task.',
    )
    await user.click(
      screen.getByRole('checkbox', { name: '新規作成時の既定にする' }),
    )
    await user.click(screen.getByRole('button', { name: '保存' }))
    const updateSuccess = updateMutate.mock.calls[0]?.[1]?.onSuccess
    if (updateSuccess == null)
      throw new Error('Update success callback is missing')
    Reflect.apply(updateSuccess, undefined, [])
    const submission = () => ({
      calls: updateMutate.mock.calls.map(([input, options]) => ({
        input,
        hasOnSuccess: typeof options?.onSuccess === 'function',
      })),
      openChanges: onOpenChange.mock.calls,
    })

    await waitFor(() => {
      expect(submission()).toEqual({
        calls: [
          {
            input: {
              name: 'Original template',
              input: {
                name: 'Updated template',
                whenToUse: 'Use for an updated task.',
                body: '## Goal',
                guide: 'Describe the goal.',
                isDefault: false,
              },
            },
            hasOnSuccess: true,
          },
        ],
        openChanges: [[false]],
      })
    })
  })

  it('shows a save error and stays open when creation fails', async () => {
    const createMutate =
      vi.fn<ReturnType<typeof useCreateDescriptionTemplate>['mutate']>()
    const updateMutate =
      vi.fn<ReturnType<typeof useUpdateDescriptionTemplate>['mutate']>()
    mockUseCreateDescriptionTemplate.mockReturnValue(
      partialMutation<ReturnType<typeof useCreateDescriptionTemplate>>({
        mutate: createMutate,
        isPending: false,
        isError: false,
      }),
    )
    mockUseUpdateDescriptionTemplate.mockReturnValue(
      partialMutation<ReturnType<typeof useUpdateDescriptionTemplate>>({
        mutate: updateMutate,
        isPending: false,
        isError: false,
      }),
    )

    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const props = { open: true, onOpenChange }
    const rendered = renderForm(props)

    await user.type(screen.getByLabelText('名前'), 'Failed template')
    await user.click(screen.getByRole('button', { name: '作成' }))

    mockUseCreateDescriptionTemplate.mockReturnValue(
      partialMutation<ReturnType<typeof useCreateDescriptionTemplate>>({
        mutate: createMutate,
        isPending: false,
        isError: true,
      }),
    )
    rendered.rerender(
      <Providers>
        <DescriptionTemplateFormModal {...props} />
      </Providers>,
    )
    const failure = () => ({
      calls: createMutate.mock.calls.map(([input]) => input),
      alert: screen.getByRole('alert').textContent,
      openChanges: onOpenChange.mock.calls,
    })

    expect(failure()).toEqual({
      calls: [
        {
          name: 'Failed template',
          whenToUse: '',
          body: '',
          guide: '',
          isDefault: false,
        },
      ],
      alert: 'テンプレートの保存に失敗しました',
      openChanges: [],
    })
  })
})
