/**
 * Публичные адреса, с которых разрешены server actions (вход, загрузка файлов).
 * За туннелем Origin приходит вида https://xxx.ngrok-free.app, и без этого списка
 * Next отклоняет действия как межсайтовые. Список задаётся в BESTECH_PUBLIC_HOST
 * через запятую, только хост, без схемы: скрипт scripts/demo-ngrok.ps1 ставит его сам.
 */
const publicHosts = (process.env.BESTECH_PUBLIC_HOST ?? '')
  .split(',')
  .map((host) => host.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Воркспейс-пакеты отдаются исходниками на TS — Next их транспилирует сам.
  transpilePackages: ['@bestech/ui-kit', '@bestech/tokens'],
  ...(publicHosts.length ? { experimental: { serverActions: { allowedOrigins: publicHosts } } } : {}),
};

export default nextConfig;
