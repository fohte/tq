import { Crepe } from '@milkdown/crepe'
import { editorViewCtx, schemaCtx } from '@milkdown/kit/core'
import { DecorationSet } from '@milkdown/kit/prose/view'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import videoFixtureAsset from '#components/ui/markdown-editor-video-fixture.webm?url'
import { assetBlockNodeView } from '#lib/asset-node-view'
import { assertDefined } from '#lib/test-utils'

vi.mock('#lib/api', () => {
  const mockGet = vi.fn()

  return {
    api: { api: { assets: { ':id': { $get: mockGet } } } },
    __mocks: { mockGet },
  }
})

async function getMocks() {
  const mod = await import('#lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing the test-only __mocks property injected by vi.mock
  const typed = mod as unknown as {
    __mocks: Record<string, ReturnType<typeof vi.fn>>
  }
  return typed.__mocks
}

beforeEach(async () => {
  const mocks = await getMocks()
  for (const mock of Object.values(mocks)) mock.mockReset()
})

function signedAssetResponse(url: string, contentType: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ url, contentType }),
  }
}

function videoFixtureUrl(version: string): string {
  return `${new URL(videoFixtureAsset, document.baseURI).href}#${version}`
}

async function createEditor() {
  const crepe = new Crepe({ root: document.createElement('div') })
  crepe.editor.use(assetBlockNodeView)
  const editor = await crepe.create()
  return { crepe, editor }
}

function createBlockNodeView(
  editor: Awaited<ReturnType<typeof createEditor>>['editor'],
  src: string,
  caption = 'Asset caption',
) {
  const nodeType = editor.ctx.get(schemaCtx).nodes['image-block']
  if (nodeType == null) throw new Error('Crepe image-block schema is missing')

  const node = nodeType.create({ src, caption, ratio: 1 })
  const nodeView = assetBlockNodeView.view(
    node,
    editor.ctx.get(editorViewCtx),
    () => 1,
    [],
    DecorationSet.empty,
  )

  return { node, nodeView }
}

async function waitForElement(root: ParentNode, selector: string) {
  await vi.waitFor(() => {
    if (root.querySelector(selector) == null) {
      throw new Error(`Expected ${selector} to be rendered`)
    }
  })
}

