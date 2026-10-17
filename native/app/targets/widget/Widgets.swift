import SwiftUI
import WidgetKit

let purple = Color("sgPurple")
let orange = Color("sgOrange")
let pink = Color("sgPink")
let ink = Color("sgInk")

extension View {
  /// لغة واتجاه الودجت حسب لغة التطبيق (العد التنازلي يطلع «بعد ٣ أيام» بالعربي)
  func sgLocale() -> some View {
    let ar = Store.lang() != "en"
    return self
      .environment(\.locale, Locale(identifier: ar ? "ar_SA" : "en_US"))
      .environment(\.layoutDirection, ar ? .rightToLeft : .leftToRight)
  }
}

@main
struct SaudiGuideWidgets: WidgetBundle {
  var body: some Widget {
    TodayWidget()
    GoingWidget()
    OfferWidget()
    BreakWidget()
  }
}

// MARK: - «اليوم في مدينتك»: الطقس + فعالية أو مكان اليوم

struct TodayWidget: Widget {
  let kind = "SGToday"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SGProvider(withImage: true)) { e in
      TodayView(e: e)
    }
    .configurationDisplayName("اليوم في مدينتك")
    .description("الطقس، ومكان أو فعالية تستاهل زيارتك اليوم.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct TodayView: View {
  let e: SGEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    let p = e.payload
    let pick = p?.pick
    VStack(alignment: .leading, spacing: 4) {
      HStack(spacing: 4) {
        Image(systemName: weatherSymbol(e.weatherCode)).symbolRenderingMode(.multicolor).font(.system(size: 14))
        if let t = e.temp { Text("\(t)°").font(.system(size: 15, weight: .bold)) }
        Spacer(minLength: 0)
        Text(p?.cityName ?? "دليل السعودية").font(.system(size: 12, weight: .semibold)).lineLimit(1).opacity(0.9)
      }
      Spacer(minLength: 0)
      if let pick = pick {
        Text(pick.kind == "event" ? "فعالية قريبة" : "مكان اليوم")
          .font(.system(size: 10, weight: .bold))
          .padding(.horizontal, 6).padding(.vertical, 2)
          .background(orange, in: Capsule())
        Text(pick.title)
          .font(.system(size: family == .systemSmall ? 14 : 17, weight: .bold))
          .lineLimit(2)
          .minimumScaleFactor(0.85)
        if family != .systemSmall && !pick.sub.isEmpty {
          Text(pick.sub).font(.system(size: 12)).lineLimit(2).opacity(0.85)
        }
      } else {
        Text("افتح دليل السعودية واكتشف مدينتك").font(.system(size: 14, weight: .bold)).lineLimit(3)
      }
    }
    .foregroundStyle(.white)
    .padding(14)
    .sgLocale()
    .widgetURL(URL(string: pick?.url ?? "saudiguide://"))
    .containerBackground(for: .widget) {
      ZStack {
        LinearGradient(colors: [purple, ink], startPoint: .top, endPoint: .bottom)
        if let img = e.image {
          Image(uiImage: img).resizable().scaledToFill()
          LinearGradient(colors: [.black.opacity(0.35), .clear, .black.opacity(0.75)], startPoint: .top, endPoint: .bottom)
        }
      }
    }
  }
}

// MARK: - «فعالياتي»: عد تنازلي لأقرب فعالية «رايح» (الشاشة الرئيسية وشاشة القفل)

struct GoingWidget: Widget {
  let kind = "SGGoing"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SGProvider(withImage: false)) { e in
      GoingView(e: e)
    }
    .configurationDisplayName("فعالياتي")
    .description("عد تنازلي لأقرب فعالية ضغطت عليها «رايح».")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
  }
}

