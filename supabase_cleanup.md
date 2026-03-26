# Supabase Cleanup Guide

After removing the attachment and reply features from the code, you should perform the following cleanup in your Supabase project to keep it lean and efficient.

## 1. Delete Storage Bucket

Since the attachment feature is removed, you no longer need the `attachments` storage bucket.

1.  Go to the **Storage** section in your Supabase Dashboard.
2.  Find the `attachments` bucket.
3.  Click the ellipsis (three dots) and select **Delete bucket**.

## 2. Remove Unused Columns in `messages` Table

The `messages` table contains several columns that are no longer being used by the application. Removing them will simplify your database schema.

1.  Go to the **SQL Editor** in your Supabase Dashboard.
2.  Run the following SQL command to drop the unused columns:

```sql
ALTER TABLE messages
DROP COLUMN IF EXISTS file_url,
DROP COLUMN IF EXISTS file_type,
DROP COLUMN IF EXISTS reply_to_id,
DROP COLUMN IF EXISTS reply_to_text;
```

## 3. Verify RLS Policies (Optional)

If you had specific Row Level Security (RLS) policies for the `attachments` bucket or the removed columns, they will be automatically cleaned up when the bucket or columns are deleted. However, it's good practice to double-check your **Authentication > Policies** section to ensure no stale policies remain.

---
*Note: These changes are permanent and will delete any existing attachments and reply associations.*
