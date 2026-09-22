import Link from 'next/link';
import { EmptyState } from '@bestech/ui-kit';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 40 }}>
      <div style={{ maxWidth: 560 }}>
        <EmptyState
          title="Объект не найден"
          note="Шифр отсутствует в реестре организации. Проверьте адрес или вернитесь к списку объектов."
          action={
            <Link href="/cabinet/assets" className="bst-btn bst-btn--primary">
              К списку объектов
            </Link>
          }
        />
      </div>
    </div>
  );
}
