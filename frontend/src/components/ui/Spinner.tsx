export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'sm' ? 24 : size === 'lg' ? 56 : 36;
  return (
    <div className="spinner" style={{ width: px, height: px }}>
      <div className="spinner-circle" />
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="page-loader">
      <Spinner size="lg" />
    </div>
  );
}
