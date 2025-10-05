"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Upload, X, RotateCw, ZoomIn, ZoomOut, Move } from "lucide-react"

interface EmmaAreaImageUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload?: (file: File, positioning: ImagePositioning) => Promise<void>
  onCrop?: (areaId: string, positioning: ImagePositioning) => Promise<void>
  areaId?: string | null
  cropMode?: boolean
  existingImageUrl?: string | null
}

interface ImagePositioning {
  x: number // Now represents percentage (0-100)
  y: number // Now represents percentage (0-100)
  zoom: number // Now represents percentage (50-200)
}

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export function EmmaAreaImageUploadModal({
  isOpen,
  onClose,
  onUpload,
  onCrop,
  areaId,
  cropMode = false,
  existingImageUrl,
}: EmmaAreaImageUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 400, height: 300 })
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)

  const [positioning, setPositioning] = useState<ImagePositioning>({ x: 50, y: 50, zoom: 100 })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cropMode && existingImageUrl) {
      try {
        const url = new URL(existingImageUrl)
        const x = Number.parseFloat(url.searchParams.get("x") || "50")
        const y = Number.parseFloat(url.searchParams.get("y") || "50")
        const zoom = Number.parseFloat(url.searchParams.get("zoom") || "100")
        setPositioning({ x, y, zoom })

        // Remove positioning parameters to get clean image URL
        url.searchParams.delete("x")
        url.searchParams.delete("y")
        url.searchParams.delete("zoom")
        setImageUrl(url.toString())
      } catch {
        setImageUrl(existingImageUrl)
      }
    }
  }, [cropMode, existingImageUrl])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null)
      if (!cropMode) {
        setImageUrl(null)
        setPositioning({ x: 50, y: 50, zoom: 100 })
      }
      setCropArea({ x: 0, y: 0, width: 400, height: 300 })
      setScale(1)
      setRotation(0)
    }
  }, [isOpen, cropMode])

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB")
      return
    }

    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setImageUrl(url)

    // Reset crop area when new image is loaded
    setTimeout(() => {
      if (imageRef.current) {
        const img = imageRef.current
        const width = Math.min(img.naturalWidth, 400)
        const height = Math.min(img.naturalHeight, Math.round((width * 9) / 16))
        setCropArea({
          x: (img.naturalWidth - width) / 2,
          y: (img.naturalHeight - height) / 2,
          width,
          height,
        })
      }
    }, 100)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        handleFileSelect(files[0])
      }
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const getCroppedImage = useCallback((): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current
      const image = imageRef.current

      if (!canvas || !image || !selectedFile) {
        reject(new Error("Missing required elements"))
        return
      }

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Could not get canvas context"))
        return
      }

      const width = 800
      const height = 450
      canvas.width = width
      canvas.height = height

      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.rotate((rotation * Math.PI) / 180)

      const zoomScale = positioning.zoom / 100 // Convert percentage to decimal
      const xOffset = ((positioning.x - 50) / 50) * (width / 4) // Convert percentage to pixel offset
      const yOffset = ((positioning.y - 50) / 50) * (height / 4) // Convert percentage to pixel offset

      ctx.scale(scale * zoomScale, scale * zoomScale)
      ctx.translate(xOffset, yOffset)

      // Draw the image centered
      const drawWidth = image.naturalWidth
      const drawHeight = image.naturalHeight
      ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)

      ctx.restore()

      // Convert canvas to blob and then to file
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not create blob"))
            return
          }

          const file = new File([blob], selectedFile.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          })
          resolve(file)
        },
        "image/jpeg",
        0.9,
      )
    })
  }, [cropArea, scale, rotation, selectedFile, positioning])

  const handleSave = async () => {
    try {
      setIsLoading(true)

      if (cropMode && onCrop && areaId) {
        // Crop mode: update positioning only
        await onCrop(areaId, positioning)
      } else if (onUpload && selectedFile) {
        // Upload mode: upload new file with positioning
        await onUpload(selectedFile, positioning)
      }

      onClose()
    } catch (error) {
      console.error("[v0] Error saving area image:", error)
      alert("Failed to save area image. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 3))
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.5))
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360)

  const getTitle = () => {
    if (cropMode) return "Crop Area Image"
    return "Upload Area Image"
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!imageUrl && !cropMode ? (
            // Upload area
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">Drop your area image here, or click to browse</p>
              <p className="text-sm text-gray-500 mb-4">Supports JPG, PNG, GIF up to 10MB</p>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
              />
            </div>
          ) : imageUrl ? (
            // Crop area
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline" onClick={handleZoomOut} disabled={scale <= 0.5}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600">{Math.round(scale * 100)}%</span>
                  <Button size="sm" variant="outline" onClick={handleZoomIn} disabled={scale >= 3}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleRotate}>
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </div>
                {!cropMode && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setImageUrl(null)
                      setSelectedFile(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Move className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Position & Zoom</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Horizontal Position</label>
                    <Slider
                      value={[positioning.x]}
                      onValueChange={([value]) => setPositioning((prev) => ({ ...prev, x: value }))}
                      min={0}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-500">{positioning.x}%</span>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Vertical Position</label>
                    <Slider
                      value={[positioning.y]}
                      onValueChange={([value]) => setPositioning((prev) => ({ ...prev, y: value }))}
                      min={0}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-500">{positioning.y}%</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Zoom Level</label>
                  <Slider
                    value={[positioning.zoom]}
                    onValueChange={([value]) => setPositioning((prev) => ({ ...prev, zoom: value }))}
                    min={50}
                    max={200}
                    step={5}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">{positioning.zoom}%</span>
                </div>
              </div>

              <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                <img
                  ref={imageRef}
                  src={imageUrl || "/placeholder.svg"}
                  alt="Preview"
                  className="max-w-full max-h-96 mx-auto"
                  style={{
                    transform: `scale(${scale * (positioning.zoom / 100)}) rotate(${rotation}deg) translate(${((positioning.x - 50) / 50) * 50}px, ${((positioning.y - 50) / 50) * 50}px)`,
                  }}
                />

                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="border-2 border-white shadow-lg"
                    style={{
                      width: "320px",
                      height: "180px", // 16:9 aspect ratio
                      borderRadius: "8px",
                    }}
                  />
                </div>
              </div>

              <canvas ref={canvasRef} className="hidden" />
            </div>
          ) : null}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={(!selectedFile && !cropMode) || isLoading}>
            {isLoading ? "Saving..." : cropMode ? "Save Crop" : "Save Image"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
