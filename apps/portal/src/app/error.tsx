'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { EmptyState } from '@bestech/ui-kit';

/** Экран ошибки: показываем цифровой код, по нему запись ищется в журнале сервера. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 40 }}>
      <div style={{ maxWidth: 620 }}>
        <EmptyState
          title="Не удалось показать раздел"
          note={`Запрос завершился ошибкой. ${error.digest ? `Код обращения: ${error.digest}.` : ''} Повторите попытку или вернитесь к списку объектов.`}
          action={
            <span style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="bst-btn bst-btn--primary" onClick={reset}>
                Повторить
              </button>
              <Link href="/cabinet/assets" className="bst-btn">
                К списку объектов
              </Link>
            </span>
          }
        />
      </div>
    </div>
  );
}
