// Inline SVG balance scale for the soft tie-breaker markers. The ⚖️ emoji
// (U+2696) is not safe for this: some devices' font chains have no glyph for it
// and render a bare "?" — even with an explicit color-emoji font-family. A
// vector icon can't fail that way. Draws in currentColor so it themes.
export default function ScalesIcon() {
  return (
    <svg className="scales-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M12 4.5v14.5" />
        <path d="M8.5 20h7" />
        <path d="M4.5 7.5h15" />
        <path d="M4.5 7.5 1.9 12.9M4.5 7.5l2.6 5.4" />
        <path d="M19.5 7.5 16.9 12.9M19.5 7.5l2.6 5.4" />
      </g>
      <path d="M1.6 13.2h5.8a2.9 2.9 0 0 1-5.8 0Z" fill="currentColor" />
      <path d="M16.6 13.2h5.8a2.9 2.9 0 0 1-5.8 0Z" fill="currentColor" />
      <circle cx="12" cy="4" r="1.4" fill="currentColor" />
    </svg>
  )
}
