'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Upload, X, FileJson, CheckCircle, AlertCircle } from 'lucide-react'

interface ImportResult {
  success: boolean
  message?: string
  error?: string
  stats?: {
    received: number
    imported: number
    errors: number
    metricsCalculated: number
    durationMs: number
  }
}

interface DataImportProps {
  syncStatus?: {
    status: string | null
    lastSync: string | null
  }
  onImportComplete?: () => void
}

export function DataImport({ onImportComplete }: DataImportProps) {
  const [syncing, setSyncing] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync', { method: 'POST' })
      const data = await response.json()
      if (data.error) {
        console.error('Sync error:', data.error)
      } else {
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      if (files[0].name.endsWith('.json')) {
        setSelectedFile(files[0])
        setResult(null)
      } else {
        setResult({ success: false, error: 'Please select a JSON file' })
      }
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      if (files[0].name.endsWith('.json')) {
        setSelectedFile(files[0])
        setResult(null)
      } else {
        setResult({ success: false, error: 'Please select a JSON file' })
      }
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setResult(null)

    try {
      // Read file content as text
      const fileContent = await selectedFile.text()

      // Parse JSON to validate it
      try {
        JSON.parse(fileContent)
      } catch {
        setResult({ success: false, error: 'Invalid JSON file format' })
        setUploading(false)
        return
      }

      // Send as JSON body to avoid FormData size limitations
      const response = await fetch('/api/upload/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: fileContent, // Send raw JSON string
      })

      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = { error: text || 'Unknown error' }
      }

      if (response.ok && data.success) {
        setResult({
          success: true,
          message: data.message,
          stats: data.stats,
        })
        onImportComplete?.()
      } else {
        setResult({
          success: false,
          error: data.error || data.details || `Upload failed (${response.status})`,
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      setResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setUploading(false)
    }
  }

  const resetModal = () => {
    setSelectedFile(null)
    setResult(null)
    setShowUploadModal(false)
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  // Render modal directly instead of using portal for Safari compatibility
  const modal = showUploadModal ? (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={resetModal}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Import Variant Data</h2>
            <button
              onClick={resetModal}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Drag & Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <FileJson className="mx-auto h-12 w-12 text-blue-500" />
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="text-gray-600">
                    Drag and drop your JSON file here, or{' '}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports Inventory Planner export format
                  </p>
                </div>
              )}
            </div>

            {/* Result Display */}
            {result && (
              <div
                className={`rounded-lg p-4 ${
                  result.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                      {result.success ? result.message : result.error}
                    </p>
                    {result.stats && (
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-green-700">
                        <div>Received: {result.stats.received.toLocaleString()}</div>
                        <div>Imported: {result.stats.imported.toLocaleString()}</div>
                        <div>Errors: {result.stats.errors}</div>
                        <div>Metrics: {result.stats.metricsCalculated}</div>
                        <div className="col-span-2">
                          Duration: {formatDuration(result.stats.durationMs)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-lg">
            <Button variant="outline" onClick={resetModal}>
              {result?.success ? 'Close' : 'Cancel'}
            </Button>
            {!result?.success && (
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
              >
                {uploading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Import
                  </>
                )}
              </Button>
            )}
            {result?.success && (
              <Button onClick={() => window.location.reload()}>
                Refresh Dashboard
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <div className="flex items-center gap-2 relative z-20">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => {
            console.log('Upload button clicked!', { showUploadModal })
            setShowUploadModal(true)
          }}
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
          />
          {syncing ? 'Syncing...' : 'Sync n8n'}
        </Button>
      </div>
      {modal}
    </>
  )
}
