import Foundation
import UIKit
import WidgetKit

// بيانات الودجت: التطبيق يحطها في App Group، والودجت يحدثها من السيرفر كل ساعتين
let appGroup = "group.com.saudiguide"
let apiBase = "https://saudi-guide-api.saudi-guide2030.workers.dev"

struct WPick: Codable {
  var kind: String
  var id: Int
  var title: String
  var sub: String
  var image: String
  var start: String
  var url: String
}

struct WOffer: Codable {
  var id: Int
  var store: String
  var title: String
  var off: String
  var url: String
}

struct WGoing: Codable {
  var id: Int
  var title: String
  var start: String
  var city: String
  var url: String
}

struct WPayload: Codable {
  var city: String
  var cityName: String
  var lat: Double
  var lng: Double
  var pick: WPick?
  var offer: WOffer?
  var going: [WGoing]
  var at: Int
}

struct SGEntry: TimelineEntry {
  let date: Date
  let payload: WPayload?
  let temp: Int?
  let weatherCode: Int?
  let image: UIImage?
}

func parseDate(_ s: String) -> Date? {
  if s.isEmpty { return nil }
  let f = ISO8601DateFormatter()
  f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  if let d = f.date(from: s) { return d }
  f.formatOptions = [.withInternetDateTime]
  return f.date(from: s)
}

/// الفعاليات اللي ما بدت للحين (أو بدت من أقل من 3 ساعات)
func upcoming(_ g: [WGoing]) -> [(WGoing, Date)] {
  let limit = Date().addingTimeInterval(-3 * 3600)
  return g.compactMap { x in
    guard let d = parseDate(x.start), d > limit else { return nil }
    return (x, d)
  }.sorted { $0.1 < $1.1 }
}

enum Store {
  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  static func cached() -> WPayload? {
    guard let s = defaults?.string(forKey: "payload"), let d = s.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WPayload.self, from: d)
  }

  /// لغة التطبيق (يحفظها التطبيق): العربي افتراضياً
  static func lang() -> String { defaults?.string(forKey: "lang") ?? "ar" }

  static func city() -> String {
    if let c = defaults?.string(forKey: "city"), !c.isEmpty { return c }
    return cached()?.city ?? "riyadh"
  }

  static func save(_ p: WPayload) {
    guard let d = try? JSONEncoder().encode(p), let s = String(data: d, encoding: .utf8) else { return }
    defaults?.set(s, forKey: "payload")
  }

  static func fetch(_ url: URL) async -> Data? {
    var req = URLRequest(url: url)
    req.timeoutInterval = 12
    guard let res = try? await URLSession.shared.data(for: req) else { return nil }
    return res.0
  }

  /// يجهز مدخل الودجت: آخر بيانات + تحديث من السيرفر + الطقس + الصورة
  static func load(withImage: Bool) async -> SGEntry {
    var p = cached()
    let c = city().addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "riyadh"
    if let url = URL(string: "\(apiBase)/v1/widget?city=\(c)"),
       let data = await fetch(url),
       var fresh = try? JSONDecoder().decode(WPayload.self, from: data) {
      // الودجت ما عنده حساب المستخدم: نحتفظ بفعالياته اللي حطها التطبيق
      fresh.going = p?.going ?? []
      p = fresh
      save(fresh)
    }

    var temp: Int? = nil
    var code: Int? = nil
    if let p = p,
       let url = URL(string: "https://api.open-meteo.com/v1/forecast?latitude=\(p.lat)&longitude=\(p.lng)&current=temperature_2m,weather_code&timezone=Asia%2FRiyadh"),
       let data = await fetch(url),
       let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       let cur = obj["current"] as? [String: Any] {
      if let t = cur["temperature_2m"] as? Double { temp = Int(t.rounded()) }
      if let w = cur["weather_code"] as? Int { code = w }
    }

    var img: UIImage? = nil
    if withImage, let s = p?.pick?.image, let url = URL(string: s), let data = await fetch(url), let full = UIImage(data: data) {
      let w: CGFloat = 500
      let h = w * full.size.height / max(full.size.width, 1)
      img = full.preparingThumbnail(of: CGSize(width: w, height: h)) ?? full
    }
    return SGEntry(date: Date(), payload: p, temp: temp, weatherCode: code, image: img)
  }
}

func weatherSymbol(_ code: Int?) -> String {
  guard let c = code else { return "sun.max.fill" }
  switch c {
  case 0: return "sun.max.fill"
  case 1, 2: return "cloud.sun.fill"
  case 3: return "cloud.fill"
  case 45, 48: return "cloud.fog.fill"
  case 51...67, 80...82: return "cloud.rain.fill"
  case 71...77, 85, 86: return "cloud.snow.fill"
  case 95...99: return "cloud.bolt.rain.fill"
  default: return "sun.max.fill"
  }
}

struct SGProvider: TimelineProvider {
  var withImage: Bool = false

  func placeholder(in context: Context) -> SGEntry {
    SGEntry(date: Date(), payload: Store.cached(), temp: 30, weatherCode: 0, image: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (SGEntry) -> Void) {
    if context.isPreview {
      completion(SGEntry(date: Date(), payload: Store.cached(), temp: 30, weatherCode: 0, image: nil))
      return
    }
    Task { completion(await Store.load(withImage: withImage)) }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SGEntry>) -> Void) {
    Task {
      let e = await Store.load(withImage: withImage)
      completion(Timeline(entries: [e], policy: .after(Date().addingTimeInterval(2 * 3600))))
    }
  }
}
