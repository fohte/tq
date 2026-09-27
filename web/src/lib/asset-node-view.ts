import {
  imageBlockSchema,
  imageBlockView,
} from '@milkdown/kit/component/image-block'
import { inlineImageView } from '@milkdown/kit/component/image-inline'
import { imageSchema } from '@milkdown/kit/preset/commonmark'
import type { NodeView, NodeViewConstructor } from '@milkdown/kit/prose/view'
import { $view } from '@milkdown/kit/utils'

import {
  ASSET_FILE_ACCEPT,
  handleAssetLoadError,
  resolveAssetDetails,
} from '#lib/asset-upload'

type AssetNodeViewMode = 'block' | 'inline'

function createAssetNodeView(
  originalNodeView: NodeViewConstructor,
  mode: AssetNodeViewMode,
): NodeViewConstructor {
  return (initialNode, view, getPos, decorations, innerDecorations) => {
    const dom = document.createElement(mode === 'block' ? 'figure' : 'span')
    dom.className = 'markdown-asset-node-view'
    if (mode === 'inline') dom.classList.add('markdown-asset-inline-node-view')

    let currentNode = initialNode
    let currentDecorations = decorations
    let currentInnerDecorations = innerDecorations
    let imageView: NodeView | null = originalNodeView(
      initialNode,
      view,
      getPos,
      decorations,
      innerDecorations,
    )
    let video: HTMLVideoElement | null = null
    let videoCaption: HTMLElement | null = null
    let selected = false
    let destroyed = false

    dom.append(imageView.dom)

    const getCaption = () =>
      String(currentNode.attrs[mode === 'block' ? 'caption' : 'alt'] ?? '')

    const handleVideoError = (event: Event) => {
      void handleAssetLoadError(event)
    }

    const allowVideoFileSelection = () => {
      dom
        .querySelectorAll<HTMLInputElement>('input[type="file"]')
        .forEach((input) => {
          input.accept = ASSET_FILE_ACCEPT
        })
    }

    dom.addEventListener('click', allowVideoFileSelection, true)
    allowVideoFileSelection()

    const syncVideo = (url: string) => {
      if (video == null) return

      if (video.src !== url) video.src = url
      const caption = getCaption()
      if (caption) video.setAttribute('aria-label', caption)
      else video.removeAttribute('aria-label')

      if (mode !== 'block') return

      if (caption) {
        if (videoCaption == null) {
          videoCaption = document.createElement('figcaption')
          dom.append(videoCaption)
        }
        videoCaption.textContent = caption
      } else {
        videoCaption?.remove()
        videoCaption = null
      }
    }

    const renderVideo = (url: string) => {
      imageView?.destroy?.()
      imageView = null
      video = document.createElement('video')
      video.className = 'markdown-asset-video-player'
      video.controls = true
      video.preload = 'metadata'
      video.playsInline = true
      video.addEventListener('error', handleVideoError)
      dom.replaceChildren(video)
      dom.classList.add('markdown-asset-video')
      if (selected) dom.classList.add('selected')
      syncVideo(url)
    }

    const renderImage = (node: typeof initialNode) => {
      video?.removeEventListener('error', handleVideoError)
      video = null
      videoCaption = null
      dom.classList.remove('markdown-asset-video')
      imageView = originalNodeView(
        node,
        view,
        getPos,
        currentDecorations,
        currentInnerDecorations,
      )
      dom.replaceChildren(imageView.dom)
      if (selected) imageView.selectNode?.()
      allowVideoFileSelection()
    }

    const updateAssetView = (src: string) => {
      void resolveAssetDetails(src).match(
        (asset) => {
          if (destroyed || currentNode.attrs['src'] !== src) return

          if (
            asset.contentType != null &&
            asset.contentType.startsWith('video/')
          ) {
            if (video == null) {
              renderVideo(asset.url)
            } else {
              syncVideo(asset.url)
            }
          } else if (video != null) {
            renderImage(currentNode)
          }
        },
        (error) => {
          console.error('Failed to resolve asset details', error)
        },
      )
    }

    updateAssetView(String(initialNode.attrs['src'] ?? ''))

    return {
      dom,
      update: (updatedNode, updatedDecorations, updatedInnerDecorations) => {
        if (updatedNode.type !== initialNode.type) return false

        if (
          video == null &&
          imageView?.update?.(
            updatedNode,
            updatedDecorations,
            updatedInnerDecorations,
          ) === false
        ) {
          return false
        }

        currentNode = updatedNode
        currentDecorations = updatedDecorations
        currentInnerDecorations = updatedInnerDecorations
        allowVideoFileSelection()
        updateAssetView(String(updatedNode.attrs['src'] ?? ''))
        return true
      },
      stopEvent: (event) => {
        if (
          video &&
          event.target instanceof Node &&
          video.contains(event.target)
        ) {
          return true
        }
        return imageView?.stopEvent?.(event) ?? false
      },
      selectNode: () => {
        selected = true
        dom.classList.add('selected')
        imageView?.selectNode?.()
      },
      deselectNode: () => {
        selected = false
        dom.classList.remove('selected')
        imageView?.deselectNode?.()
      },
      ignoreMutation: (mutation) =>
        video != null || (imageView?.ignoreMutation?.(mutation) ?? true),
      destroy: () => {
        destroyed = true
        dom.removeEventListener('click', allowVideoFileSelection, true)
        video?.removeEventListener('error', handleVideoError)
        imageView?.destroy?.()
      },
    }
  }
}

export const assetBlockNodeView = $view(imageBlockSchema.node, () =>
  createAssetNodeView(imageBlockView.view, 'block'),
)

export const assetInlineNodeView = $view(imageSchema.node, () =>
  createAssetNodeView(inlineImageView.view, 'inline'),
)