describe('asset block NodeView', () => {
  it('swaps an image node into a selected video node', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet']).mockResolvedValue(
      signedAssetResponse(videoFixtureUrl('node-video'), 'video/webm'),
    )
    const { crepe, editor } = await createEditor()

    try {
      const { nodeView } = createBlockNodeView(
        editor,
        '/api/assets/node-video-test',
      )
      try {
        nodeView.selectNode?.()
        await waitForElement(nodeView.dom, 'video')
        const video = nodeView.dom.querySelector('video')
        const selectedVideo = nodeView.dom.classList.contains('selected')
        nodeView.deselectNode?.()

        const actual = () => ({
          tagName: video?.tagName,
          src: video?.getAttribute('src'),
          ariaLabel: video?.getAttribute('aria-label'),
          selectedVideo,
          deselectedVideo: !nodeView.dom.classList.contains('selected'),
          imageViewCount: nodeView.dom.querySelectorAll('.milkdown-image-block')
            .length,
        })

        expect(actual()).toEqual({
          tagName: 'VIDEO',
          src: videoFixtureUrl('node-video'),
          ariaLabel: 'Asset caption',
          selectedVideo: true,
          deselectedVideo: true,
          imageViewCount: 0,
        })
      } finally {
        nodeView.destroy?.()
      }
    } finally {
      await crepe.destroy()
    }
  })

  it('swaps a video node back to a selected image node when its source changes', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet'])
      .mockResolvedValueOnce(
        signedAssetResponse(videoFixtureUrl('source-video'), 'video/webm'),
      )
      .mockResolvedValueOnce(
        signedAssetResponse(
          'https://signed.example.com/source-image',
          'image/png',
        ),
      )
    const { crepe, editor } = await createEditor()

    try {
      const { node, nodeView } = createBlockNodeView(
        editor,
        '/api/assets/source-video-test',
      )
      try {
        await waitForElement(nodeView.dom, 'video')
        nodeView.selectNode?.()

        const updatedNode = node.type.create({
          src: '/api/assets/source-image-test',
          caption: 'Updated caption',
          ratio: 1,
        })
        const updateResult =
          nodeView.update?.(updatedNode, [], DecorationSet.empty) ?? false
        await waitForElement(nodeView.dom, '.milkdown-image-block')
        await vi.waitFor(() => {
          const imageView = nodeView.dom.querySelector('.milkdown-image-block')
          if (imageView == null || !imageView.classList.contains('selected')) {
            throw new Error(
              'Expected the replacement image NodeView to be selected',
            )
          }
        })
        const selectedImage = {
          wrapper: nodeView.dom.classList.contains('selected'),
          imageView: nodeView.dom
            .querySelector('.milkdown-image-block')
            ?.classList.contains('selected'),
        }
        nodeView.deselectNode?.()
        await vi.waitFor(() => {
          const imageView = nodeView.dom.querySelector('.milkdown-image-block')
          if (
            nodeView.dom.classList.contains('selected') ||
            (imageView != null && imageView.classList.contains('selected'))
          ) {
            throw new Error(
              'Expected the replacement image NodeView to be deselected',
            )
          }
        })

        const actual = () => ({
          updateResult,
          hasVideo: nodeView.dom.querySelector('video') != null,
          hasImageView:
            nodeView.dom.querySelector('.milkdown-image-block') != null,
          selectedImage,
          deselectedImage: {
            wrapper: nodeView.dom.classList.contains('selected'),
            imageView: nodeView.dom
              .querySelector('.milkdown-image-block')
              ?.classList.contains('selected'),
          },
          videoClass: nodeView.dom.classList.contains('markdown-asset-video'),
        })

        expect(actual()).toEqual({
          updateResult: true,
          hasVideo: false,
          hasImageView: true,
          selectedImage: { wrapper: true, imageView: true },
          deselectedImage: { wrapper: false, imageView: false },
          videoClass: false,
        })
      } finally {
        nodeView.destroy?.()
      }
    } finally {
      await crepe.destroy()
    }
  })

  it('removes the video error handler when the NodeView is destroyed', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet']).mockResolvedValue(
      signedAssetResponse(videoFixtureUrl('destroy-video'), 'video/webm'),
    )
    const { crepe, editor } = await createEditor()

    try {
      const { nodeView } = createBlockNodeView(
        editor,
        '/api/assets/destroy-video-test',
      )
      let destroyed = false
      try {
        await waitForElement(nodeView.dom, 'video')
        const video = nodeView.dom.querySelector('video')
        nodeView.destroy?.()
        destroyed = true
        video?.dispatchEvent(new Event('error'))

        const actual = () => ({
          requestCount: mocks['mockGet']?.mock.calls.length,
          src: video?.getAttribute('src'),
        })

        expect(actual()).toEqual({
          requestCount: 1,
          src: videoFixtureUrl('destroy-video'),
        })
      } finally {
        if (!destroyed) nodeView.destroy?.()
      }
    } finally {
      await crepe.destroy()
    }
  })

  it('destroys the original image NodeView and removes its DOM', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet']).mockResolvedValue(
      signedAssetResponse(
        'https://signed.example.com/destroy-image',
        'image/png',
      ),
    )
    const { crepe, editor } = await createEditor()

    try {
      const { nodeView } = createBlockNodeView(
        editor,
        '/api/assets/destroy-image-test',
      )
      let destroyed = false
      try {
        await waitForElement(nodeView.dom, '.milkdown-image-block')
        const imageViewDom = nodeView.dom.querySelector('.milkdown-image-block')

        nodeView.destroy?.()
        destroyed = true

        const actual = () => ({
          wrapperChildren: nodeView.dom.childElementCount,
          originalViewDetached: imageViewDom?.parentElement == null,
        })

        expect(actual()).toEqual({
          wrapperChildren: 0,
          originalViewDetached: true,
        })
      } finally {
        if (!destroyed) nodeView.destroy?.()
      }
    } finally {
      await crepe.destroy()
    }
  })
})
