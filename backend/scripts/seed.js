require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const db = require('../src/config/supabase')

const ALL_ROWS = { neq: ['id', '00000000-0000-0000-0000-000000000000'] }

async function clear(table) {
  const { error } = await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw new Error(`Clear ${table}: ${error.message}`)
  console.log(`  cleared ${table}`)
}

async function clearNoId(table, col) {
  const { error } = await db.from(table).delete().neq(col, '00000000-0000-0000-0000-000000000000')
  if (error) throw new Error(`Clear ${table}: ${error.message}`)
  console.log(`  cleared ${table}`)
}

async function seed() {
  console.log('Clearing all tables...')
  await clearNoId('reply_likes',    'reply_id')
  await clearNoId('question_likes', 'question_id')
  await clear('replies')
  await clear('questions')
  await clearNoId('user_sessions',     'qna_id')
  await clearNoId('qna_allowed_users', 'qna_id')
  await clear('qna_posts')
  await clear('otps')
  await clear('users')

  console.log('Seeding admin user...')
  const { error } = await db.from('users').insert({
    name: 'Neeraj',
    email: 'neeraj@athivatech.com',
    role: 'admin',
    is_root: true,
  })
  if (error) throw new Error(`Insert user: ${error.message}`)

  console.log('Done. Admin user neeraj@athivatech.com created.')
}

seed()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err.message); process.exit(1) })
