'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Field, Input } from '@bestech/ui-kit';
import { signIn, type LoginState } from '@/app/login/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="bst-btn bst-btn--primary bst-btn--block" disabled={pending} style={{ position: 'relative' }}>
      <i className="bst-corner bst-corner--tl" aria-hidden="true" />
      <i className="bst-corner bst-corner--tr" aria-hidden="true" />
      <i className="bst-corner bst-corner--bl" aria-hidden="true" />
      <i className="bst-corner bst-corner--br" aria-hidden="true" />
      {pending ? 'Проверяем…' : 'Войти'}
    </button>
  );
}

export function LoginForm({ next, defaultEmail }: { next: string; defaultEmail: string }) {
  const [state, action] = useFormState<LoginState, FormData>(signIn, {});

  return (
    <form action={action} style={{ display: 'grid', gap: 14 }}>
      <input type="hidden" name="next" value={next} />

      <Field label="Почта" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={defaultEmail} placeholder="name@company.kz" />
      </Field>

      <Field label="Пароль" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>

      {state.error ? (
        <p role="alert" className="bst-mono" style={{ margin: 0, fontSize: 12, color: 'var(--bst-alarm)' }}>
          ▲ {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
