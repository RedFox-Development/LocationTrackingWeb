/**
 * ThreeColumnGrid - Reusable 3-column grid component
 * Automatically handles layout and spacing for child components
 */
export const ThreeColumnGrid = ({ children }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem 1.5rem', marginBottom: '1.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
      {children}
    </div>
  )
}

export const FourColumnGrid = ({ children }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.85rem 1.5rem', marginBottom: '1.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
      {children}
    </div>
  )
}