// One-shot script: delete ALL non-admin users, their interviews, and ALL access requests
// Run in Render Shell: node reset-users.js

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGO_URI not set'); process.exit(1); }

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const db = mongoose.connection.db;

  // 1. Non-admin users
  const nonAdminUsers = await db.collection('users').find({ role: { $ne: 'admin' } }, { projection: { _id: 1 } }).toArray();
  const ids = nonAdminUsers.map(u => u._id);
  console.log(`Non-admin users found: ${nonAdminUsers.length}`);

  // 2. Delete their interviews
  const intResult = await db.collection('interviews').deleteMany({ user: { $in: ids } });
  console.log(`Interviews deleted: ${intResult.deletedCount}`);

  // 3. Delete non-admin users
  const userResult = await db.collection('users').deleteMany({ role: { $ne: 'admin' } });
  console.log(`Users deleted: ${userResult.deletedCount}`);

  // 4. Delete ALL access requests
  const arResult = await db.collection('accessrequests').deleteMany({});
  console.log(`Access requests deleted: ${arResult.deletedCount}`);

  // 5. Show what remains
  const admins = await db.collection('users').find({ role: 'admin' }).toArray();
  console.log(`\nAdmin accounts kept (${admins.length}):`);
  admins.forEach(a => console.log(`  passcode: ${a.passcode}  label: ${a.label || a.email || '-'}`));

  await mongoose.disconnect();
  console.log('\nDone. Database is clean.');
}

run().catch(err => { console.error(err); process.exit(1); });
