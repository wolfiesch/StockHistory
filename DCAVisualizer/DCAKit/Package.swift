// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DCAKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(
            name: "DCAKit",
            targets: ["DCAKit"]
        ),
    ],
    targets: [
        .target(
            name: "DCAKit",
            path: "Sources/DCAKit"
        ),
        .testTarget(
            name: "DCAKitTests",
            dependencies: ["DCAKit"],
            path: "Tests/DCAKitTests"
        ),
    ]
)
