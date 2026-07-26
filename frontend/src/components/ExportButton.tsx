import { exportSession } from '../api/client'
import './ExportButton.css'

interface ExportButtonProps {
  taskId: string
}

export default function ExportButton({ taskId }: ExportButtonProps) {
  return (
    <button className="export-button" onClick={() => exportSession(taskId)} title="Export graph as JSON">
      <span className="export-icon">↓</span>
      Export JSON
    </button>
  )
}
