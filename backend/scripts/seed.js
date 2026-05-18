require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const User = require('../src/models/User');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('[seed] MONGO_URI is not set. Aborting.');
  process.exit(1);
}

const SEED_USERS = [
  { name: 'Neeraj', email: 'neeraj@athivatech.com', role: 'admin', is_root: true },
];

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[seed] Connected to MongoDB');

    for (const userData of SEED_USERS) {
      const result = await User.findOneAndUpdate(
        { email: userData.email },
        {
          $set: {
            name: userData.name,
            email: userData.email,
            role: userData.role,
            is_active: true,
            is_root: userData.is_root ?? false,
          },
          $setOnInsert: {
            created_at: new Date(),
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
      console.log(`[seed] OK — ${result.email} (${result.role})`);
    }

    console.log('[seed] Seeding complete.');
  } catch (err) {
    console.error('[seed] Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[seed] Disconnected from MongoDB');
  }
};

seed();
