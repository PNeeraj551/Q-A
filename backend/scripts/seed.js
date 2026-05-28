require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })

if (process.env.NODE_ENV !== 'development') {
  console.error('ERROR: seed.js can only run in development. NODE_ENV =', process.env.NODE_ENV || '(not set)')
  process.exit(1)
}

const readline = require('readline')
const db = require('../src/config/supabase')

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()) })
  })
}

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

async function main() {
  const answer = await confirm(
    '\n⚠️  WARNING: This will DELETE ALL DATA in the database.\nType "yes" to continue: '
  )
  if (answer !== 'yes') {
    console.log('Aborted.')
    process.exit(0)
  }
  await seed()
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err.message); process.exit(1) })
