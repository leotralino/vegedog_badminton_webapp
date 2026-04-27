'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'

interface Props {
  imageSrc: string
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = imageSrc
  })
  const SIZE = 400
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, SIZE, SIZE)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas empty')), 'image/jpeg', 0.88)
  )
}

export default function AvatarCropper({ imageSrc, onConfirm, onCancel }: Props) {
  const [crop,   setCrop]   = useState({ x: 0, y: 0 })
  const [zoom,   setZoom]   = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [processing, setProcessing]   = useState(false)

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels)
  }, [])

  async function confirm() {
    if (!croppedArea) return
    setProcessing(true)
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea)
      onConfirm(blob)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Cropper area */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* Controls */}
      <div className="bg-black px-6 py-4 space-y-3"
           style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-xs">缩小</span>
          <input
            type="range" min={1} max={3} step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="flex-1 accent-white"
          />
          <span className="text-white/50 text-xs">放大</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-white/10 text-white text-sm font-semibold active:opacity-70">
            取消
          </button>
          <button
            onClick={confirm}
            disabled={processing}
            className="flex-1 py-3 rounded-xl bg-white text-black text-sm font-semibold active:opacity-70 disabled:opacity-50">
            {processing ? '处理中…' : '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}
