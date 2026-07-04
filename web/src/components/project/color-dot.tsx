export function ColorDot({
  color,
  size = 8,
}: {
  color: string | null
  size?: number
}) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: color ?? '#FF8400',
      }}
    />
  )
}
