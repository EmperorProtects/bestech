'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { one, run } from '@/db/client';
import { verifyPassword } from '@/lib/password';
import { SESSION_COOKIE, createSession, destroySession } from '@/lib/session';
import { randomUUID } from 'node:crypto';

export interface LoginState {
  error?: string;
}

/** Куда уводить после входа. Только внутренние пути — чтобы форма не стала open redirect. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/cabinet/assets';
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));

  if (!email || !password) {
    return { error: 'Заполните почту и пароль.' };
  }

  const user = one<{ id: string; password_hash: string; org_id: string }>(
    'SELECT id, password_hash, org_id FROM users WHERE email = ?',
    email,
  );

  // Одинаковый текст для неверной почты и неверного пароля — не подсказываем,
  // какая из учётных записей существует.
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: 'Неверная почта или пароль.' };
  }

  const userAgent = headers().get('user-agent') ?? '';
  const { token, expiresAt } = createSession(user.id, userAgent);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  run('INSERT INTO activity (id, org_id, user_id, asset_code, action, detail, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?)',
    randomUUID(), user.org_id, user.id, 'signin', email, new Date().toISOString());

  redirect(next);
}

export async function signOut(): Promise<void> {
  const jar = cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  jar.delete(SESSION_COOKIE);
  redirect('/login');
}
