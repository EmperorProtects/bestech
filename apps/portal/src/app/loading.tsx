/** Скелетон на время загрузки серверного компонента: полоса штампа и поле листа. */
export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
        <span className="bst-mono" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--bst-text-mute)' }}>
          ЗАГРУЗКА ЛИСТА
        </span>
        <svg width="220" height="14" viewBox="0 0 220 14" aria-hidden="true">
          <path d="M2 7H218" stroke="var(--bst-line)" strokeWidth="1" />
          <path d="M2 0V14M218 0V14" stroke="var(--bst-line)" strokeWidth="0.9" />
          <rect x="2" y="5" width="60" height="4" fill="var(--bst-accent)">
            <animate attributeName="x" values="2;156;2" dur="1.4s" repeatCount="indefinite" />
          </rect>
        </svg>
      </div>
    </div>
  );
}
