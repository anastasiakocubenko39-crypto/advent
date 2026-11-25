// Налаштування Supabase. Тут ЛИШЕ публічні значення (Project URL і publishable/anon key).
// Supabase → Project Settings → API. Можна взяти ті самі, що в «QR-подарунку».
// НІКОЛИ не вставляйте сюди service_role key або паролі.
window.ADVENT_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_KEY: 'YOUR-PUBLISHABLE-OR-ANON-KEY',
  BUCKET: 'advent',
  LOGIN_DOMAIN: 'advent.local',      // логін «olena» → olena@advent.local
  MAX_FILE_MB: 50,                   // ліміт Supabase Free на файл
  PROJECT_QUOTA_MB: 1024,            // ліміт Supabase Free на всі файли
  MAX_VIDEO_MIN: 15,
  TIMEZONE: 'Europe/Kyiv',
};