struct GoingView: View {
  let e: SGEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    let list = upcoming(e.payload?.going ?? [])
    Group {
      switch family {
      case .accessoryInline:
        if let first = list.first {
          Text("\(first.0.title) · ") + Text(first.1, style: .relative)
        } else {
          Text("ما عندك فعاليات قريبة")
        }
      case .accessoryRectangular:
        VStack(alignment: .leading, spacing: 1) {
          if let first = list.first {
            Text(first.0.title).font(.headline).lineLimit(1)
            Text(first.1, style: .relative).font(.system(size: 13, weight: .semibold))
            Text(first.1, style: .date).font(.caption2).opacity(0.8)
          } else {
            Text("فعالياتي").font(.headline)
            Text("اضغط «رايح» على أي فعالية").font(.caption).lineLimit(2)
          }
        }
      case .systemMedium:
        VStack(alignment: .leading, spacing: 6) {
          header
          if list.isEmpty { empty } else {
            ForEach(Array(list.prefix(3).enumerated()), id: \.offset) { _, item in
              Link(destination: URL(string: item.0.url) ?? URL(string: "saudiguide://")!) {
                HStack(spacing: 8) {
                  Text(item.0.title).font(.system(size: 14, weight: .bold)).lineLimit(1)
                  Spacer(minLength: 4)
                  Text(item.1, style: .relative).font(.system(size: 12, weight: .semibold)).foregroundStyle(orange).lineLimit(1)
                }
              }
            }
            Spacer(minLength: 0)
          }
        }
      default:
        VStack(alignment: .leading, spacing: 4) {
          header
          Spacer(minLength: 0)
          if let first = list.first {
            Text(first.0.title).font(.system(size: 15, weight: .bold)).lineLimit(3).minimumScaleFactor(0.85)
            Text(first.1, style: .relative).font(.system(size: 13, weight: .bold)).foregroundStyle(orange)
          } else { empty }
        }
      }
    }
    .sgLocale()
    .widgetURL(URL(string: list.first?.0.url ?? "saudiguide://events"))
    .containerBackground(for: .widget) {
      if family == .systemSmall || family == .systemMedium {
        LinearGradient(colors: [Color(.systemBackground), Color(.secondarySystemBackground)], startPoint: .top, endPoint: .bottom)
      } else {
        AccessoryWidgetBackground()
      }
    }
  }

  var header: some View {
    HStack(spacing: 4) {
      Image(systemName: "calendar").foregroundStyle(purple)
      Text("فعالياتي").font(.system(size: 13, weight: .bold)).foregroundStyle(purple)
    }
  }

  var empty: some View {
    Text("اضغط «رايح» على أي فعالية، ونعد لك الوقت هنا.").font(.system(size: 13)).foregroundStyle(.secondary).lineLimit(3)
  }
}

// MARK: - «عرض اليوم»

struct OfferWidget: Widget {
  let kind = "SGOffer"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SGProvider(withImage: false)) { e in
      OfferView(e: e)
    }
    .configurationDisplayName("عرض اليوم")
    .description("عرض أو خصم جديد كل يوم.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct OfferView: View {
  let e: SGEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    let o = e.payload?.offer
    VStack(alignment: .leading, spacing: 4) {
      HStack(spacing: 4) {
        Image(systemName: "tag.fill")
        Text("عرض اليوم").font(.system(size: 12, weight: .bold))
      }.opacity(0.9)
      Spacer(minLength: 0)
      if let o = o {
        Text(o.off).font(.system(size: family == .systemSmall ? 24 : 30, weight: .heavy)).lineLimit(1).minimumScaleFactor(0.6)
        Text(o.store).font(.system(size: 14, weight: .bold)).lineLimit(1)
        Text(o.title).font(.system(size: 12)).lineLimit(family == .systemSmall ? 2 : 3).opacity(0.9)
      } else {
        Text("العروض تتجدد كل يوم في دليل السعودية").font(.system(size: 13, weight: .bold)).lineLimit(3)
      }
    }
    .foregroundStyle(.white)
    .sgLocale()
    .widgetURL(URL(string: o?.url ?? "saudiguide://offers"))
    .containerBackground(for: .widget) {
      LinearGradient(colors: [orange, pink], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
  }
}

// MARK: - «الإجازة الجاية»: عد تنازلي لأقرب إجازة دراسية أو مناسبة (من التقويم)

struct BreakWidget: Widget {
  let kind = "SGBreak"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SGProvider(withImage: false)) { e in
      BreakView(e: e)
    }
    .configurationDisplayName("الإجازة الجاية")
    .description("عد تنازلي لأقرب إجازة، وخطط رحلتك من الحين.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
  }
}

