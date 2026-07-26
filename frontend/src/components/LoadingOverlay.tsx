import './LoadingOverlay.css'

interface LoadingOverlayProps {
  message: string
  isError?: boolean
  onRetry?: () => void
  onCancel?: () => void
}

export default function LoadingOverlay({ message, isError, onRetry, onCancel }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay">
      <div className="loading-card">
        {isError ? (
          <div className="loading-error-icon">!</div>
        ) : (
          <div className="loading-spinner" />
        )}
        <p className="loading-message">{message}</p>
        <div className="loading-actions">
          {isError && onRetry && (
            <button className="loading-btn loading-btn-primary" onClick={onRetry}>
              Retry
            </button>
          )}
          {onCancel && (
            <button className="loading-btn loading-btn-secondary" onClick={onCancel}>
              {isError ? 'Dismiss' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
