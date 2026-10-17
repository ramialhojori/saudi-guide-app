import UserNotifications

/// يضيف صورة للإشعار: السيرفر يرسل رابط الصورة (https) مع mutable-content.
/// نبحث عن الرابط في أماكن Expo المعروفة، ننزّله، ونرفقه. لو فشل أي شي يطلع الإشعار عادي بدون صورة.
class NotificationService: UNNotificationServiceExtension {
  var handler: ((UNNotificationContent) -> Void)?
  var best: UNMutableNotificationContent?

  override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
    handler = contentHandler
    best = request.content.mutableCopy() as? UNMutableNotificationContent
    guard let content = best, let url = imageURL(request.content.userInfo) else { contentHandler(request.content); return }
    URLSession.shared.downloadTask(with: url) { [weak self] tmp, resp, _ in
      defer { self?.finish() }
      guard let tmp = tmp, let mime = (resp as? HTTPURLResponse)?.mimeType, mime.hasPrefix("image/") else { return }
      let ext = mime.contains("png") ? "png" : (mime.contains("webp") ? "webp" : "jpg")
      let dest = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(UUID().uuidString + "." + ext)
      do {
        try FileManager.default.moveItem(at: tmp, to: dest)
        let att = try UNNotificationAttachment(identifier: "image", url: dest, options: nil)
        content.attachments = [att]
      } catch {}
    }.resume()
  }

  override func serviceExtensionTimeWillExpire() { finish() }

  private func finish() {
    guard let h = handler, let c = best else { return }
    handler = nil
    h(c)
  }

  private func imageURL(_ info: [AnyHashable: Any]) -> URL? {
    var candidates: [Any?] = [info["image"]]
    if let body = info["body"] as? [String: Any] { candidates.append(body["image"]) }
    if let body = info["body"] as? String, let d = body.data(using: .utf8), let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any] { candidates.append(j["image"]) }
    if let rich = info["richContent"] as? [String: Any] { candidates.append(rich["image"]) }
    if let data = info["data"] as? [String: Any] { candidates.append(data["image"]) }
    for c in candidates {
      if let s = c as? String, s.hasPrefix("https://"), let u = URL(string: s) { return u }
    }
    return nil
  }
}
