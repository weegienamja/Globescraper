"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_GALLERY_IMAGES = 5;

type UploadResult = { url: string } | { error: string };
type ActionResult = { ok: true } | { error: string };

async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only JPEG, PNG, and WebP images are allowed.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Image must be under 2 MB.";
  }
  return null;
}

/** Upload or replace the user's profile avatar */
export async function uploadAvatar(formData: FormData): Promise<UploadResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };

  const err = validateFile(file);
  if (err) return { error: err };

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true, avatarUrl: true },
  });
  if (!profile) return { error: "Create a profile first." };

  // Delete old avatar if it exists
  if (profile.avatarUrl) {
    try {
      await del(profile.avatarUrl);
    } catch {
      /* old blob may already be gone */
    }
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const blob = await put(`avatars/${userId}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  await prisma.profile.update({
    where: { userId },
    data: { avatarUrl: blob.url },
  });

  return { url: blob.url };
}

/** Remove the user's avatar */
export async function removeAvatar(): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { avatarUrl: true },
  });

  if (profile?.avatarUrl) {
    try {
      await del(profile.avatarUrl);
    } catch {
      /* ok */
    }
    await prisma.profile.update({
      where: { userId },
      data: { avatarUrl: null },
    });
  }

  return { ok: true };
}

/** Upload a gallery image (max 5) */
export async function uploadGalleryImage(
  formData: FormData,
): Promise<UploadResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };

  const err = validateFile(file);
  if (err) return { error: err };

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return { error: "Create a profile first." };

  const count = await prisma.profileImage.count({
    where: { profileId: profile.id },
  });
  if (count >= MAX_GALLERY_IMAGES)
    return { error: `You can upload up to ${MAX_GALLERY_IMAGES} gallery images.` };

  const ext = file.name.split(".").pop() ?? "jpg";
  const blob = await put(`gallery/${userId}/${Date.now()}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  await prisma.profileImage.create({
    data: {
      profileId: profile.id,
      url: blob.url,
      sortOrder: count,
    },
  });

  return { url: blob.url };
}

/** Delete a gallery image by ID */
export async function deleteGalleryImage(imageId: string): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return { error: "Not found" };

  const image = await prisma.profileImage.findFirst({
    where: { id: imageId, profileId: profile.id },
  });
  if (!image) return { error: "Image not found." };

  try {
    await del(image.url);
  } catch {
    /* blob may already be gone */
  }

  await prisma.profileImage.delete({ where: { id: imageId } });

  return { ok: true };
}
