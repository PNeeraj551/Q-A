/**
 * One-time migration: rename role 'participant' → 'user' and
 * rename QnaPost field 'allowed_participants' → 'allowed_users'.
 *
 * Usage: node migrate-participant-to-user.js
 */
require('dotenv').config()
const mongoose = require('mongoose')

async function run() {
  await mongoose.connect(process.env.MONGO_URI)
  const db = mongoose.connection.db

  const usersResult = await db.collection('users').updateMany(
    { role: 'participant' },
    { $set: { role: 'user' } }
  )
  console.log(`Users updated: ${usersResult.modifiedCount}`)

  const postsResult = await db.collection('qnaposts').updateMany(
    { allowed_participants: { $exists: true } },
    { $rename: { allowed_participants: 'allowed_users' } }
  )
  console.log(`QnaPosts updated: ${postsResult.modifiedCount}`)

  await mongoose.disconnect()
  console.log('Migration complete.')
}

run().catch((err) => { console.error(err); process.exit(1) })
