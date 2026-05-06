require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('[seed] MONGO_URI is not set. Aborting.');
  process.exit(1);
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'participant'], required: true },
    is_active: { type: Boolean, default: true },
    must_change_password: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

const SEED_USERS = [
  { name: 'Admin', email: 'admin@companyname.com', password: 'Admin@123', role: 'admin' },
  { name: 'Arun', email: 'arun@companyname.com', password: 'User@123', role: 'participant' },
  { name: 'Divya', email: 'divya@companyname.com', password: 'User@123', role: 'participant' },
  { name: 'Kiran', email: 'kiran@companyname.com', password: 'User@123', role: 'participant' },
];

const SALT_ROUNDS = 10;

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[seed] Connected to MongoDB');

    for (const userData of SEED_USERS) {
      const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);

      const result = await User.findOneAndUpdate(
        { email: userData.email },
        {
          $set: {
            name: userData.name,
            email: userData.email,
            password: hashedPassword,
            role: userData.role,
            is_active: true,
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
