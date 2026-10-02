/** Endpoints available to any signed-in user. */
import { HttpError, required, isEmail, nowIso } from './http.mjs';
import { db } from './store.mjs';
import { hashPassword, verifyPassword } from './auth.mjs';
import { publicUser, saveUser, getFileRecord } from './helpers.mjs';

export async function getMe({ user }) {
  return { user: publicUser(user) };
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function updateMe({ user, body }) {
  const updates = {};
  if (body.name !== undefined) {
    if (!String(body.name).trim()) throw new HttpError(400, 'Name cannot be empty.');
    updates.name = String(body.name).trim().slice(0, 120);
  }
  if (body.phone !== undefined) updates.phone = String(body.phone).trim().slice(0, 40);
  if (body.address !== undefined) updates.address = String(body.address).trim().slice(0, 300);
  if (user.role === 'student') {
    if (body.dob !== undefined) updates.dob = String(body.dob).slice(0, 12);
    if (body.gender !== undefined) updates.gender = String(body.gender).slice(0, 20);
    if (body.guardianName !== undefined) updates.guardianName = String(body.guardianName).trim().slice(0, 120);
    if (body.guardianPhone !== undefined) updates.guardianPhone = String(body.guardianPhone).trim().slice(0, 40);
  }
  if (user.role === 'facilitator') {
    if (body.expertise !== undefined) updates.expertise = String(body.expertise).trim().slice(0, 160);
    if (body.bio !== undefined) updates.bio = String(body.bio).trim().slice(0, 1000);
  }
  Object.assign(user, updates);
  await saveUser(user);
  return { user: publicUser(user) };
}

export async function changePassword({ user, body }) {
  required(body, 'currentPassword', 'newPassword');
  if (!verifyPassword(body.currentPassword, user.passwordHash)) {
    throw new HttpError(400, 'Your current password is incorrect.');
  }
  if (String(body.newPassword).length < 6) {
    throw new HttpError(400, 'New password must be at least 6 characters.');
  }
  user.passwordHash = hashPassword(body.newPassword);
  await saveUser(user);
  return { ok: true, message: 'Password updated successfully.' };
}

export async function uploadPhoto({ user, body }) {
  required(body, 'file');
  const { name, contentType, dataBase64 } = body.file || {};
  if (!dataBase64) throw new HttpError(400, 'No image data received.');
  if (contentType && !IMAGE_TYPES.includes(String(contentType))) {
    throw new HttpError(400, 'Profile picture must be a JPG, PNG, WEBP or GIF image.');
  }
  const { saveFile } = await import('./helpers.mjs');
  const rec = await saveFile({ name: name || 'passport.jpg', contentType, dataBase64 }, user.id);
  if (user.photoKey) {
    const { deleteFileByKey } = await import('./helpers.mjs');
    await deleteFileByKey(user.photoKey);
  }
  user.photoKey = rec.key;
  await saveUser(user);
  return { user: publicUser(user), photoKey: rec.key };
}

/** Serve a stored file (photos, materials, submissions). Requires sign-in. */
export async function getFile({ params }) {
  const rec = await getFileRecord(params.key);
  if (!rec) throw new HttpError(404, 'File not found.');
  const bytes = Buffer.from(rec.dataBase64, 'base64');
  const isImage = String(rec.contentType).startsWith('image/');
  const safeName = String(rec.name).replace(/["\\\r\n]/g, '_');
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': rec.contentType || 'application/octet-stream',
      'content-disposition': `${isImage ? 'inline' : 'attachment'}; filename="${safeName}"`,
      'cache-control': 'private, max-age=3600',
    },
  });
}
