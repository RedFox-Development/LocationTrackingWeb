/**
 * ThreeColumnGrid - Reusable 3-column grid component
 * Automatically handles layout and spacing for child components
 */
function ThreeColumnGrid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem 1.5rem', marginBottom: '1.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
      {children}
    </div>
  )
}

export default ThreeColumnGrid
