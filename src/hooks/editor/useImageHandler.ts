import { useRef, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { db } from '../../services/db'
import { calculateBlobHash } from '../../utils/hashCalculator'
import { WorkspaceId } from '../../types/workspace'

export const useImageHandler = (
  editor: Editor | null,
  workspaceId: WorkspaceId = 'local'
) => {
  const imageBlobUrlMap = useRef<Map<string, string>>(new Map())

  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img')
      const reader = new FileReader()

      reader.onload = (e) => {
        img.src = e.target?.result as string
      }

      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Unable to create Canvas'))
          return
        }

        let width = img.width
        let height = img.height
        const maxSize = 640

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height * maxSize) / width
            width = maxSize
          } else {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const quality = mimeType === 'image/jpeg' ? 0.75 : undefined

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Image compression failed'))
          },
          mimeType,
          quality
        )
      }

      img.onerror = () => reject(new Error('Image loading failed'))
      reader.onerror = () => reject(new Error('File reading failed'))
      reader.readAsDataURL(file)
    })
  }

  const handleImageUpload = async (file: File) => {
    try {
      if (!editor) {
        alert('Editor is not ready')
        return
      }

      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }

      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        alert('Image size cannot exceed 10MB')
        return
      }

      const compressedBlob = await compressImage(file)

      // 計算圖片內容 hash（用於去重）
      const contentHash = await calculateBlobHash(compressedBlob)

      // 檢查是否已有相同內容的圖片（同 workspace 內去重）
      const existingImage = await db(workspaceId).findImageByContentHash(contentHash)

      let imageId: string
      let blobUrl: string

      if (existingImage) {
        // 已有相同圖片，直接使用
        imageId = existingImage.id
        blobUrl = imageBlobUrlMap.current.get(imageId) || URL.createObjectURL(existingImage.blob)
      } else {
        // 新圖片，儲存到 DB
        imageId = `img-${Date.now()}`
        await db(workspaceId).saveImage({
          id: imageId,
          blob: compressedBlob,
          filename: file.name,
          mimeType: file.type,
          size: compressedBlob.size,
          createdAt: Date.now(),
          contentHash,
        })
        blobUrl = URL.createObjectURL(compressedBlob)
      }

      imageBlobUrlMap.current.set(imageId, blobUrl)

      editor.chain().focus().setImage({
        src: `image://${imageId}`,
        alt: file.name,
      }).run()

    } catch (error) {
      console.error('Image upload failed:', error)
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const convertImageUrls = async () => {
    const images = document.querySelectorAll('img[data-src^="image://"]')

    for (const imgElement of images) {
      const img = imgElement as HTMLImageElement
      const dataSrc = img.getAttribute('data-src')
      if (!dataSrc) continue

      const imageId = dataSrc.replace('image://', '')
      let blobUrl = imageBlobUrlMap.current.get(imageId)

      if (!blobUrl) {
        try {
          const imageData = await db(workspaceId).getImage(imageId)
          if (imageData) {
            blobUrl = URL.createObjectURL(imageData.blob)
            imageBlobUrlMap.current.set(imageId, blobUrl)
          }
        } catch (error) {
          console.error(`Failed to load image ${imageId}:`, error)
          continue
        }
      }

      if (blobUrl) {
        img.src = blobUrl
      }
    }
  }

  // Automatically run conversion on update
  useEffect(() => {
    if (!editor) return
    
    // Initial conversion
    setTimeout(convertImageUrls, 100)

    const handleUpdate = () => {
      setTimeout(convertImageUrls, 50)
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor])

  return {
    handleImageUpload,
    convertImageUrls,
    imageBlobUrlMap
  }
}
