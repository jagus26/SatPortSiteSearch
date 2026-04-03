import './Toolbar.css'

interface ToolbarProps {
  onAddSite: () => void
}

export function Toolbar({ onAddSite }: ToolbarProps) {
  return (
    <div className="toolbar">
      <button className="toolbar-btn" onClick={onAddSite}>
        + Add Site
      </button>
    </div>
  )
}
