import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

    await user.click(
      screen.getByRole('checkbox', { name: '新規作成時の既定にする' }),
    )
    await user.click(screen.getByRole('button', { name: '作成' }))

    await waitFor(() => {
      expect(createMutate.mock.calls.map(([input]) => input)).toEqual([
        {
          name: 'Sample template',
          whenToUse: 'Use this for a sample task.',
          body: '',
          guide: '',
          isDefault: true,
        },
      ])
    })
  })

  it('updates the original template with edited fields', async () => {
    const { updateMutate } = setupMutations()
    const user = userEvent.setup()
    const template = makeDescriptionTemplate({
      id: 'template-id-1',
      name: 'Original template',
      whenToUse: 'Use for an original task.',
      body: '## Goal',
      guide: 'Describe the goal.',
      isDefault: true,
    })
    renderForm({ open: true, onOpenChange: vi.fn(), template })

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

    await waitFor(() => {
      expect(updateMutate.mock.calls.map(([input]) => input)).toEqual([
        {
          name: 'Original template',
          input: {
            name: 'Updated template',
            whenToUse: 'Use for an updated task.',
            body: '## Goal',
            guide: 'Describe the goal.',
            isDefault: false,
          },
        },
      ])
    })
  })
})
