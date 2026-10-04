import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { DescriptionTemplateList } from '#components/settings/description-template-list'
import { makeDescriptionTemplate } from '#components/settings/description-template-test-fixtures'
import {
  useCreateDescriptionTemplate,
  useDeleteDescriptionTemplate,
  useDescriptionTemplates,
  useUpdateDescriptionTemplate,
} from '#hooks/use-description-templates'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-description-templates', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-description-templates')>()
  return {
    ...original,
    useCreateDescriptionTemplate: vi.fn(),
    useDeleteDescriptionTemplate: vi.fn(),
    useDescriptionTemplates: vi.fn(),
    useUpdateDescriptionTemplate: vi.fn(),
  }
})

const mockUseCreateDescriptionTemplate = vi.mocked(useCreateDescriptionTemplate)
const mockUseDeleteDescriptionTemplate = vi.mocked(useDeleteDescriptionTemplate)
const mockUseDescriptionTemplates = vi.mocked(useDescriptionTemplates)
const mockUseUpdateDescriptionTemplate = vi.mocked(useUpdateDescriptionTemplate)

beforeAll(async () => {
  await import('#components/ui/markdown-editor-crepe')
}, 20_000)

function inputValue(label: string) {
  const input = screen.getByLabelText(label)
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`The ${label} field must be an input`)
  }
  return input.value
}

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseDescriptionTemplates.mockReturnValue(
    partialMutation<ReturnType<typeof useDescriptionTemplates>>({
      isLoading: false,
      isSuccess: true,
      data: [
        makeDescriptionTemplate({
          id: 'template-id-1',
          name: 'Review template',
          whenToUse: 'Use for reviewing work.',
          body: '## Scope\n\n## Findings',
          guide: 'Describe the scope and findings.',
          isDefault: true,
        }),
      ],
    }),
  )
  mockUseCreateDescriptionTemplate.mockReturnValue(
    partialMutation<ReturnType<typeof useCreateDescriptionTemplate>>({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    }),
  )
  mockUseDeleteDescriptionTemplate.mockReturnValue(
    partialMutation<ReturnType<typeof useDeleteDescriptionTemplate>>({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    }),
  )
  mockUseUpdateDescriptionTemplate.mockReturnValue(
    partialMutation<ReturnType<typeof useUpdateDescriptionTemplate>>({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    }),
  )
})

describe('DescriptionTemplateList', () => {
  it('opens a blank form for Add and the selected template for Edit', async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <DescriptionTemplateList />
      </Providers>,
    )

    await user.click(screen.getByRole('button', { name: '追加' }))
    await screen.findByRole('heading', { name: 'テンプレートを追加' })
    const createForm = {
      title: screen.getByRole('heading', { name: 'テンプレートを追加' })
        .textContent,
      name: inputValue('名前'),
      whenToUse: inputValue('使う場面'),
    }

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'テンプレートを追加' }),
      ).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '編集' }))
    await screen.findByRole('heading', { name: 'テンプレートを編集' })
    const scopeHeading = await screen.findByText('Scope')
    const findingsHeading = await screen.findByText('Findings')
    const editForm = {
      title: screen.getByRole('heading', { name: 'テンプレートを編集' })
        .textContent,
      name: inputValue('名前'),
      whenToUse: inputValue('使う場面'),
      scopeHeadingVisible: scopeHeading.checkVisibility(),
      findingsHeadingVisible: findingsHeading.checkVisibility(),
    }

    const result = () => ({ createForm, editForm })
    expect(result()).toEqual({
      createForm: {
        title: 'テンプレートを追加',
        name: '',
        whenToUse: '',
      },
      editForm: {
        title: 'テンプレートを編集',
        name: 'Review template',
        whenToUse: 'Use for reviewing work.',
        scopeHeadingVisible: true,
        findingsHeadingVisible: true,
      },
    })
  })
})
