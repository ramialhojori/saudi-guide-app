import * as ImagePicker from 'expo-image-picker';

/**
 * اختيار الصور من الكاميرا أو الاستديو بطريقة وحدة لكل الشاشات.
 * - الاستديو ما يحتاج إذن على الآيفون (منتقي آبل الجديد) فما نطلبه، عشان «الوصول المحدود» ما يمنع المستخدم
 * - صور HEIC تتحول لصيغة متوافقة، وصور iCloud تنزل من النت
 * - أي خطأ يرجع رسالة بدل ما يسكت الزر
 */
export async function pickPhotos(o: { camera: boolean; max?: number; edit?: boolean }): Promise<{ uris: string[]; error?: string }> {
  try {
    if (o.camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return { uris: [], error: 'نحتاج إذن الكاميرا من الإعدادات.' };
    }
    const multi = !o.camera && !o.edit && (o.max ?? 1) > 1;
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'], quality: 0.9,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      shouldDownloadFromNetwork: true,
      ...(o.edit ? { allowsEditing: true, aspect: [4, 3] as [number, number] } : {}),
      ...(multi ? { allowsMultipleSelection: true, selectionLimit: o.max } : {}),
    };
    const r = o.camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled) return { uris: [] };
    return { uris: r.assets.map((a) => a.uri).slice(0, o.max ?? 1) };
  } catch (e) {
    return { uris: [], error: `ما قدرنا نفتح الصورة. جرّب صورة ثانية (${String((e as Error)?.message || e).slice(0, 60)})` };
  }
}
