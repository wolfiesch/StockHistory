#!/usr/bin/env swift

import Foundation
import CoreGraphics
import AppKit

// Generate a 1024x1024 app icon for DCA Visualizer
let size: CGFloat = 1024

// Create bitmap context
guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
      let context = CGContext(
          data: nil,
          width: Int(size),
          height: Int(size),
          bitsPerComponent: 8,
          bytesPerRow: 0,
          space: colorSpace,
          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      ) else {
    print("Failed to create context")
    exit(1)
}

// Flip coordinate system
context.translateBy(x: 0, y: size)
context.scaleBy(x: 1, y: -1)

// Background gradient (deep blue to lighter blue)
let gradientColors = [
    CGColor(red: 0.05, green: 0.1, blue: 0.25, alpha: 1.0),
    CGColor(red: 0.1, green: 0.2, blue: 0.4, alpha: 1.0)
] as CFArray

guard let gradient = CGGradient(
    colorsSpace: colorSpace,
    colors: gradientColors,
    locations: [0.0, 1.0]
) else {
    print("Failed to create gradient")
    exit(1)
}

// Draw background with rounded corners
let cornerRadius: CGFloat = 180
let rect = CGRect(x: 0, y: 0, width: size, height: size)
let path = CGPath(roundedRect: rect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)
context.addPath(path)
context.clip()

context.drawLinearGradient(
    gradient,
    start: CGPoint(x: 0, y: 0),
    end: CGPoint(x: size, y: size),
    options: []
)

// Draw ascending chart line (representing growth)
let chartPath = CGMutablePath()
let padding: CGFloat = 180
let chartWidth = size - 2 * padding
let chartHeight = size - 2 * padding

// Chart points representing DCA growth over time
let points: [(CGFloat, CGFloat)] = [
    (0.0, 0.15),
    (0.15, 0.22),
    (0.25, 0.18),
    (0.35, 0.35),
    (0.45, 0.32),
    (0.55, 0.48),
    (0.65, 0.52),
    (0.75, 0.68),
    (0.85, 0.72),
    (1.0, 0.85)
]

// Convert to screen coordinates
let screenPoints = points.map { (x, y) -> CGPoint in
    CGPoint(
        x: padding + x * chartWidth,
        y: padding + y * chartHeight
    )
}

// Create smooth curve through points
chartPath.move(to: screenPoints[0])
for i in 1..<screenPoints.count {
    let prev = screenPoints[i - 1]
    let curr = screenPoints[i]
    let midX = (prev.x + curr.x) / 2
    chartPath.addCurve(
        to: curr,
        control1: CGPoint(x: midX, y: prev.y),
        control2: CGPoint(x: midX, y: curr.y)
    )
}

// Draw area fill under the curve
let areaPath = chartPath.mutableCopy()!
areaPath.addLine(to: CGPoint(x: screenPoints.last!.x, y: padding))
areaPath.addLine(to: CGPoint(x: screenPoints.first!.x, y: padding))
areaPath.closeSubpath()

// Gradient fill for area
let areaGradientColors = [
    CGColor(red: 0.2, green: 0.6, blue: 1.0, alpha: 0.4),
    CGColor(red: 0.2, green: 0.6, blue: 1.0, alpha: 0.05)
] as CFArray

guard let areaGradient = CGGradient(
    colorsSpace: colorSpace,
    colors: areaGradientColors,
    locations: [0.0, 1.0]
) else {
    print("Failed to create area gradient")
    exit(1)
}

context.saveGState()
context.addPath(areaPath)
context.clip()
context.drawLinearGradient(
    areaGradient,
    start: CGPoint(x: size/2, y: padding + chartHeight),
    end: CGPoint(x: size/2, y: padding),
    options: []
)
context.restoreGState()

// Draw the main line
context.setStrokeColor(CGColor(red: 0.3, green: 0.7, blue: 1.0, alpha: 1.0))
context.setLineWidth(28)
context.setLineCap(.round)
context.setLineJoin(.round)
context.addPath(chartPath)
context.strokePath()

// Draw investment dots (representing regular DCA purchases)
let dotRadius: CGFloat = 24
context.setFillColor(CGColor(red: 0.4, green: 0.8, blue: 0.4, alpha: 1.0))

for (i, point) in screenPoints.enumerated() {
    // Only show some dots to avoid clutter
    if i % 2 == 0 || i == screenPoints.count - 1 {
        context.fillEllipse(in: CGRect(
            x: point.x - dotRadius,
            y: point.y - dotRadius,
            width: dotRadius * 2,
            height: dotRadius * 2
        ))
    }
}

// Draw dollar sign
let dollarSignCenter = CGPoint(x: size * 0.25, y: size * 0.75)
let dollarSize: CGFloat = 140

context.setFillColor(CGColor(red: 0.4, green: 0.9, blue: 0.5, alpha: 0.9))

// Draw $ using paths
let dollarPath = CGMutablePath()
// Vertical line
dollarPath.addRect(CGRect(
    x: dollarSignCenter.x - 12,
    y: dollarSignCenter.y - dollarSize/2 - 20,
    width: 24,
    height: dollarSize + 40
))

context.addPath(dollarPath)
context.fillPath()

// S curves (simplified)
context.setStrokeColor(CGColor(red: 0.4, green: 0.9, blue: 0.5, alpha: 0.9))
context.setLineWidth(24)

let sPath = CGMutablePath()
// Top curve
sPath.addArc(
    center: CGPoint(x: dollarSignCenter.x, y: dollarSignCenter.y + dollarSize * 0.25),
    radius: dollarSize * 0.35,
    startAngle: .pi * 0.3,
    endAngle: .pi * 1.3,
    clockwise: false
)
// Bottom curve
sPath.addArc(
    center: CGPoint(x: dollarSignCenter.x, y: dollarSignCenter.y - dollarSize * 0.25),
    radius: dollarSize * 0.35,
    startAngle: .pi * 1.7,
    endAngle: .pi * 0.3,
    clockwise: true
)

context.addPath(sPath)
context.strokePath()

// Add upward arrow at the end of the chart
let arrowTip = screenPoints.last!
let arrowSize: CGFloat = 80

context.setFillColor(CGColor(red: 0.3, green: 0.7, blue: 1.0, alpha: 1.0))
let arrowPath = CGMutablePath()
arrowPath.move(to: CGPoint(x: arrowTip.x, y: arrowTip.y + arrowSize))
arrowPath.addLine(to: CGPoint(x: arrowTip.x - arrowSize * 0.6, y: arrowTip.y + arrowSize * 0.3))
arrowPath.addLine(to: CGPoint(x: arrowTip.x + arrowSize * 0.6, y: arrowTip.y + arrowSize * 0.3))
arrowPath.closeSubpath()

context.addPath(arrowPath)
context.fillPath()

// Create image and save
guard let image = context.makeImage() else {
    print("Failed to create image")
    exit(1)
}

let bitmapRep = NSBitmapImageRep(cgImage: image)
guard let pngData = bitmapRep.representation(using: .png, properties: [:]) else {
    print("Failed to create PNG data")
    exit(1)
}

let outputPath = "App/Assets.xcassets/AppIcon.appiconset/AppIcon.png"
let url = URL(fileURLWithPath: outputPath)

do {
    try pngData.write(to: url)
    print("App icon saved to: \(outputPath)")
} catch {
    print("Failed to save: \(error)")
    exit(1)
}