struct BreakView: View {
  let e: SGEntry
  @Environment(\.widgetFamily) var family

  /// كم يوم باقي (بالأيام الكاملة بتوقيت مكة)
  func daysLeft(_ d: Date) -> Int {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "Asia/Riyadh") ?? .current
    return max(0, cal.dateComponents([.day], from: cal.startOfDay(for: Date()), to: cal.startOfDay(for: d)).day ?? 0)
  }

  func leftText(_ n: Int, _ ar: Bool) -> String {
    if n == 0 { return ar ? "اليوم" : "Today" }
    if n == 1 { return ar ? "بكرة" : "Tomorrow" }
    if !ar { return "In \(n) days" }
    if n == 2 { return "بعد يومين" }
    return n <= 10 ? "بعد \(n) أيام" : "بعد \(n) يوم"
  }

  func lenText(_ d: Int, _ ar: Bool) -> String {
    if !ar { return "\(d) days" }
    return d <= 10 ? "\(d) أيام" : "\(d) يوم"
  }

  var body: some View {
    let ar = Store.lang() != "en"
    let b = e.payload?.next
    let date = b.flatMap { parseDate($0.start) }
    let title = b.map { ar || $0.titleEn.isEmpty ? $0.title : $0.titleEn } ?? ""
    let n = date.map { daysLeft($0) } ?? 0
    let left = leftText(n, ar)
    let len = lenText(b?.days ?? 0, ar)
    Group {
      switch family {
      case .accessoryInline:
        if b != nil { Text("\(title) · \(left)") } else { Text(ar ? "التقويم والإجازات" : "Calendar") }
      case .accessoryRectangular:
        VStack(alignment: .leading, spacing: 1) {
          Text(b != nil ? title : (ar ? "الإجازة الجاية" : "Next break")).font(.headline).lineLimit(1)
          Text(b != nil ? left : (ar ? "افتح التقويم" : "Open the calendar")).font(.system(size: 13, weight: .semibold))
          if b != nil { Text(len).font(.caption2).opacity(0.8) }
        }
      default:
        VStack(alignment: .leading, spacing: 4) {
          HStack(spacing: 4) {
            Image(systemName: "calendar")
            Text(ar ? "الإجازة الجاية" : "Next break").font(.system(size: 12, weight: .bold))
          }.opacity(0.9)
          Spacer(minLength: 0)
          if b != nil {
            if n > 1 {
              HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(n)").font(.system(size: family == .systemSmall ? 38 : 44, weight: .heavy))
                Text(ar ? (n <= 10 ? "أيام" : "يوم") : "days").font(.system(size: 14, weight: .bold)).opacity(0.9)
              }
            } else {
              Text(left).font(.system(size: 28, weight: .heavy))
            }
            Text(title).font(.system(size: 15, weight: .bold)).lineLimit(2).minimumScaleFactor(0.85)
            if family == .systemMedium { Text((ar ? "مدتها " : "Lasts ") + len + (ar ? " · خطط رحلتك من الحين" : " · plan your trip now")).font(.system(size: 12)).opacity(0.85).lineLimit(1) }
          } else {
            Text(ar ? "افتح التقويم وشوف الإجازات الجاية" : "Open the calendar to see upcoming breaks").font(.system(size: 13, weight: .bold)).lineLimit(3)
          }
        }
        .foregroundStyle(.white)
      }
    }
    .sgLocale()
    .widgetURL(URL(string: b?.url ?? "saudiguide://calendar"))
    .containerBackground(for: .widget) {
      if family == .systemSmall || family == .systemMedium {
        LinearGradient(colors: [pink, purple], startPoint: .topLeading, endPoint: .bottomTrailing)
      } else {
        AccessoryWidgetBackground()
      }
    }
  }
}
